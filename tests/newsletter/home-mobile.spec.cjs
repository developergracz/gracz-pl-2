const { test, expect } = require('@playwright/test');

test('homepage Full Max newsletter fits phone/tablet and shows the dedicated phone artwork', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Dedicated responsive homepage regression');

  // Do not send user data, invoke the production newsletter API or load third-party scripts.
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin === 'http://127.0.0.1:4174') return route.continue();
    return route.abort();
  });

  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/#newsletter-home');
    // A first-visit cookie dialog can cover the screenshot on narrow phones.
    // Dismiss it locally; this does not change newsletter consent or send data.
    const rejectCookies = page.getByRole('button', { name: 'Odrzuć wszystko' });
    if (await rejectCookies.isVisible()) {
      await rejectCookies.click();
      await expect(rejectCookies).toBeHidden();
    }
    const section = page.locator('#newsletter-home');
    const content = section.locator('.footer-news-fullmax-content');
    const picture = section.locator('.footer-news-fullmax-scene');
    const image = picture.locator('img');
    const form = section.locator('form[data-newsletter]');
    const email = form.locator('input[type="email"]');
    const submit = form.locator('button[type="submit"]');

    await section.scrollIntoViewIfNeeded();
    await expect(page.locator('link[data-newsletter-fullmax-home]')).toHaveCount(1);
    await expect(section).toHaveCSS('display', 'flex');
    await expect(image).toHaveCSS('object-fit', 'contain');
    await expect(email).toBeVisible();
    await expect(submit).toBeVisible();

    await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
    const src = await image.evaluate(el => el.currentSrc);
    expect(src).toContain('gracz-newsletter-phone-approved-r15.webp');

    const bounds = await Promise.all([section, content, picture, email, submit].map(el => el.boundingBox()));
    for (const rect of bounds) expect(rect).not.toBeNull();
    const [outer, copy, phone, input, button] = bounds;
    // Both content and phone appear within the newsletter, with phone below the form.
    expect(copy.x).toBeGreaterThanOrEqual(outer.x - 1);
    expect(copy.x + copy.width).toBeLessThanOrEqual(outer.x + outer.width + 1);
    expect(phone.x).toBeGreaterThanOrEqual(outer.x - 1);
    expect(phone.x + phone.width).toBeLessThanOrEqual(outer.x + outer.width + 1);
    expect(phone.y).toBeGreaterThanOrEqual(button.y + button.height - 1);
    expect(input.x).toBeGreaterThanOrEqual(outer.x - 1);
    expect(button.x + button.width).toBeLessThanOrEqual(outer.x + outer.width + 1);
    expect(outer.width).toBeLessThanOrEqual(width + 1);

    await section.screenshot({ path: 'test-results/newsletter/newsletter-home-' + width + '.png' });
  }
});
