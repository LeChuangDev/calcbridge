import { expect, test } from '@playwright/test';

test.describe('核心冒烟', () => {
  test('首页 → 过孔面板 → 实时结果', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '工具目录' })).toBeVisible();

    await page
      .getByRole('button', { name: /过孔参数/ })
      .first()
      .click();
    await expect(page.getByRole('heading', { name: '过孔参数' })).toBeVisible();
    await expect(page.getByText('过孔电阻', { exact: true })).toBeVisible();
  });

  test('命令面板可打开并用 Esc 关闭', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '视图' }).click();
    await page.getByRole('menuitem', { name: /命令面板/ }).click();

    const search = page.getByLabel('搜索工具或命令');
    await expect(search).toBeVisible();
    await expect(search).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(search).toBeHidden();
  });

  test('深链进入面板并导出设计文件', async ({ page }) => {
    await page.goto('/#/via');
    await expect(page.getByRole('heading', { name: '过孔参数' })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '文件' }).click();
    await page.getByRole('menuitem', { name: '导出设计文件（JSON）' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^calcbridge-design-.*\.json$/);
  });
});
