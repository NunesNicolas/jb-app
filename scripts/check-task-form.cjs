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
      await page.goto(`${process.env.JB_TEST_URL || 'http://127.0.0.1:5174'}/#/tasks`);
      const open = () => page.getByRole('button', { name: 'Criar tarefa', exact: true }).first().click();
      await open();
      const dialog = page.getByRole('dialog', { name: 'Criar tarefa' });
      const title = dialog.getByRole('textbox', { name: 'Título', exact: true });
      await title.fill('  Conferir instalação elétrica  ');
      await page.evaluate(() => {
        window.originalTaskFetch = window.fetch;
        window.taskPostCount = 0;
        window.fetch = (url, init) => {
          if (url === '/api/tasks' && init?.method === 'POST') {
            window.taskPostCount++;
            return new Promise((resolve, reject) => { window.rejectTaskSave = () => reject(new Error('Simulated failure')); });
          }
          return window.originalTaskFetch(url, init);
        };
        const form = document.querySelector('[role="dialog"] form');
        form.requestSubmit(); form.requestSubmit();
      });
      assert.equal(await page.evaluate(() => window.taskPostCount), 1);
      assert.equal(await title.isDisabled(), true);
      assert.equal(await dialog.getByRole('button', { name: 'Fechar', exact: true }).isDisabled(), true);
      await page.keyboard.press('Escape'); assert.equal(await dialog.isVisible(), true);
      await page.evaluate(() => window.rejectTaskSave());
      await dialog.getByRole('alert').waitFor();
      assert.match(await dialog.getByRole('alert').innerText(), /Seus campos foram mantidos/);
      assert.equal(await title.inputValue(), '  Conferir instalação elétrica  ');
      assert.equal(await title.isEnabled(), true);
      const output = path.resolve(__dirname, '../output/playwright'); await fs.mkdir(output, { recursive: true });
      await dialog.screenshot({ path: path.join(output, `task-form-error-${width}.png`) });
      await page.evaluate(() => { window.fetch = window.originalTaskFetch; });
      await dialog.getByRole('button', { name: 'Criar tarefa', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      const records = await page.evaluate(async () => (await (await fetch('/api/tasks')).json()));
      assert.equal(records.length, 1); assert.equal(records[0].title, 'Conferir instalação elétrica');
      await open(); assert.equal(await title.inputValue(), '');
      await title.fill('Rascunho de teste');
      await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await open(); assert.equal(await title.inputValue(), 'Rascunho de teste');
      assert.equal(await dialog.getByRole('alert').count(), 0);
      await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
      await dialog.screenshot({ path: path.join(output, `task-form-dark-${width}.png`) });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      console.log(`OK task form ${width}: duplicate submission blocked, pending close blocked, error recovery, retry, draft cancellation and layout`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
