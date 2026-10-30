const { chromium } = require('../../jb-web-frontend/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
  const page = await browser.newPage({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true });
  const base = process.env.JB_TEST_URL || 'http://127.0.0.1:5174';
  const button = name => page.getByRole('button', { name, exact: true });
  const goto = async route => { await page.goto(`${base}/#${route}`); await page.locator('h1').waitFor(); };
  const rows = async () => page.evaluate(async () => (await fetch('/api/works')).json());
  // Inject at the persistence boundary, not at fetch (the app's API is local).
  const failNextWrite = () => page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      IDBObjectStore.prototype.put = original;
      throw new DOMException('Simulated full storage', 'QuotaExceededError');
    };
  });
  try {
    await goto('/works/new');
    await page.getByRole('textbox', { name: 'Nome da obra', exact: true }).fill('Obra fictícia original');
    await page.getByRole('textbox', { name: 'Endereço', exact: true }).fill('Rua de teste, 10');
    await button('Salvar obra').click(); await page.waitForURL(/#\/works\/[a-f0-9-]+$/);
    const work = (await rows())[0];
    await goto('/dashboard'); await failNextWrite();
    await button('Lembrar amanhã').click();
    await page.getByText('Não foi possível adiar o lembrete.').waitFor();
    await button('Lembrar amanhã').click();
    await page.getByRole('complementary', { name: 'Lembrete de backup' }).waitFor({ state: 'hidden' });
    console.log('OK reminder recovers after a failed write');

    await goto('/settings');
    const downloaded = page.waitForEvent('download'); await button('Exportar backup').click();
    const backup = await fs.readFile(await (await downloaded).path());
    await failNextWrite(); await button('Já salvei o arquivo').click();
    await page.getByRole('status').filter({ hasText: 'Não foi possível registrar' }).waitFor();
    assert.match(await page.getByTestId('last-backup').innerText(), /Nenhuma cópia/);
    await button('Já salvei o arquivo').click();
    await page.getByText('Os registros atuais estão incluídos nessa cópia.').waitFor();
    await page.evaluate(async uuid => { await fetch(`/api/works/${uuid}`, { method: 'PATCH', body: JSON.stringify({ name: 'Obra fictícia alterada' }) }); }, work.uuid);
    await page.reload(); await page.getByText('Há alterações posteriores ao último backup.').waitFor();
    const select = () => page.getByLabel('Arquivo de backup').setInputFiles({ name: 'backup-teste.json', mimeType: 'application/json', buffer: backup });
    await select(); await page.getByText('backup-teste.json', { exact: true }).waitFor();
    await page.getByRole('checkbox', { name: /Confirmo que quero substituir/ }).check(); await button('Cancelar restauração').click();
    assert.equal((await rows())[0].name, 'Obra fictícia alterada');
    assert.equal(await button('Restaurar dados').count(), 0);
    await select(); assert.equal(await button('Restaurar dados').isDisabled(), true);
    await page.getByRole('checkbox', { name: /Confirmo que quero substituir/ }).check(); await failNextWrite(); await button('Restaurar dados').click();
    await page.getByRole('status').filter({ hasText: 'Os dados atuais foram preservados' }).waitFor();
    assert.equal((await rows())[0].name, 'Obra fictícia alterada');
    await page.reload(); await page.locator('h1').waitFor();
    assert.equal((await rows())[0].name, 'Obra fictícia alterada');
    await select(); await page.getByRole('checkbox', { name: /Confirmo que quero substituir/ }).check(); await button('Restaurar dados').click();
    await page.waitForURL(/#\/dashboard$/); await page.reload(); await page.locator('h1').waitFor();
    assert.equal((await rows())[0].name, 'Obra fictícia original');
    console.log('OK backup confirmation retry, pending edits, cancellation, failed restore preserves durable data and successful restore replaces it');

    await goto(`/works/${work.uuid}`);
    await button('Adicionar gasto').first().click();
    const dialog = page.getByRole('dialog', { name: 'Adicionar gasto' });
    const name = dialog.getByRole('textbox', { name: 'Nome', exact: true });
    await name.fill('Material de teste');
    await dialog.getByRole('textbox', { name: 'Valor', exact: true }).fill('5500');
    // Reduced viewport exercises internal scrolling; it does not emulate the native keyboard.
    await page.setViewportSize({ width: 640, height: 360 });
    const save = dialog.getByRole('button', { name: 'Adicionar gasto', exact: true });
    await save.scrollIntoViewIfNeeded();
    const bounds = await save.boundingBox(); assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 360);
    await save.click(); await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(async () => (await (await fetch('/api/expenses')).json())[0].amount), 55);
    console.log('OK expense form remains operable in a short landscape viewport');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
