import assert from "node:assert/strict";
import http from "node:http";
import { createRequire } from "node:module";
import { serveGomokuConsole } from "../auth/gomoku-console.mjs";
const require = createRequire(
  new URL("../../modern/checkers-engine/package.json", import.meta.url),
);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const server = http.createServer((req, res) => {
  if (!serveGomokuConsole(req, res, new URL(req.url, "http://localhost"))) {
    res.writeHead(404);
    res.end("{}");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/konto/gomoku/`;
(async () => {
  const b = await chromium.launch({
    ...(process.env.CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
      : {}),
    args: ["--no-sandbox"],
  });
  try {
    for (const [width, height] of [
      [1920, 1080],
      [1440, 900],
      [1366, 768],
      [1280, 720],
      [1024, 768],
      [800, 600],
      [390, 844],
      [320, 568],
    ]) {
      const p = await b.newPage({ viewport: { width, height } });
      await p.route("**/auth/**", (r) =>
        r.fulfill({
          json: {
            ok: true,
            profile: { nickname: "Tester" },
            challenges: [],
            friends: [],
            messages: [],
          },
        }),
      );
      await p.goto(baseUrl);
      for (const mode of ["training", "online"]) {
        await p.locator("#" + mode + "-mode").evaluate((e) => e.click());
        await p.waitForTimeout(100);
        const result = await p.evaluate(() => {
          const sidebar = document.querySelector(".sidebar"),
            s = sidebar.getBoundingClientRect(),
            brand = document.querySelector(".brand").getBoundingClientRect(),
            premium = document
              .querySelector(".badge-premium")
              .getBoundingClientRect(),
            errors = [];
          if (
            brand.right > premium.left ||
            Math.abs(
              brand.top + brand.height / 2 - premium.top - premium.height / 2,
            ) > 2
          )
            errors.push("header row");
          for (const e of sidebar.querySelectorAll(
            "input,select,button,.side-links a,summary",
          )) {
            if (!e.getClientRects().length) continue;
            const r = e.getBoundingClientRect();
            if (r.left < s.left || r.right > s.right + 1)
              errors.push("horizontal " + (e.id || e.textContent));
            if (innerWidth > 800 && (r.top < 0 || r.bottom > innerHeight))
              errors.push("vertical " + (e.id || e.textContent));
          }
          return {
            errors,
            scroll: sidebar.scrollHeight,
            client: sidebar.clientHeight,
            height: s.height,
            bottom: s.bottom,
          };
        });
        assert.deepEqual(
          result.errors,
          [],
          `${width}x${height} ${mode}: ${JSON.stringify(result)}`,
        );
        if (width > 800)
          assert.ok(
            result.scroll <= result.client + 1,
            `${width} ${mode}: scroll ${JSON.stringify(result)}`,
          );
        console.log("PASS", width, height, mode, result);
      }
      await p.locator(".rules summary").focus();
      await p.keyboard.press("Enter");
      assert.equal(await p.locator(".rules").getAttribute("open"), "");
      await p.keyboard.press("Enter");
      await p.locator(".badge-premium").focus();
      await p.keyboard.press("Enter");
      assert.equal(await p.locator(".premium-info p").isVisible(), true);
      await p.keyboard.press("Enter");
      await p.close();
    }
  } finally {
    await b.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
