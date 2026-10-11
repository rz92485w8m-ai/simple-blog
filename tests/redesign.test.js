"use strict";
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const { server: preview } = require("../scripts/preview");
const { samplePosts } = require("../scripts/preview");
const appPort = Number(process.env.TEST_PORT || 3102);
const base = `http://127.0.0.1:${appPort}`;
const previewBase = "http://127.0.0.1:3103";
let browser, app;
let checks = 0;
const passed = (text) => {
  checks++;
  console.log(`PASS ${text}`);
};
async function ready(child) {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Isolated application did not start")),
      15000,
    );
    child.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("Blog running")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Isolated application exited: ${code}`));
    });
  });
}
async function api(context, method, url, data, token) {
  return context.request.fetch(base + url, {
    method,
    data,
    headers: token ? { "X-CSRF-Token": token } : {},
  });
}
async function login(context, username) {
  const csrf = await (await context.request.get(base + "/api/csrf")).json();
  const result = await api(
    context,
    "POST",
    "/api/login",
    { username, password: "isolated-test-password" },
    csrf.csrfToken,
  );
  assert.equal(result.status(), 200);
  return (await result.json()).csrfToken;
}
async function main() {
  await new Promise((resolve) => preview.listen(3103, "127.0.0.1", resolve));
  app = spawn(process.execPath, [path.join(__dirname, "isolated-app.js")], {
    env: { ...process.env, TEST_PORT: String(appPort) },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await ready(app);
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const scriptErrors = [];
  page.on("pageerror", (error) => scriptErrors.push(error.message));
  const consoleErrors = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /Content Security Policy|Refused to/i.test(message.text())
    )
      consoleErrors.push(message.text());
  });
  const pages = [
    "/",
    "/essays.html",
    "/p/preview-the-question-of-self",
    "/about.html",
    "/contact.html",
  ];
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const url of pages) {
      await page.goto(previewBase + url);
      await page.waitForFunction(
        () => !document.querySelector('[aria-busy="true"]'),
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `${url} overflow at ${width}`,
      );
      assert.equal(await page.locator("main h1").count(), 1);
      const scan = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      assert.deepEqual(
        scan.violations.map((v) => ({
          id: v.id,
          targets: v.nodes.map((n) => n.target),
        })),
        [],
        `${url} accessibility at ${width}`,
      );
    }
    passed(
      `All public layouts: ${width}px, no overflow, no automated WCAG A/AA findings`,
    );
  }
  await page.goto(previewBase + "/essays.html");
  await page.getByRole("button", { name: "Identity", exact: true }).click();
  assert.equal(await page.locator(".essay-card").count(), 2);
  assert.equal(
    await page
      .getByRole("button", { name: "Identity", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.match(await page.locator("#resultsStatus").textContent(), /2 essays/);
  passed("Topic filters and live result counts");
  await page.goto(previewBase + "/");
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.className),
    "skip-link",
  );
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.activeElement.id === "main");
  passed("Keyboard skip link");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    ),
    "auto",
  );
  passed("Reduced-motion preference");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  passed("200% text-size homepage reflow");
  for (const url of ["/", "/essays.html", "/p/preview-the-question-of-self"]) {
    const route = url.startsWith("/p/")
      ? "**/api/posts/slug/**"
      : "**/api/posts";
    let fail = true;
    await page.route(route, (r) =>
      fail
        ? r.fulfill({
            status: 503,
            contentType: "application/json",
            body: '{"error":"test failure"}',
          })
        : r.continue(),
    );
    await page.goto(previewBase + url);
    await page.getByRole("button", { name: "Try again" }).waitFor();
    fail = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await page
      .locator(url.startsWith("/p/") ? ".article-content" : ".essay-card")
      .first()
      .waitFor();
    await page.unroute(route);
  }
  passed("Homepage/archive/article HTTP failure and retry recovery");
  await page.route("**/api/posts", (r) => r.abort());
  await page.goto(previewBase + "/essays.html");
  await page.getByRole("button", { name: "Try again" }).waitFor();
  await page.unroute("**/api/posts");
  passed("Network failure state");
  await page.route("**/api/posts", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.goto(previewBase + "/");
  await page.getByText("New essays are coming soon.").waitFor();
  await page.goto(previewBase + "/essays.html");
  await page.getByText("No essays in this topic yet.").waitFor();
  await page.unroute("**/api/posts");
  await page.goto(previewBase + "/p/missing");
  await page.getByRole("heading", { name: "Essay not found." }).waitFor();
  passed("Empty archives and missing essays");
  const hostile = {
    ...samplePosts[0],
    title: "<img src=x onerror=alert(1)>",
    excerpt: "<script>alert(1)</script>",
    body: "<script>alert(1)</script>\n\n## Safe heading\n\n**Bold** and *italic*.",
  };
  await page.route("**/api/posts/slug/**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(hostile),
    }),
  );
  await page.goto(previewBase + "/p/test");
  await page.locator(".article-content").waitFor();
  assert.equal(
    await page.locator(".article-content script, .article-header img").count(),
    0,
  );
  assert.equal(
    await page.locator(".article-content strong").textContent(),
    "Bold",
  );
  await page.unroute("**/api/posts/slug/**");
  passed("Escaped content and existing Markdown formatting");
  // Test unusually long titles, topic strings and optional cover images.
  await page.route("**/api/posts", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          ...samplePosts[0],
          title: "LongTitle".repeat(24),
          categories: "VeryLongTopic".repeat(12),
          cover_image_url: "/test-cover.svg",
        },
      ]),
    }),
  );
  await page.route("**/test-cover.svg", (r) =>
    r.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#d6cec1"/></svg>',
    }),
  );
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(previewBase + "/");
  await page.locator(".essay-card").waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.unroute("**/api/posts");
  await page.unroute("**/test-cover.svg");
  passed("Long content and optional covers on narrow screens");
  // Real Express routes with pg substituted by a disposable in-memory database.
  const unauthorized = await api(context, "POST", "/api/posts", {
    title: "Should fail",
    body: "Test",
  });
  assert.equal(unauthorized.status(), 403);
  const anonCsrf = await (await context.request.get(base + "/api/csrf")).json();
  assert.equal(
    (
      await api(
        context,
        "POST",
        "/api/posts",
        { title: "Should fail", body: "Test" },
        anonCsrf.csrfToken,
      )
    ).status(),
    401,
  );
  passed("CSRF and anonymous write protection");
  await page.goto(base + "/login.html");
  await page.getByLabel("Username").fill("test-author");
  await page.getByLabel("Password").fill("isolated-test-password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL("**/admin.html");
  await page
    .locator("#welcomeName")
    .filter({ hasText: "test-author" })
    .waitFor();
  passed("Author login through unchanged authentication code");
  const me = await (await context.request.get(base + "/api/me")).json();
  const token = me.csrfToken;
  await page.getByLabel("Essay title", { exact: true }).fill("Isolated draft");
  await page.getByLabel("Excerpt", { exact: true }).fill("Test excerpt");
  await page
    .getByLabel("Topics (comma separated)")
    .fill("Identity, Psychology");
  await page
    .getByLabel("Essay text (Markdown)")
    .fill("## Test heading\n\nA **test** paragraph.");
  await page.locator("#status").selectOption("draft");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page
    .locator("#adminPosts h3")
    .filter({ hasText: "Isolated draft" })
    .waitFor();
  assert.equal(
    (await (await context.request.get(base + "/api/posts")).json()).length,
    0,
  );
  let draft = (
    await (await context.request.get(base + "/api/admin/posts")).json()
  )[0];
  assert.equal(
    (
      await context.request.get(base + "/api/posts/slug/" + draft.slug)
    ).status(),
    404,
  );
  passed("Save draft and public draft protection");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("#title").value === "Isolated draft",
  );
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page.locator("#previewModal:not(.hidden)").waitFor();
  await page.waitForFunction(
    () => document.activeElement.id === "closePreviewButton",
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "closePreviewButton",
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => document.activeElement.id === "previewButton",
  );
  await page.getByRole("button", { name: "Link", exact: true }).click();
  await page.locator("#linkModal:not(.hidden)").waitFor();
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.activeElement.id === "linkButton");
  passed(
    "Preview and link dialog focus trapping, Escape and focus restoration",
  );
  await page.getByRole("button", { name: "Link", exact: true }).click();
  await page.getByLabel("Link text", { exact: true }).fill("Example");
  await page.getByLabel("Web address").fill("example.com");
  await page.getByRole("button", { name: "Insert link" }).click();
  assert.match(
    await page.locator("#body").inputValue(),
    /\[Example\]\(https:\/\/example.com\/\)/,
  );
  await page
    .getByLabel("Essay title", { exact: true })
    .fill("Isolated published essay");
  await page.locator("#status").selectOption("published");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page
    .locator("#adminPosts h3")
    .filter({ hasText: "Isolated published essay" })
    .waitFor();
  const published = (
    await (await context.request.get(base + "/api/posts")).json()
  )[0];
  assert.equal(published.slug, draft.slug);
  assert.equal(published.excerpt, "Test excerpt");
  assert.equal(published.categories, "Identity, Psychology");
  await page.goto(base + "/p/" + published.slug);
  await page
    .getByRole("heading", { name: "Isolated published essay", exact: true })
    .waitFor();
  passed("Edit, publish, stable slug, excerpt/topics and public reading");
  const other = await browser.newContext();
  const otherToken = await login(other, "other-author");
  assert.equal(
    (await other.request.get(base + "/api/posts/" + published.id)).status(),
    404,
  );
  assert.equal(
    (
      await api(
        other,
        "PUT",
        "/api/posts/" + published.id,
        { title: "Unauthorized", body: "Test" },
        otherToken,
      )
    ).status(),
    404,
  );
  assert.equal(
    (
      await api(
        other,
        "DELETE",
        "/api/posts/" + published.id,
        undefined,
        otherToken,
      )
    ).status(),
    404,
  );
  await other.close();
  passed("Author ownership checks");
  // Storage is intentionally not configured. UI is additionally checked with a intercepted test URL.
  assert.equal(
    (await api(context, "POST", "/api/upload", {}, token)).status(),
    503,
  );
  await page.goto(base + "/admin.html");
  await page
    .locator("#welcomeName")
    .filter({ hasText: "test-author" })
    .waitFor();
  await page.route("**/api/upload", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"url":"http://127.0.0.1:' + appPort + '/test-cover.svg"}',
    }),
  );
  await page.route("**/test-cover.svg", (r) =>
    r.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#d6cec1"/></svg>',
    }),
  );
  await page
    .locator("#coverImage")
    .setInputFiles({
      name: "test.png",
      mimeType: "image/png",
      buffer: Buffer.from("isolated upload UI test"),
    });
  await page.getByText("Uploaded", { exact: true }).waitFor();
  assert.match(await page.locator("#coverUrl").inputValue(), /test-cover.svg/);
  assert.equal(await page.locator("#coverPreview").isVisible(), true);
  await page.unroute("**/api/upload");
  await page.unroute("**/test-cover.svg");
  passed(
    "Upload unavailable state and mocked upload UI (no storage connection)",
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  const adminScan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    adminScan.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
    [],
    "Admin accessibility",
  );
  passed("Author page automated accessibility");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByText("No posts yet.").waitFor();
  assert.equal(
    (await (await context.request.get(base + "/api/posts")).json()).length,
    0,
  );
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await page.waitForURL(base + "/");
  assert.equal(
    (await (await context.request.get(base + "/api/me")).json()).loggedIn,
    false,
  );
  passed("Delete and logout");
  await page.goto(base + "/login.html");
  const loginScan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    loginScan.violations.map((v) => v.id),
    [],
    "Login accessibility",
  );
  assert.deepEqual(scriptErrors, []);
  assert.deepEqual(consoleErrors, []);
  passed("Login accessibility; no JavaScript errors or CSP violations");
  // Export review screenshots of every public page at desktop/mobile sizes.
  const screenshotDir =
    process.env.SCREENSHOT_DIR || path.resolve(__dirname, "../work/review");
  fs.mkdirSync(screenshotDir, { recursive: true });
  for (const [device, width] of [
    ["desktop", 1440],
    ["mobile", 390],
  ]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [name, url] of [
      ["home", "/"],
      ["essays", "/essays.html"],
      ["article", "/p/preview-the-question-of-self"],
      ["about", "/about.html"],
      ["contact", "/contact.html"],
    ]) {
      await page.goto(previewBase + url);
      await page.waitForFunction(
        () => !document.querySelector('[aria-busy="true"]'),
      );
      await page.screenshot({
        path: path.join(screenshotDir, `${name}-${device}.png`),
        fullPage: true,
      });
    }
  }
  console.log(
    `\n${checks} checks passed. All data was disposable; no production connections.`,
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    preview.close();
    if (app) app.kill();
  });
