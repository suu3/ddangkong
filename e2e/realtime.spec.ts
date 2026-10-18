import { test, expect } from '@playwright/test';

test('roulette shares one committed result and restores it after reload and network reconnect', async ({ browser }) => {
  const host = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const viewer = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await host.newPage();
  const visitor = await viewer.newPage();
  await page.goto('/roulette');
  await page.getByRole('button', { name: '방 만들기', exact: true }).click();
  await page.getByRole('button', { name: '방 만들기', exact: true }).last().click();
  await expect(page).toHaveURL(/roomId=/);
  await visitor.goto(page.url());
  await expect(page.getByRole('button', { name: '시작하기', exact: true })).toBeEnabled();
  await expect(visitor.getByRole('button', { name: '시작하기', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '시작하기', exact: true }).click();
  const input = page.getByPlaceholder('내용을 입력해 주세요');
  await input.fill('커피');
  await input.press('Enter');
  await input.fill('차');
  await input.press('Enter');
  await expect(visitor.getByRole('button', { name: '돌리기', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '돌리기', exact: true }).click();
  const result = page.getByTestId('roulette-result');
  await expect(result).toBeVisible({ timeout: 20000 });
  await expect(visitor.getByTestId('roulette-result')).toHaveText(await result.innerText());
  await visitor.reload();
  await expect(visitor.getByTestId('roulette-result')).toHaveText(await result.innerText(), { timeout: 20000 });
  await viewer.setOffline(true);
  await expect(visitor.getByRole('status')).toContainText('다시 연결');
  await viewer.setOffline(false);
  await expect(visitor.getByRole('status')).toHaveCount(0, { timeout: 20000 });
  const dimensions = await visitor.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  await host.close();
  await viewer.close();
});

test('team split shares its members and result with a read-only viewer', async ({ browser }) => {
  const host = await browser.newContext();
  const viewer = await browser.newContext();
  const page = await host.newPage();
  const visitor = await viewer.newPage();
  await page.goto('/team-split');
  await page.getByRole('button', { name: '방 만들기', exact: true }).click();
  await page.getByRole('button', { name: '방 만들기', exact: true }).last().click();
  await expect(page).toHaveURL(/roomId=/);
  await visitor.goto(page.url());
  await expect(page.getByRole('textbox')).toBeEnabled();
  await page.getByRole('textbox').fill('민지\n현우\n유진\n서준');
  await page.getByRole('button', { name: '팀 나누기', exact: true }).click();
  await expect(visitor.getByRole('textbox')).toHaveValue('민지\n현우\n유진\n서준');
  await expect(visitor.getByRole('textbox')).toBeDisabled();
  await expect(
    visitor
      .locator('section')
      .filter({ has: visitor.getByRole('heading', { name: '결과', exact: true }) })
      .getByRole('listitem')
  ).toHaveText(
    await page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: '결과', exact: true }) })
      .getByRole('listitem')
      .allTextContents()
  );
  await visitor.reload();
  await expect(visitor.getByRole('textbox')).toHaveValue('민지\n현우\n유진\n서준');
  await host.close();
  await viewer.close();
});

test('invalid room links show a recoverable message without unhandled errors', async ({ page }) => {
  await page.goto('/roulette?roomId=00000000-0000-4000-8000-000000000000');
  await expect(page.getByRole('status')).toContainText('방을 찾을 수 없거나 만료');
});

test('coffee keeps participant card choices across refresh and shares the final result', async ({ browser }) => {
  const host = await browser.newContext();
  const member = await browser.newContext();
  const page = await host.newPage();
  const participant = await member.newPage();
  await page.goto('/coffee');
  await page.getByRole('button', { name: '방 만들기', exact: true }).click();
  await page.getByRole('button', { name: '방 만들기', exact: true }).last().click();
  await expect(page).toHaveURL(/roomId=/);
  const roomUrl = page.url();
  await participant.goto(roomUrl);
  await expect(page.getByRole('button', { name: '시작하기', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '시작하기', exact: true }).click();
  await page.getByRole('button', { name: '증가', exact: true }).first().click();
  await page.getByRole('button', { name: '증가', exact: true }).first().click();
  await page.getByRole('button', { name: '증가', exact: true }).last().click();
  await page.getByRole('button', { name: '주문하기', exact: true }).click();
  await participant.getByRole('button', { name: '커피 카드 1 선택' }).click();
  await expect(participant.getByRole('button', { name: '커피 카드 1 선택' })).toContainText('나');
  await participant.reload();
  await expect(participant.getByRole('button', { name: '커피 카드 1 선택' })).toContainText('나');
  await expect(participant.getByRole('button', { name: '결과 확인', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '결과 확인', exact: true }).click();
  await expect(page).toHaveURL(/coffee\/result/, { timeout: 20000 });
  await expect(participant).toHaveURL(/coffee\/result/, { timeout: 20000 });
  expect(new URL(page.url()).searchParams.get('boom')).toBe(new URL(participant.url()).searchParams.get('boom'));
  await host.close();
  await member.close();
});

test('hot potato accepts a member ready command and passes only from the current holder', async ({ browser }) => {
  const host = await browser.newContext();
  const member = await browser.newContext();
  const page = await host.newPage();
  const participant = await member.newPage();
  await page.goto('/hot-potato');
  await page.getByRole('button', { name: '방 만들기', exact: true }).click();
  await page.getByRole('button', { name: '방 만들기', exact: true }).last().click();
  await expect(page).toHaveURL(/roomId=/);
  await participant.goto(page.url());
  await expect(participant.getByRole('button', { name: '준비', exact: true })).toBeVisible();
  await participant.getByRole('button', { name: '준비', exact: true }).click();
  await expect(page.getByRole('button', { name: '게임 시작', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '게임 시작', exact: true }).click();
  await expect(page.getByText('현재 소유자:', { exact: false })).toBeVisible();
  const hostCanPass = await page.getByRole('button', { name: '다음 사람', exact: true }).isEnabled();
  const holder = hostCanPass ? page : participant;
  const other = hostCanPass ? participant : page;
  await expect(other.getByRole('button', { name: '다음 사람', exact: true })).toBeDisabled();
  const before = await holder.getByText('현재 소유자:', { exact: false }).innerText();
  await holder.getByRole('button', { name: '다음 사람', exact: true }).click();
  await expect(other.getByText('현재 소유자:', { exact: false })).not.toHaveText(before);
  await participant.reload();
  await expect(participant.getByText('현재 소유자:', { exact: false })).toHaveText(
    await page.getByText('현재 소유자:', { exact: false }).innerText()
  );
  await host.close();
  await member.close();
});
