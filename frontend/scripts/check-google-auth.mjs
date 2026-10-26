import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Requires a running local frontend built with a non-secret Google web client
// ID. Google Identity Services and every auth response are intercepted test
// fixtures; this script never sends credentials to Google or Express.
const baseUrl = process.env.GOOGLE_AUTH_TEST_URL || "http://localhost:3001";
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
    "GOOGLE_AUTH_TEST_URL must be an HTTP loopback origin without credentials.",
  );
}

const googleScriptUrl = "https://accounts.google.com/gsi/client";
const fixtureCredential = "synthetic-google-id-token-for-browser-test";
const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const profile = mkdtempSync(join(tmpdir(), "trove-google-auth-"));
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

const googleFixtureScript = `(() => {
  let configuration;
  window.__troveGoogleTest = {
    initializeCount: 0,
    renderCount: 0,
    promptCount: 0,
    cancelNext: false,
    configuration: null,
    buttonOptions: null,
  };

  window.google = {
    accounts: {
      id: {
        initialize(options) {
          configuration = options;
          window.__troveGoogleTest.initializeCount += 1;
          window.__troveGoogleTest.configuration = {
            client_id: options.client_id,
            auto_select: options.auto_select,
            button_auto_select: options.button_auto_select,
            use_fedcm_for_button: options.use_fedcm_for_button,
            ux_mode: options.ux_mode,
          };
        },
        renderButton(parent, options) {
          window.__troveGoogleTest.renderCount += 1;
          window.__troveGoogleTest.buttonOptions = options;
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.googleFixtureButton = "true";
          button.textContent = "Continue with Google";
          button.style.width = options.width + "px";
          button.style.height = "40px";
          button.addEventListener("click", () => {
            if (window.__troveGoogleTest.cancelNext) {
              window.__troveGoogleTest.cancelNext = false;
              return;
            }
            configuration.callback({ credential: ${JSON.stringify(fixtureCredential)} });
          });
          parent.append(button);
        },
      },
    },
  };
})();`;

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
  let scriptShouldFail = true;
  let googleResponse = {
    status: 401,
    body: { message: "Fixture rejection" },
  };
  let googleNetworkFailure = false;
  let sessionActive = false;
  const pending = new Map();
  const googleRequests = [];

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

  async function fulfillJson(requestId, status, body) {
    await command("Fetch.fulfillRequest", {
      requestId,
      responseCode: status,
      responseHeaders: [
        { name: "Content-Type", value: "application/json" },
        { name: "Cache-Control", value: "no-store" },
      ],
      body: Buffer.from(JSON.stringify(body)).toString("base64"),
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

    if (requestUrl.href === googleScriptUrl) {
      if (scriptShouldFail) {
        await command("Fetch.failRequest", {
          requestId: paused.requestId,
          errorReason: "ConnectionFailed",
        });
        return;
      }

      await command("Fetch.fulfillRequest", {
        requestId: paused.requestId,
        responseCode: 200,
        responseHeaders: [
          { name: "Content-Type", value: "application/javascript" },
        ],
        body: Buffer.from(googleFixtureScript).toString("base64"),
      });
      return;
    }

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
      requestUrl.pathname === "/api/auth/google" &&
      paused.request.method === "POST"
    ) {
      googleRequests.push({
        contentType:
          paused.request.headers["Content-Type"] ??
          paused.request.headers["content-type"],
        body: JSON.parse(paused.request.postData || "null"),
      });

      if (googleNetworkFailure) {
        await command("Fetch.failRequest", {
          requestId: paused.requestId,
          errorReason: "ConnectionFailed",
        });
        return;
      }

      if (googleResponse.status === 200) {
        sessionActive = true;
      }

      await fulfillJson(
        paused.requestId,
        googleResponse.status,
        googleResponse.body,
      );
      return;
    }

    if (
      requestUrl.pathname === "/api/auth/me" &&
      paused.request.method === "GET"
    ) {
      await fulfillJson(
        paused.requestId,
        sessionActive ? 200 : 401,
        sessionActive
          ? {
              user: {
                id: "google-browser-fixture",
                email: "fixture@example.test",
                displayName: "Google Test Cook",
              },
            }
          : { message: "Signed out fixture" },
      );
      return;
    }

    if (
      requestUrl.pathname === "/api/auth/logout" &&
      paused.request.method === "POST"
    ) {
      sessionActive = false;
      await command("Fetch.fulfillRequest", {
        requestId: paused.requestId,
        responseCode: 204,
      });
      return;
    }

    await command("Fetch.failRequest", {
      requestId: paused.requestId,
      errorReason: "BlockedByClient",
    });
    throw new Error(
      `Unexpected auth request blocked: ${paused.request.method} ${requestUrl.pathname}`,
    );
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

  async function clickGoogleButton() {
    await evaluate(
      `document.querySelector("[data-google-fixture-button]").click()`,
    );
  }

  async function expectGoogleError(status, expectedText) {
    googleResponse = { status, body: { message: "Unsafe fixture detail" } };
    await clickGoogleButton();
    await waitFor(
      `document.querySelector("[data-google-auth-status]")?.textContent === ${JSON.stringify(expectedText)}`,
    );
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
  await waitFor(
    `document.querySelector("[data-google-auth-status]")?.textContent.includes("could not load")`,
  );
  console.log("PASS: GIS script failure shows safe, recoverable feedback");

  scriptShouldFail = false;
  await navigate("/login");
  await waitFor(`!!document.querySelector("[data-google-fixture-button]")`);

  assert.deepEqual(
    await evaluate(`(() => {
      const test = window.__troveGoogleTest;
      return {
        initializeCount: test.initializeCount,
        promptCount: test.promptCount,
        hasExpectedClientId:
          typeof test.configuration.client_id === "string" &&
          test.configuration.client_id.endsWith(".apps.googleusercontent.com"),
        autoSelect: test.configuration.auto_select,
        buttonAutoSelect: test.configuration.button_auto_select,
        useFedCmForButton: test.configuration.use_fedcm_for_button,
        uxMode: test.configuration.ux_mode,
        buttonText: test.buttonOptions.text,
        buttonSize: test.buttonOptions.size,
        buttonType: document.querySelector("[data-google-fixture-button]").type,
      };
    })()`),
    {
      initializeCount: 1,
      promptCount: 0,
      hasExpectedClientId: true,
      autoSelect: false,
      buttonAutoSelect: false,
      useFedCmForButton: false,
      uxMode: "popup",
      buttonText: "continue_with",
      buttonSize: "large",
      buttonType: "button",
    },
  );
  console.log("PASS: GIS initializes once with popup mode and no One Tap");

  await evaluate(`document.querySelector('a[href="/signup"]').click()`);
  await waitFor(
    `location.pathname === "/signup" && !!document.querySelector("[data-google-fixture-button]")`,
  );
  assert.equal(
    await evaluate(`window.__troveGoogleTest.initializeCount`),
    1,
  );
  await evaluate(`document.querySelector('a[href="/login"]').click()`);
  await waitFor(
    `location.pathname === "/login" && !!document.querySelector("[data-google-fixture-button]")`,
  );
  assert.equal(
    await evaluate(`window.__troveGoogleTest.initializeCount`),
    1,
  );
  console.log("PASS: client navigation reuses one GIS initialization");

  const requestsBeforeCancellation = googleRequests.length;
  await evaluate(`window.__troveGoogleTest.cancelNext = true`);
  await clickGoogleButton();
  await sleep(200);
  assert.equal(googleRequests.length, requestsBeforeCancellation);
  assert.equal(
    await evaluate(
      `document.querySelector("[data-google-button-container]").parentElement.getAttribute("aria-busy")`,
    ),
    "false",
  );
  console.log("PASS: account-picker cancellation leaves the form ready to retry");

  const statusCases = [
    [400, "Google sign-in sent an invalid request. Please try again."],
    [401, "Google could not verify this sign-in. Please try again."],
    [
      403,
      "This Google account cannot create a Trove account automatically. Use another Google account or continue with email and password.",
    ],
    [
      409,
      "This email already has a Trove account. Sign in with your existing method.",
    ],
    [
      429,
      "Too many Google sign-in attempts. Please wait and try again.",
    ],
    [
      503,
      "Google sign-in is temporarily unavailable. Please try again later.",
    ],
    [500, "Google sign-in is unavailable. Please try again."],
  ];

  for (const [status, expectedText] of statusCases) {
    await expectGoogleError(status, expectedText);
  }

  googleNetworkFailure = true;
  await clickGoogleButton();
  await waitFor(
    `document.querySelector("[data-google-auth-status]")?.textContent.includes("Could not reach Trove")`,
  );
  googleNetworkFailure = false;

  googleResponse = { status: 200, body: { message: "Malformed fixture" } };
  await clickGoogleButton();
  await waitFor(
    `document.querySelector("[data-google-auth-status]")?.textContent.includes("unexpected Google sign-in response")`,
  );
  console.log("PASS: API status, network, and malformed-success responses are safe");

  googleResponse = {
    status: 401,
    body: { message: "Fixture rejection" },
  };
  const requestsBeforeDuplicate = googleRequests.length;
  await evaluate(`(() => {
    const button = document.querySelector("[data-google-fixture-button]");
    button.click();
    button.click();
  })()`);
  await sleep(200);
  assert.equal(googleRequests.length, requestsBeforeDuplicate + 1);
  console.log("PASS: duplicate credential callbacks create one backend request");

  googleResponse = {
    status: 401,
    body: { message: "Fixture rejection" },
  };
  const requestsBeforeKeyboard = googleRequests.length;
  await evaluate(`document.querySelector("[data-google-fixture-button]").focus()`);
  await pressKey(" ", "Space", 32);
  await sleep(200);
  assert.equal(googleRequests.length, requestsBeforeKeyboard + 1);
  console.log("PASS: Google control is keyboard operable");

  googleResponse = {
    status: 200,
    body: {
      user: {
        id: "google-browser-fixture",
        email: "fixture@example.test",
        displayName: "Google Test Cook",
      },
    },
  };
  await clickGoogleButton();
  await waitFor(`location.pathname === "/recipes"`);
  await waitFor(
    `document.querySelector("header")?.textContent.includes("Google Test Cook")`,
  );

  assert.deepEqual(googleRequests.at(-1), {
    contentType: "application/json",
    body: { credential: fixtureCredential },
  });
  assert.deepEqual(
    await evaluate(`({
      localStorageKeys: Object.keys(localStorage),
      sessionStorageKeys: Object.keys(sessionStorage),
    })`),
    { localStorageKeys: [], sessionStorageKeys: [] },
  );

  await command("Page.reload");
  await waitFor(
    `document.querySelector("header")?.textContent.includes("Google Test Cook")`,
  );
  await evaluate(
    `Array.from(document.querySelectorAll("header button")).find((button) => button.textContent === "Log out").click()`,
  );
  await waitFor(`!!document.querySelector('header a[href="/login"]')`);
  assert.equal(
    await evaluate(
      `fetch("/api/auth/me", { credentials: "same-origin" }).then((response) => response.status)`,
    ),
    401,
  );
  console.log(
    "PASS: mocked login, session refresh, logout, and revocation regression",
  );

  for (const width of [320, 768, 1440]) {
    await command("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
    await navigate("/signup");
    await waitFor(`!!document.querySelector("[data-google-fixture-button]")`);
    assert.equal(
      await evaluate(`document.documentElement.scrollWidth <= innerWidth`),
      true,
    );
    assert.equal(
      await evaluate(`(() => {
        const container = document.querySelector("[data-google-button-container]").getBoundingClientRect();
        const button = document.querySelector("[data-google-fixture-button]").getBoundingClientRect();
        return button.width <= container.width && button.left >= container.left && button.right <= container.right;
      })()`),
      true,
    );
  }
  console.log("PASS: login/signup Google UI has no overflow at 320, 768, and 1440px");

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
