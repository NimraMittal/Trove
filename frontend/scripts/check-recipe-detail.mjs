import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Requires a running local frontend and local discovery backend. Detail and
// auth requests use synthetic browser fixtures; no account or recipe writes.
// Discovery navigation uses a real ID from the local server-rendered page.
const baseUrl = process.env.RECIPE_DETAIL_TEST_URL || "http://localhost:3001";
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
    "RECIPE_DETAIL_TEST_URL must be an HTTP loopback origin without credentials.",
  );
}

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const profile = mkdtempSync(join(tmpdir(), "trove-recipe-detail-"));
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
  const recipeId = "a0000000-0000-4000-8000-000000000001";
  const userId = "b0000000-0000-4000-8000-000000000001";
  let mode = "public";
  let signedIn = false;
  let detailRequests = 0;
  let holdRequest;
  const fixture = {
    id: recipeId,
    title: "Browser fixture: a recipe for testing",
    description: "Synthetic content used only by the browser regression.",
    category: "TEST FIXTURE",
    visibility: "PUBLIC",
    createdAt: "2026-11-13T00:00:00.000Z",
    updatedAt: "2026-11-13T00:00:00.000Z",
    ownerId: userId,
    creator: { displayName: "Fixture Cook" },
    ingredients: [
      { id: "c0000000-0000-4000-8000-000000000001", name: "Flour", quantity: "125.5", unit: "g", notes: "sifted", position: 0 },
      { id: "c0000000-0000-4000-8000-000000000002", name: "Salt", quantity: null, unit: null, notes: "to taste", position: 1 },
      { id: "c0000000-0000-4000-8000-000000000003", name: "Water", quantity: "0.0001", unit: null, notes: null, position: 2 },
      { id: "c0000000-0000-4000-8000-000000000004", name: "Eggs", quantity: "2", unit: null, notes: null, position: 3 },
      { id: "c0000000-0000-4000-8000-000000000005", name: "Herbs", quantity: null, unit: "sprigs", notes: null, position: 4 },
      { id: "c0000000-0000-4000-8000-000000000006", name: "Optional addition", quantity: "0", unit: null, notes: null, position: 5 },
    ],
    steps: [
      { id: "d0000000-0000-4000-8000-000000000001", instruction: "Combine ingredients.", position: 0 },
      { id: "d0000000-0000-4000-8000-000000000002", instruction: "Bake until done.", position: 1 },
    ],
  };
  const pending = new Map();


  function command(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++commandId;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Chrome command timed out: ${method}`));
      }, 10000);

      pending.set(id, { resolve, reject, timer, method });
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
        // Navigation and AbortController can cancel a paused browser request
        // before its mock response arrives. No response remains to fulfill.
        if (request.method.startsWith("Fetch.") &&
            message.error.code === -32602 &&
            message.error.message === "Invalid InterceptionId.") {
          request.resolve({});
          return;
        }
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

    const fulfill = async (status, body) => command("Fetch.fulfillRequest", {
      requestId: paused.requestId,
      responseCode: status,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
      ...(status === 204 ? {} : { body: Buffer.from(JSON.stringify(body)).toString("base64") }),
    });
    if (requestUrl.pathname.startsWith("/api/auth/")) {
      if (requestUrl.pathname === "/api/auth/me" && paused.request.method === "GET") {
        await fulfill(signedIn ? 200 : 401, signedIn ? {
          user: { id: userId, email: "fixture@example.test", displayName: "Fixture Cook" },
        } : { message: "Signed out fixture" });
        return;
      }
      if (requestUrl.pathname === "/api/auth/logout" && paused.request.method === "POST") {
        signedIn = false;
        await fulfill(204, null);
        return;
      }
      await command("Fetch.failRequest", { requestId: paused.requestId, errorReason: "BlockedByClient" });
      throw new Error("Unexpected auth request blocked.");
    }
    if (requestUrl.pathname.startsWith("/api/recipes/")) {
      assert.equal(paused.request.method, "GET");
      detailRequests += 1;
      if (mode === "hold") {
        holdRequest = () => fulfill(200, fixture);
        return;
      }
      if (mode === "network") {
        await command("Fetch.failRequest", { requestId: paused.requestId, errorReason: "ConnectionRefused" });
        return;
      }
      const statuses = { missing: 404, denied: 404, server: 503, invalid: 400 };
      if (statuses[mode]) {
        await fulfill(statuses[mode], { message: "Sensitive internal message must never appear" });
        return;
      }
      const result = structuredClone(fixture);
      result.id = requestUrl.pathname.split("/").at(-1);
      if (mode === "empty") { result.ingredients = []; result.steps = []; }
      if (mode === "private") result.visibility = "PRIVATE";
      if (mode === "malformed") result.ingredients[0].quantity = 125.5;
      if (mode === "wrong-id") result.id = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
      if (mode === "unordered") result.steps.reverse();
      if (mode === "long") {
        result.title = "LongRecipeTitle".repeat(20);
        result.creator.displayName = "LongCreatorName".repeat(20);
        result.ingredients[0].name = "LongIngredient".repeat(30);
        result.steps[0].instruction = "LongInstruction".repeat(40);
      }
      await fulfill(200, result);
      return;
    }
    await command("Fetch.continueRequest", { requestId: paused.requestId });
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
    // Page.navigate can resolve while the previous document is still complete.
    // Wait for a new document, rather than accidentally checking stale UI.
    const marker = `${Date.now()}-${Math.random()}`;
    await evaluate(`window.__troveNavigationMarker = ${JSON.stringify(marker)}`);
    await command("Page.navigate", { url: new URL(pathname, baseUrl).href });
    await waitFor(`window.__troveNavigationMarker !== ${JSON.stringify(marker)} && location.pathname === ${JSON.stringify(pathname)} && document.readyState === "complete"`);
  }

  await command("Page.enable");
  await command("Page.bringToFront");
  await command("Emulation.setFocusEmulationEnabled", { enabled: true });
  await command("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  await command("Emulation.setDeviceMetricsOverride", {
    width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false,
  });
  const path = `/recipes/${recipeId}`;
  const text = () => evaluate("document.querySelector('main').innerText");
  const ready = () => waitFor(`!!document.querySelector('#recipe-title')`);

  mode = "hold";
  await navigate(path);
  await waitFor(`document.querySelector('[role="status"]')?.textContent === 'Loading recipe…'`);
  for (let attempt = 0; !holdRequest && attempt < 100; attempt += 1) await sleep(50);
  assert.ok(holdRequest);
  await holdRequest();
  await ready();
  assert.equal(await evaluate(`document.querySelector('#recipe-title').textContent`), fixture.title);
  assert.ok((await text()).includes(fixture.description));
  assert.equal(await evaluate(`document.querySelector('main ol').tagName`), "OL");
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('main ol li')).map(x => x.textContent)`), fixture.steps.map(x => x.instruction));
  const ingredientText = await evaluate(`Array.from(document.querySelectorAll('main ul li')).map(x => x.innerText)`);
  for (const [index, expected] of ["125.5 g Flour", "Salt", "0.0001 Water", "2 Eggs", "sprigs Herbs", "0 Optional addition"].entries()) {
    assert.ok(ingredientText[index].includes(expected), ingredientText[index]);
  }
  assert.ok(ingredientText[0].includes("sifted"));
  assert.ok(ingredientText[1].includes("to taste"));
  assert.ok(!ingredientText.join(" ").includes("null"));
  assert.equal(await evaluate(`document.querySelectorAll('header[ class ]').length > 0`), true);
  await waitFor(`!!document.querySelector('header a[href="/login"]')`);
  console.log("PASS: public recipe, title, description, exact decimal strings, optional fields, ordered ingredients and numbered steps; loading and guest header");

  mode = "empty";
  await navigate(path);
  await ready();
  assert.ok((await text()).includes("No ingredients have been added"));
  assert.ok((await text()).includes("No cooking instructions have been added"));
  assert.equal(await evaluate(`document.querySelectorAll('main ul li, main ol li').length`), 0);
  console.log("PASS: legacy empty ingredient and step arrays");

  signedIn = true;
  mode = "public";
  await navigate(path);
  await ready();
  await waitFor(`document.querySelector('header').innerText.includes('Fixture Cook')`);
  mode = "private";
  await navigate(path);
  await ready();
  assert.ok((await text()).includes("Private · Only you"));
  mode = "denied";
  await evaluate(`window.dispatchEvent(new Event('focus'))`);
  await waitFor(`document.querySelector('main h1')?.textContent === 'Recipe not found'`);
  assert.ok(!(await text()).includes(fixture.title));
  mode = "private";
  await navigate(path);
  await ready();
  await evaluate(`Array.from(document.querySelectorAll('header button')).find(x => x.textContent === 'Log out').click()`);
  await waitFor(`location.pathname === '/'`);
  mode = "denied";
  await navigate(path);
  await waitFor(`document.querySelector('main h1')?.textContent === 'Recipe not found'`);
  const deniedText = await text();
  mode = "missing";
  await navigate(path);
  await waitFor(`document.querySelector('main h1')?.textContent === 'Recipe not found'`);
  assert.equal(await text(), deniedText);
  assert.ok(!(await text()).includes(fixture.title));
  console.log("PASS: mocked signed-in/public and owner/private states, focus access recheck, logout navigation, identical inaccessible/missing views");

  const beforeInvalid = detailRequests;
  await navigate("/recipes/not-a-uuid");
  await waitFor(`document.querySelector('main h1')?.textContent.includes('isn’t valid')`);
  assert.equal(detailRequests, beforeInvalid);
  for (const [testMode, expected] of [["invalid", "isn’t valid"], ["server", "temporarily unavailable"], ["network", "couldn’t reach"], ["malformed", "temporarily unavailable"], ["wrong-id", "temporarily unavailable"], ["unordered", "temporarily unavailable"]]) {
    mode = testMode;
    await navigate(path);
    await waitFor(`document.querySelector('main h1')?.textContent.includes(${JSON.stringify(expected)})`);
    assert.ok(!(await text()).includes("Sensitive internal"));
    assert.ok(await evaluate(`!!document.querySelector('main [role="alert"]')`));
    assert.ok(await evaluate(`!!document.querySelector('main a[href="/recipes"]')`));
  }
  await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await waitFor(`!!document.querySelector('main button')`);
  await evaluate(`document.querySelector('main button').focus()`);
  assert.equal(await evaluate(`getComputedStyle(document.activeElement).outlineStyle`), "solid");
  mode = "public";
  await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: "\r" });
  await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: "\r" });

  await ready();
  console.log("PASS: invalid ID without fetch, backend 400/404/503, network failure, malformed response, mismatched ID, invalid ordering, accessible retry by keyboard");

  for (const width of [320, 375, 768, 1440]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
    mode = "long";
    await navigate(path);
    await ready();
    assert.equal(await evaluate(`document.querySelector('main').scrollWidth <= innerWidth`), true);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('main section, main h1, main li')).every(x => x.getBoundingClientRect().right <= innerWidth)`), true);
  }
  console.log("PASS: long content and responsive layout at 320, 375, 768, 1440 pixels");

  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await navigate("/recipes");
  await waitFor(`!!document.querySelector('main article a[href^="/recipes/"]')`);
  const href = await evaluate(`document.querySelector('main article a').getAttribute('href')`);
  assert.match(href, /^\/recipes\/[0-9a-f-]{36}$/i);
  mode = "public";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, text: "\t" });
    await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    await sleep(50);
    if (await evaluate(`document.activeElement === document.querySelector('main article a')`)) break;
  }
  assert.equal(await evaluate(`document.activeElement === document.querySelector('main article a')`), true);
  assert.equal(await evaluate(`getComputedStyle(document.activeElement, '::after').outlineStyle`), "solid");
  await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: "\r" });
  await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: "\r" });
  await waitFor(`location.pathname === ${JSON.stringify(href)}`);
  await ready();
  assert.equal(await evaluate(`document.querySelectorAll('nav[aria-label="Primary navigation"]').length`), 1);
  console.log("PASS: real discovery ID link, keyboard navigation, and one shared header");

  // Optional real backend read: no detail/auth interception, no test-data writes.
  // Only use an existing public recipe ID; screenshots represent actual local data.
  if (process.env.RECIPE_DETAIL_REAL_ID) {
    assert.match(process.env.RECIPE_DETAIL_REAL_ID, /^[0-9a-f-]{36}$/i);
    await command("Fetch.disable");
    await navigate(`/recipes/${process.env.RECIPE_DETAIL_REAL_ID}`);
    await ready();
    const actualTitle = await evaluate(`document.querySelector('#recipe-title').textContent`);
    assert.ok(actualTitle.length > 0);
    if (process.env.RECIPE_DETAIL_SCREENSHOT_DIR) {
      for (const [label, width] of [["desktop", 1440], ["mobile", 375]]) {
        await command("Emulation.setDeviceMetricsOverride", { width, height: 1100, deviceScaleFactor: 1, mobile: width < 768 });
        await sleep(200);
        const screenshot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
        writeFileSync(join(process.env.RECIPE_DETAIL_SCREENSHOT_DIR, `recipe_detail_${label}.png`), Buffer.from(screenshot.data, "base64"));
      }
    }
    console.log("PASS: existing public recipe rendered from the real local backend through the frontend proxy");
  }
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
