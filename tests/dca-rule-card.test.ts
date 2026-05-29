import { test, expect } from '@playwright/test';
import path from 'path';

const HTML_FILE = path.join(__dirname, '..', 'index.html');

test.describe('DCA Rule Info Card', () => {
  // ── 1. Rule Card Display ────────────────────────────────────────
  test('规则卡出现在发起回测按钮正下方', async ({ page }) => {
    await page.goto(`file://${HTML_FILE}`);
    const backtestBtn = page.locator('button', { hasText: '发起回测' });
    const ruleCard = page.locator('.rule-card');

    await expect(backtestBtn).toBeVisible();
    await expect(ruleCard).toBeVisible();

    const btnBox = await backtestBtn.boundingBox();
    const cardBox = await ruleCard.boundingBox();
    if (btnBox && cardBox) {
      expect(cardBox.top).toBeGreaterThan(btnBox.top);
      expect(cardBox.top - btnBox.bottom).toBeLessThan(60);
    }
  });

  test('规则卡标题显示「定投规则说明」', async ({ page }) => {
    await page.goto(`file://${HTML_FILE}`);
    await expect(page.locator('.rule-card-header h3')).toHaveText('定投规则说明');
  });

  test('四项说明文案完整展示：定投日、买入价格、手续费、结果说明', async ({ page }) => {
    await page.goto(`file://${HTML_FILE}`);
    const terms = page.locator('.rule-term');
    const texts = ['定投日', '买入价格', '手续费', '结果说明'];
    for (const text of texts) {
      await expect(terms.filter({ hasText: text })).toHaveCount(1);
    }
    await expect(terms).toHaveCount(4);
  });

  test('视觉样式：深色 elevated 背景、1px 边框、金色 accent', async ({ page }) => {
    await page.goto(`file://${HTML_FILE}`);
    const card = page.locator('.rule-card');
    await expect(card).toBeVisible();

    const bg = await card.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).toMatch(/rgb\(33|34|35|36|37|38|39|40|41|42|43/);

    const goldEl = page.locator('.rule-card-header svg');
    const color = await goldEl.evaluate(el => getComputedStyle(el).color);
    expect(color).toMatch(/rgb\(240|241|242|243|244|245/);
  });

  // ── 2. Frequency Switching ────────────────────────────────────
  for (const { label, expected } of [
    { label: '每周', expected: '每周' },
    { label: '每两周', expected: '每两周' },
    { label: '每月', expected: '每月' },
  ]) {
    test(`frequency=「${label}」时定投日说明更新`, async ({ page }) => {
      await page.goto(`file://${HTML_FILE}`);
      await page.locator(`#freqGroup label`, { hasText: label }).click();
      await page.waitForTimeout(80);
      await expect(page.locator('#ruleFreqDesc')).toContainText(expected);
    });
  }

  // ── 3. Fee Mode Switching ──────────────────────────────────────
  test('手续费切换「默认不计」时文案正确', async ({ page }) => {
    await page.goto(`file://${HTML_FILE}`);
    const freeBtn = page.locator('.fee-toggle-btn[data-fee-mode="free"]');
    await freeBtn.click();
    await page.waitForTimeout(80);
    await expect(page.locator('#ruleFeeDesc')).toContainText('不计');
    await expect(freeBtn).toHaveClass(/active/);
  });

  test('手续费切换「按规则扣除」时文案正确', async ({ page }) => {
    await page.goto(`file://${HTML_FILE}`);
    const ruleBtn = page.locator('.fee-toggle-btn[data-fee-mode="rule"]');
    await ruleBtn.click();
    await page.waitForTimeout(80);
    await expect(page.locator('#ruleFeeDesc')).toContainText('扣除');
    await expect(ruleBtn).toHaveClass(/active/);
  });

  test('手续费切换按钮互斥', async ({ page }) => {
    await page.goto(`file://${HTML_FILE}`);
    const freeBtn = page.locator('.fee-toggle-btn[data-fee-mode="free"]');
    const ruleBtn = page.locator('.fee-toggle-btn[data-fee-mode="rule"]');
    await ruleBtn.click();
    await expect(freeBtn).not.toHaveClass(/active/);
    await expect(ruleBtn).toHaveClass(/active/);
    await freeBtn.click();
    await expect(freeBtn).toHaveClass(/active/);
    await expect(ruleBtn).not.toHaveClass(/active/);
  });

  // ── 4. Responsive Verification ────────────────────────────────
  for (const { width, label } of [
    { width: 360, label: '360px (mobile)' },
    { width: 390, label: '390px (mobile)' },
    { width: 820, label: '820px (tablet)' },
    { width: 1366, label: '1366px (desktop)' },
  ]) {
    test(`[${label}] 无横向溢出`, async ({ page }) => {
      await page.goto(`file://${HTML_FILE}`);
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(100);
      const overflow = await page.evaluate(() => document.body.scrollWidth > document.body.clientWidth);
      expect(overflow).toBe(false);
    });
  }
});