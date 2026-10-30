const { chromium } = require('../../jb-web-frontend/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
    const base = process.env.JB_TEST_URL || 'http://127.0.0.1:5175';
    await page.goto(`${base}/${process.env.JB_TEST_WEB ? 'settings' : '#/settings'}`);
    await page.getByRole('heading', { name: 'Configurações', exact: true }).waitFor();
    await page.getByRole('radio', { name: 'Escuro', exact: true }).check();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.reload();
    await page.getByRole('radio', { name: 'Escuro', exact: true }).waitFor();
    assert.equal(await page.getByRole('radio', { name: 'Escuro', exact: true }).isChecked(), true);
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.getByRole('checkbox', { name: 'Reduzir animações' }).check();
    await page.reload();
    await page.getByRole('checkbox', { name: 'Reduzir animações' }).waitFor();
    assert.equal(await page.locator('html').getAttribute('data-reduce-motion'), 'true');
    await page.screenshot({ path: path.resolve(__dirname, '../output/playwright/settings-dark.png'), fullPage: true });
    await page.getByRole('radio', { name: 'Claro', exact: true }).check();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    await page.getByRole('radio', { name: 'Usar tema do sistema' }).check();
    assert.equal(await page.locator('html').getAttribute('data-theme'), null);
    await page.emulateMedia({ colorScheme: 'dark' });
    assert.equal(await page.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--background').trim()), '#11100f');
    await page.emulateMedia({ colorScheme: 'light' });
    assert.equal(await page.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--background').trim()), '#f5f6f8');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    console.log('OK settings: light/dark/system, system changes, persisted theme and reduced motion');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
