import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('category tabs show all seven games or only the chosen category', async ({ page }) => {
  const main = page.getByRole('main');
  const all = page.getByRole('tab', { name: '전체', exact: true });
  await expect(all).toHaveAttribute('aria-selected', 'true');
  await expect(main.getByRole('link')).toHaveCount(7);

  await page.getByRole('tab', { name: '벌칙·추첨', exact: true }).click();
  await expect(main.getByRole('link')).toHaveCount(3);
  await expect(main.getByRole('link', { name: /커피내기/ })).toBeVisible();
  await expect(main.getByRole('heading', { name: '파티게임', exact: true })).toHaveCount(0);

  await page.getByRole('tab', { name: '파티게임', exact: true }).click();
  await expect(main.getByRole('link')).toHaveCount(4);
  await expect(main.getByRole('link', { name: /낙서 이어달리기/ })).toBeVisible();
  await expect(main.getByRole('heading', { name: '벌칙·추첨', exact: true })).toHaveCount(0);

  await all.click();
  await expect(main.getByRole('link')).toHaveCount(7);
  await expect(all).toHaveAttribute('aria-selected', 'true');
});

test('tabs stay below the header when scrolling and filtering starts at the results', async ({ page }) => {
  for (const width of [360, 375]) {
    await page.setViewportSize({ width, height: 812 });
    await page.getByRole('tab', { name: '전체', exact: true }).click();
    const main = page.getByRole('main');
    await main.evaluate(el => {
      el.scrollTop = el.scrollHeight;
    });
    const tabs = page.getByRole('tablist', { name: '게임 카테고리' });
    await expect
      .poll(async () => {
        const row = await tabs.boundingBox();
        const header = await page.getByRole('banner').boundingBox();
        return Math.abs((row?.y ?? -1000) - ((header?.y ?? 0) + (header?.height ?? 0)));
      })
      .toBeLessThanOrEqual(1);
    await page.getByRole('tab', { name: '파티게임', exact: true }).click();
    await expect(main.getByRole('link', { name: /낙서 이어달리기/ })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test('arrow and home/end keys select categories and keep focus on the selected tab', async ({ page }) => {
  const all = page.getByRole('tab', { name: '전체', exact: true });
  await all.focus();
  await page.keyboard.press('ArrowRight');
  const penalty = page.getByRole('tab', { name: '벌칙·추첨', exact: true });
  await expect(penalty).toBeFocused();
  await expect(penalty).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: '파티게임', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(all).toBeFocused();
  await expect(all).toHaveAttribute('aria-selected', 'true');
});
