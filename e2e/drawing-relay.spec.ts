import { test, expect } from '@playwright/test';

test('four mobile players draw, reconnect, reveal together and play again', async ({ browser }) => {
  const contexts = await Promise.all(
    Array.from({ length: 4 }, () => browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true }))
  );
  const pages = await Promise.all(contexts.map(c => c.newPage()));
  try {
    await pages[0].goto('/drawing-relay', { waitUntil: 'networkidle' });
    await pages[0].getByRole('button', { name: '방 만들기', exact: true }).click();
    await expect(pages[0].getByRole('heading', { name: /방을 만들어/ })).toBeVisible();
    await pages[0].getByRole('button', { name: '방 만들기', exact: true }).last().click();
    await expect(pages[0]).toHaveURL(/roomId=/);
    await pages[0].getByRole('button', { name: '닫기', exact: true }).click();
    await Promise.all(pages.slice(1).map(p => p.goto(pages[0].url())));
    for (let i = 0; i < 4; i++) {
      await pages[i].getByLabel('닉네임', { exact: true }).fill(['민지', '현우', '서연', '지훈'][i]);
      await pages[i].getByRole('button', { name: '참가하기', exact: true }).click();
      await pages[i].getByRole('button', { name: '준비 완료', exact: true }).click();
    }
    await expect(pages[0].getByRole('button', { name: '게임 시작', exact: true })).toBeEnabled();
    await pages[0].screenshot({
      path: process.env.PREVIEW_SCREENSHOTS_DIR
        ? `${process.env.PREVIEW_SCREENSHOTS_DIR}/drawing-relay-lobby.png`
        : test.info().outputPath('drawing-relay-lobby.png'),
    });
    await pages[0].getByRole('button', { name: '게임 시작', exact: true }).click();
    for (let round = 0; round < 4; round++) {
      for (let i = 0; i < 4; i++) {
        const page = pages[i];
        if (round === 0 && i === 0)
          await page.screenshot({
            path: process.env.PREVIEW_SCREENSHOTS_DIR
              ? `${process.env.PREVIEW_SCREENSHOTS_DIR}/drawing-relay-writing.png`
              : test.info().outputPath('drawing-relay-writing.png'),
          });
        if (round % 2 === 0) {
          await page.getByLabel('전달할 문장', { exact: true }).fill(`비밀 이야기 ${round}-${i}`);
          if (round === 0 && i === 0) {
            await page.waitForTimeout(1200);
            await page.reload();
            await expect(page.getByLabel('전달할 문장', { exact: true })).toHaveValue('비밀 이야기 0-0');
          }
          await page.getByRole('button', { name: '문장 전달하기', exact: true }).click();
        } else {
          const canvas = page.getByRole('img', { name: '그림 그리는 종이', exact: true });
          await expect(canvas).toBeVisible();
          if (round === 1 && i === 0)
            await page.screenshot({
              path: process.env.PREVIEW_SCREENSHOTS_DIR
                ? `${process.env.PREVIEW_SCREENSHOTS_DIR}/drawing-relay-canvas.png`
                : test.info().outputPath('drawing-relay-canvas.png'),
            });
          const box = await canvas.boundingBox();
          if (!box) throw new Error('Missing canvas');
          await page.mouse.move(box.x + 20, box.y + 20);
          await page.mouse.down();
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
          await page.mouse.up();
          await page.getByRole('button', { name: '지우개', exact: true }).click();
          await page.touchscreen.tap(box.x + 25, box.y + 25);
          await page.getByRole('button', { name: '되돌리기', exact: true }).click();
          const widths = await page.evaluate(() => ({
            width: document.documentElement.scrollWidth,
            viewport: innerWidth,
          }));
          expect(widths.width).toBeLessThanOrEqual(widths.viewport);
          await page.getByRole('button', { name: '그림 전달하기', exact: true }).click();
        }
      }
    }
    await expect(pages[0].getByRole('button', { name: '다음 장 공개', exact: true })).toBeVisible();
    await expect(pages[1].getByText('비밀 이야기 0-0', { exact: true })).toHaveCount(0);
    for (let i = 0; i < 16; i++) await pages[0].getByRole('button', { name: '다음 장 공개', exact: true }).click();
    await pages[0].screenshot({
      path: process.env.PREVIEW_SCREENSHOTS_DIR
        ? `${process.env.PREVIEW_SCREENSHOTS_DIR}/drawing-relay-results.png`
        : test.info().outputPath('drawing-relay-results.png'),
    });
    for (const page of pages) {
      await expect(page.getByRole('button', { name: '이야기 이미지 저장', exact: true })).toHaveCount(4);
    }
    await pages[0].getByRole('button', { name: '이야기 이미지 저장', exact: true }).first().click();
    await expect(pages[0].getByRole('link', { name: '저장할 이미지 보기' })).toHaveAttribute('href', /^blob:/);
    await pages[0].getByRole('button', { name: '한 판 더 하기', exact: true }).click();
    for (const page of pages) await expect(page.getByRole('heading', { name: '함께 그릴 친구들' })).toBeVisible();
  } finally {
    await Promise.all(contexts.map(c => c.close()));
  }
});
