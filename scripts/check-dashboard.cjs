const { chromium } = require('../../jb-web-frontend/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
  try {
    for (const width of [1280, 360]) {
      const context = await browser.newContext({ viewport: { width, height: 800 } });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${process.env.JB_TEST_URL || 'http://127.0.0.1:5174'}/#/dashboard`);
      await page.locator('h1').waitFor();
      await page.evaluate(async () => {
        const create = async (route, body) => {
          const response = await fetch(`/api/${route}`, { method: 'POST', body: JSON.stringify(body) });
          if (!response.ok) throw new Error('Fixture failed');
          return response.json();
        };
        for (const [name, budget, spent, status] of [['São João', 1000, 1250, 'in_progress'], ['Árvore', 1000, 1000, 'planning'], ['Zênite', 0, 2000, 'planning']]) {
          const work = await create('works', { name, address: 'Praça de teste, 1', estimatedPrice: budget, status });
          await create('expenses', { name: 'Material fictício', workUuid: work.uuid, amount: spent, type: 'material' });
        }
      });
      await page.reload(); await page.locator('.work-list-card').first().waitFor();
      assert.ok(await page.evaluate(() => Boolean(document.querySelector('.portfolio-summary').compareDocumentPosition(document.querySelector('.works-list')) & Node.DOCUMENT_POSITION_FOLLOWING)), 'Summary precedes work list');
      const companies = page.locator('.dashboard-companies');
      assert.equal(await companies.getAttribute('open'), null);
      await companies.locator('summary').focus();
      await page.keyboard.press('Enter');
      assert.equal(await companies.getByRole('textbox', { name: 'Nova empresa' }).isVisible(), true);
      await companies.locator('summary').click();
      const cards = page.locator('.work-list-card');
      const search = page.getByRole('searchbox', { name: 'Buscar obra' });
      await search.fill('sao joao'); assert.equal(await cards.count(), 1);
      assert.match(await cards.first().innerText(), /250,00 acima do orçamento/);
      await search.fill('praca'); assert.equal(await cards.count(), 3);
      await search.fill('');
      const choose = async (label, option) => {
        await page.getByRole('combobox', { name: label, exact: true }).click();
        await page.getByRole('option', { name: option, exact: true }).click();
      };
      await choose('Ordenar obras', 'Nome de A a Z');
      assert.deepEqual(await cards.locator('h3').allTextContents(), ['Árvore', 'São João', 'Zênite']);
      await choose('Ordenar obras', 'Maior gasto');
      assert.deepEqual(await cards.locator('h3').allTextContents(), ['Zênite', 'São João', 'Árvore']);
      assert.match(await cards.first().innerText(), /Não definido/);
      await page.getByRole('checkbox', { name: /Somente acima do orçamento/ }).check();
      assert.deepEqual(await cards.locator('h3').allTextContents(), ['São João']);
      await choose('Situação da obra', 'Planejamento');
      await page.getByRole('heading', { name: 'Nenhuma obra encontrada.' }).waitFor();
      await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
      assert.equal(await cards.count(), 3);
      assert.equal(await page.getByRole('checkbox').isChecked(), false);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
      const output = path.resolve(__dirname, '../output/playwright'); await fs.mkdir(output, { recursive: true });
      await page.locator('h1').click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(output, `dashboard-${width}.png`), fullPage: true });
      await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
      await page.screenshot({ path: path.join(output, `dashboard-dark-${width}.png`), fullPage: true });
      assert.deepEqual(errors, []);
      console.log(`OK dashboard ${width}: accent-insensitive search, sorting, budget boundaries, combined filters and clearing`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
