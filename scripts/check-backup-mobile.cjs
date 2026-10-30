const { chromium } = require('../../jb-web-frontend/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const base = process.env.JB_TEST_URL || 'http://127.0.0.1:5174';
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const goto = async route => { await page.goto(`${base}/#${route}`); await page.locator('h1').waitFor(); };
  const button = name => page.getByRole('button', { name, exact: true });
  try {
    await goto('/works/new');
    await page.getByRole('textbox', { name: 'Nome da obra', exact: true }).fill('Casa de teste');
    await page.getByRole('textbox', { name: 'Endereço', exact: true }).fill('Rua fictícia, 1');
    assert.ok(await page.getByRole('textbox', { name: 'Nome da obra', exact: true }).evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 16));
    await button('Salvar obra').click();
    await page.waitForURL(/#\/works\/[a-f0-9-]+$/);
    await goto('/dashboard');
    await page.getByRole('complementary', { name: 'Lembrete de backup' }).waitFor();
    await button('Lembrar amanhã').click();
    await page.reload(); await page.locator('h1').waitFor();
    assert.equal(await page.getByRole('complementary', { name: 'Lembrete de backup' }).count(), 0);
    await goto('/settings');
    assert.match(await page.getByTestId('last-backup').innerText(), /Nenhuma cópia/);
    const download = page.waitForEvent('download'); await button('Exportar backup').click();
    const backup = await fs.readFile(await (await download).path(), 'utf8');
    await button('Já salvei o arquivo').waitFor();
    assert.match(await page.getByTestId('last-backup').innerText(), /Nenhuma cópia/);
    await button('Já salvei o arquivo').click();
    await page.getByText('Os registros atuais estão incluídos nessa cópia.').waitFor();
    await page.reload(); await page.getByText('Os registros atuais estão incluídos nessa cópia.').waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok((await button('Exportar backup').boundingBox()).height >= 44);
    const output = path.resolve(__dirname, '../output/playwright'); await fs.mkdir(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'backup-mobile.png'), fullPage: true });
    console.log('OK mobile controls, reminder postponement and explicit saved-copy confirmation');

    // Simulate an existing database before upgrading: never use the normal browser profile.
    const legacy = JSON.parse(backup).state; delete legacy.backupHistory;
    await page.evaluate(state => new Promise((resolve, reject) => {
      const request = indexedDB.open('jb-demo', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result; const tx = db.transaction('state', 'readwrite');
        tx.objectStore('state').put(JSON.stringify(state), 'current');
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
      };
    }), legacy);
    await page.reload(); await page.locator('h1').waitFor();
    assert.match(await page.getByTestId('last-backup').innerText(), /Nenhuma cópia/);
    const works = await page.evaluate(async () => (await fetch('/api/works')).json());
    assert.equal(works[0].name, 'Casa de teste');
    assert.equal(works[0].uuid, legacy.tables.works[0].uuid);
    console.log('OK current build opens previous database without losing work or identity');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
