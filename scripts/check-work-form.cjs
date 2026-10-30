// Run against an isolated browser profile; all records remain in that profile.
const { chromium } = require('../../jb-web-frontend/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
  try {
    const page = await browser.newPage();
    const base = process.env.JB_TEST_URL || 'http://127.0.0.1:5174';
    await page.goto(`${base}/#/works/new`);
    const name = page.getByRole('textbox', { name: 'Nome da obra', exact: true });
    await name.fill('Obra sem orçamento');
    await page.getByRole('textbox', { name: 'Endereço', exact: true }).fill('Rua de teste, 10');
    await page.getByRole('button', { name: 'Salvar obra', exact: true }).click();
    await page.waitForURL(/#\/works\/[a-f0-9-]+$/);
    console.log('OK create without budget');

    await page.goto(`${base}/#/works/new`);
    await name.fill('Obra com falha');
    await page.getByRole('textbox', { name: 'Endereço', exact: true }).fill('Rua de teste, 20');
    await page.evaluate(() => {
      window.originalFetchForTest = window.fetch;
      window.fetch = async () => { throw new TypeError('Simulated failure'); };
    });
    await page.getByRole('button', { name: 'Salvar obra', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Confira a lista de obras' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Salvar obra', exact: true }).isEnabled(), true);
    assert.equal(await name.inputValue(), 'Obra com falha');
    console.log('OK save failure retains form and releases button');

    await page.evaluate(() => {
      window.fetch = () => new Promise((_, reject) => { window.rejectUploadForTest = reject; });
    });
    await page.locator('input[type=file]').setInputFiles({
      name: 'photo.png', mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'),
    });
    await page.getByRole('status').filter({ hasText: 'Enviando foto' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Aguarde a foto…', exact: true }).isDisabled(), true);
    await page.waitForFunction(() => typeof window.rejectUploadForTest === 'function');
    await page.evaluate(() => window.rejectUploadForTest(new TypeError('Simulated upload failure')));
    await page.getByRole('alert').filter({ hasText: 'Não foi possível enviar a foto' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Salvar obra', exact: true }).isEnabled(), true);
    console.log('OK upload blocks save and recovers after failure');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
