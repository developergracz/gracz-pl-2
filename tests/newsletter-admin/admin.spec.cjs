const { test, expect } = require("@playwright/test");
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText(/Wyświetlono|Limit/);
  if (
    await page
      .getByRole("status")
      .textContent()
      .then((s) => s.includes("Limit"))
  ) {
    await page.waitForTimeout(1050);
    await page.getByRole("button", { name: "Odśwież", exact: true }).click();
  }
  await expect(page.locator("#rows tr")).toHaveCount(10);
});
test("Polish dashboard, real page counts, responsive layout and keyboard detail", async ({
  page,
}) => {
  await expect(page.locator("#active")).toHaveText("6");
  await expect(page.locator("#unsubscribed")).toHaveText("2");
  await expect(page.locator("#total")).toHaveText("—");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const button = page.getByRole("button", {
    name: "Szczegóły: gracz01@example.test",
    exact: true,
  });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("#detail-body")).toContainText("Potwierdzona");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(button).toBeFocused();
});
test("cursor pagination shows disjoint pages and bounded search keeps continuation", async ({
  page,
}) => {
  await page.waitForTimeout(1050);
  await page.getByRole("button", { name: "Następna strona" }).click();
  await expect(page.locator("#rows")).toContainText("gracz11@example.test");
  await expect(page.locator("#rows")).not.toContainText("gracz01@example.test");
  await page.waitForTimeout(1050);
  await page.getByLabel("Szukaj na pobranej stronie").fill("no-match");
  await page.getByRole("button", { name: "Zastosuj" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Brak dopasowań na tej stronie.",
  );
  await expect(
    page.getByRole("button", { name: "Następna strona" }),
  ).toBeEnabled();
  await expect(page.locator("#total")).toHaveText("—");
});
for (const error of ["rate_limited", "timeout", "provider_unavailable"])
  test(`failure ${error} clears previous rows and counts`, async ({ page }) => {
    await page.route("**/fixture/list", (route) =>
      route.fulfill({ json: { ok: false, error, items: null, counts: null } }),
    );
    await page.getByRole("button", { name: "Odśwież", exact: true }).click();
    await expect(page.locator("#rows tr")).toHaveCount(0);
    await expect(page.locator("#active")).toHaveText("—");
    await expect(page.locator("#total")).toHaveText("—");
    await expect(page.locator("#health")).toContainText("Degradacja");
  });
test("private routes deny forged OWNER and page makes no external calls", async ({
  page,
  request,
}) => {
  const response = await request.get("/internal/admin/newsletter/subscribers", {
    headers: { cookie: "role=OWNER", "x-role": "OWNER" },
  });
  expect(response.status()).toBe(403);
  expect(response.headers()["cache-control"]).toBe("no-store");
  const sources = await page.evaluate(() =>
    performance.getEntriesByType("resource").map((x) => x.name),
  );
  expect(sources.every((s) => s.startsWith("http://127.0.0.1:4179/"))).toBe(
    true,
  );
  expect(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
  ).toBe(0);
});
