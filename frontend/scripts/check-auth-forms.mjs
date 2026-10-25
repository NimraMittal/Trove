import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Requires a running local frontend. Auth responses are intercepted test
// fixtures, so this script never contacts Express or writes account data.
const baseUrl = process.env.AUTH_FORM_TEST_URL || "http://localhost:3001";
const target = new URL(baseUrl);

if (
  target.protocol !== "http:" ||
  !["localhost", "127.0.0.1"].includes(target.hostname) ||
  target.username ||
  target.password ||
  target.pathname !== "/" ||
  target.search ||
  target.hash
) {
  throw new Error(
    "AUTH_FORM_TEST_URL must be an HTTP loopback origin without credentials.",
  );
}

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const profile = mkdtempSync(join(tmpdir(), "trove-auth-forms-"));
const chrome = spawn(
  process.env.CHROME_BIN || "/usr/bin/google-chrome",
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

let spawnError;
let socket;
let interceptionError;

chrome.on("error", (error) => {
  spawnError = error;
});

(async () => {
  let port;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (spawnError) throw spawnError;
    if (chrome.exitCode !== null) {
      throw new Error("Chrome exited before debugger startup.");
    }

    try {
      const candidate = Number(
        readFileSync(join(profile, "DevToolsActivePort"), "utf8").split(
          "\n",
        )[0],
      );

      if (
        Number.isInteger(candidate) &&
        candidate > 0 &&
        candidate < 65536
      ) {
        port = candidate;
        break;
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    await sleep(100);
  }

  if (!port) {
    throw new Error("Chrome debugger did not start within 10 seconds.");
  }

  const response = await fetch(`http://127.0.0.1:${port}/json`, {
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.ok, true);

  const page = (await response.json()).find((entry) => entry.type === "page");
  assert.ok(page, "Chrome must expose a page target.");

  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Chrome WebSocket timed out.")),
      5000,
    );

    socket.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    socket.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        reject(new Error("Chrome WebSocket failed."));
      },
      { once: true },
    );
  });

  let commandId = 0;
  let loginSucceeds = false;
  const pending = new Map();
  const authRequests = [];

  function command(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++commandId;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Chrome command timed out: ${method}`));
      }, 10000);

      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async function handleMessage(event) {
    const message = JSON.parse(event.data);

    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;

      pending.delete(message.id);
      clearTimeout(request.timer);

      if (message.error) {
        request.reject(new Error(JSON.stringify(message.error)));
      } else {
        request.resolve(message.result);
      }
      return;
    }

    if (message.method !== "Fetch.requestPaused") return;

    const paused = message.params;
    const requestUrl = new URL(paused.request.url);

    if (requestUrl.origin !== target.origin) {
      await command("Fetch.failRequest", {
        requestId: paused.requestId,
        errorReason: "BlockedByClient",
      });
      return;
    }

    if (!requestUrl.pathname.startsWith("/api/auth/")) {
      await command("Fetch.continueRequest", {
        requestId: paused.requestId,
      });
      return;
    }

    if (
      requestUrl.pathname === "/api/auth/me" &&
      paused.request.method === "GET"
    ) {
      await command("Fetch.fulfillRequest", {
        requestId: paused.requestId,
        responseCode: 401,
        responseHeaders: [{ name: "Content-Type", value: "application/json" }],
        body: Buffer.from(JSON.stringify({ message: "Signed out fixture" })).toString(
          "base64",
        ),
      });
      return;
    }

    const isLogin =
      requestUrl.pathname === "/api/auth/login" &&
      paused.request.method === "POST";
    const isRegistration =
      requestUrl.pathname === "/api/auth/register" &&
      paused.request.method === "POST";

    if (!isLogin && !isRegistration) {
      await command("Fetch.failRequest", {
        requestId: paused.requestId,
        errorReason: "BlockedByClient",
      });
      throw new Error(
        `Unexpected auth request blocked: ${paused.request.method} ${requestUrl.pathname}`,
      );
    }

    authRequests.push({
      path: requestUrl.pathname,
      body: JSON.parse(paused.request.postData || "null"),
    });

    const status = isRegistration ? 201 : loginSucceeds ? 200 : 401;
    const body = isRegistration
      ? { message: "Registration successful." }
      : loginSucceeds
        ? {
            user: {
              id: "auth-form-fixture",
              email: "cook@example.test",
              displayName: "Auth Form Cook",
            },
          }
        : { message: "Incorrect email or password." };

    await command("Fetch.fulfillRequest", {
      requestId: paused.requestId,
      responseCode: status,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
      body: Buffer.from(JSON.stringify(body)).toString("base64"),
    });
  }

  socket.addEventListener("message", (event) => {
    void handleMessage(event).catch((error) => {
      interceptionError = error;
    });
  });

  async function evaluate(expression) {
    if (interceptionError) throw interceptionError;

    const result = await command("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });

    if (result.exceptionDetails) {
      throw new Error(JSON.stringify(result.exceptionDetails));
    }

    return result.result.value;
  }

  async function waitFor(expression) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (await evaluate(expression)) return;
      await sleep(100);
    }

    throw new Error(`Timed out: ${expression}`);
  }

  async function navigate(pathname) {
    await command("Page.navigate", { url: new URL(pathname, baseUrl).href });
    await waitFor(`document.readyState === "complete"`);
  }

  async function setInput(selector, value) {
    await evaluate(`(() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set;
      setter.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event("input", { bubbles: true }));
    })()`);
  }

  async function pressKey(key, code, virtualKeyCode) {
    await command("Input.dispatchKeyEvent", {
      type: "keyDown",
      key,
      code,
      windowsVirtualKeyCode: virtualKeyCode,
      nativeVirtualKeyCode: virtualKeyCode,
    });
    await command("Input.dispatchKeyEvent", {
      type: "keyUp",
      key,
      code,
      windowsVirtualKeyCode: virtualKeyCode,
      nativeVirtualKeyCode: virtualKeyCode,
    });
  }

  await command("Page.enable");
  await command("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  await command("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await navigate("/login");
  await waitFor(`!!document.querySelector("#login-password")`);

  assert.deepEqual(
    await evaluate(`(() => {
      const input = document.querySelector("#login-password");
      const button = document.querySelector('[aria-controls="login-password"]');
      return {
        type: input.type,
        name: input.name,
        autocomplete: input.autocomplete,
        buttonType: button.type,
        label: button.getAttribute("aria-label"),
        pressed: button.getAttribute("aria-pressed"),
      };
    })()`),
    {
      type: "password",
      name: "password",
      autocomplete: "current-password",
      buttonType: "button",
      label: "Show password",
      pressed: "false",
    },
  );

  await setInput("#login-password", "correct horse battery staple");
  await evaluate(
    `document.querySelector('[aria-controls="login-password"]').click()`,
  );
  assert.deepEqual(
    await evaluate(`(() => {
      const input = document.querySelector("#login-password");
      const button = document.querySelector('[aria-controls="login-password"]');
      return {
        type: input.type,
        value: input.value,
        label: button.getAttribute("aria-label"),
        pressed: button.getAttribute("aria-pressed"),
      };
    })()`),
    {
      type: "text",
      value: "correct horse battery staple",
      label: "Hide password",
      pressed: "true",
    },
  );

  await evaluate(`document.querySelector("#login-password").focus()`);
  await pressKey("Tab", "Tab", 9);
  assert.equal(
    await evaluate(
      `document.activeElement.getAttribute("aria-controls") === "login-password"`,
    ),
    true,
  );
  await pressKey(" ", "Space", 32);
  await waitFor(`document.querySelector("#login-password").type === "password"`);
  assert.equal(
    await evaluate(`document.querySelector("#login-password").value`),
    "correct horse battery staple",
  );
  console.log(
    "PASS: login visibility toggle preserves value and works by keyboard",
  );

  await setInput("#login-email", "COOK@EXAMPLE.TEST");
  await evaluate(`document.querySelector('button[type="submit"]').click()`);
  await waitFor(`document.querySelector('[role="alert"]')?.textContent.includes("Incorrect")`);
  assert.deepEqual(authRequests.at(-1), {
    path: "/api/auth/login",
    body: {
      email: "cook@example.test",
      password: "correct horse battery staple",
    },
  });

  await setInput("#login-password", "a second valid passphrase");
  await waitFor(`!document.querySelector('[role="alert"]')`);
  loginSucceeds = true;
  await evaluate(`document.querySelector('button[type="submit"]').click()`);
  await waitFor(`location.pathname === "/recipes"`);
  console.log("PASS: login failure feedback, retry payload, and success redirect");

  await navigate("/signup");
  await waitFor(`!!document.querySelector("#signup-confirm-password")`);

  assert.deepEqual(
    await evaluate(`(() => {
      const password = document.querySelector("#signup-password");
      const confirmation = document.querySelector("#signup-confirm-password");
      return {
        passwordType: password.type,
        passwordName: password.name,
        passwordAutocomplete: password.autocomplete,
        confirmationType: confirmation.type,
        confirmationHasName: confirmation.hasAttribute("name"),
        confirmationAutocomplete: confirmation.autocomplete,
      };
    })()`),
    {
      passwordType: "password",
      passwordName: "password",
      passwordAutocomplete: "new-password",
      confirmationType: "password",
      confirmationHasName: false,
      confirmationAutocomplete: "new-password",
    },
  );

  await setInput("#signup-name", "Trove Cook");
  await setInput("#signup-email", "NEW.COOK@EXAMPLE.TEST");
  await setInput("#signup-password", "a memorable signup password");
  await setInput("#signup-confirm-password", "a different signup password");
  const requestsBeforeMismatch = authRequests.length;
  await evaluate(`document.querySelector('button[type="submit"]').click()`);
  await waitFor(`document.querySelector("#signup-confirm-password").getAttribute("aria-invalid") === "true"`);
  assert.equal(authRequests.length, requestsBeforeMismatch);
  assert.equal(
    await evaluate(`document.activeElement.id`),
    "signup-confirm-password",
  );
  console.log("PASS: mismatched confirmation is announced and blocks registration");

  await setInput("#signup-confirm-password", "a memorable signup password");
  await waitFor(`!document.querySelector("#signup-confirm-password").hasAttribute("aria-invalid")`);

  await evaluate(
    `document.querySelector('[aria-controls="signup-confirm-password"]').click()`,
  );
  assert.deepEqual(
    await evaluate(`(() => {
      const input = document.querySelector("#signup-confirm-password");
      return { type: input.type, value: input.value };
    })()`),
    {
      type: "text",
      value: "a memorable signup password",
    },
  );

  await evaluate(`document.querySelector('button[type="submit"]').click()`);
  await waitFor(`location.pathname === "/login"`);
  assert.deepEqual(authRequests.at(-1), {
    path: "/api/auth/register",
    body: {
      displayName: "Trove Cook",
      email: "new.cook@example.test",
      password: "a memorable signup password",
    },
  });
  assert.equal("confirmPassword" in authRequests.at(-1).body, false);
  console.log(
    "PASS: signup sends only the existing backend fields and redirects",
  );

  for (const width of [320, 768, 1440]) {
    await command("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
    await navigate("/signup");
    await waitFor(`!!document.querySelector("#signup-password")`);
    assert.equal(
      await evaluate(`document.documentElement.scrollWidth <= innerWidth`),
      true,
    );
    assert.equal(
      await evaluate(`(() => {
        const input = document.querySelector("#signup-password").getBoundingClientRect();
        const button = document.querySelector('[aria-controls="signup-password"]').getBoundingClientRect();
        return button.left >= input.left && button.right <= input.right;
      })()`),
      true,
    );
  }
  console.log("PASS: auth forms have no horizontal overflow at 320, 768, and 1440px");

  if (interceptionError) throw interceptionError;
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    socket?.close();

    if (
      chrome.pid &&
      chrome.exitCode === null &&
      chrome.signalCode === null
    ) {
      const exited = new Promise((resolve) => chrome.once("exit", resolve));
      chrome.kill();
      await Promise.race([exited, sleep(2000)]);

      if (chrome.exitCode === null && chrome.signalCode === null) {
        chrome.kill("SIGKILL");
        await Promise.race([exited, sleep(2000)]);
      }
    }

    rmSync(profile, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
  });
