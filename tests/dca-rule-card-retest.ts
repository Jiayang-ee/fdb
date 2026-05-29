import { test, expect } from '@playwright/test';
import path from 'path';

const HTML_FILE = path.join(__dirname, '..', 'index.html');

test.describe('DCA Rule Info Card — Mobile Retest (commit e52f358)', () => {
  // ── Mobile Responsive Verification ────────────────────────────────
  // Fix: @media (max-width: 640px) { .sidebar { width: 100%; overflow-x: auto; } }
  // Expected: scrollWidth <= clientWidth (no horizontal overflow)
  for (const { width, label } of [
    { width: 360, label: '360px (mobile)' },
    { width: 390, label: '390px (mobile)' },
  ]) {
    test(`[${label}] 无横向溢出`, async ({ page }) => {
      await page.goto(`file://${HTML_FILE}`);
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.body.scrollWidth > document.body.clientWidth);
      expect(overflow).toBe(false);
    });
  }
});