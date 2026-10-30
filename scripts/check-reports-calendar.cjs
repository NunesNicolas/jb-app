const { chromium } = require('../../jb-web-frontend/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
  try {
    for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'America/Sao_Paulo' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const goto = async route => {
        await page.goto(`${process.env.JB_TEST_URL || 'http://127.0.0.1:5175'}/#${route}`);
        await page.locator('h1').waitFor();
      };
      const choose = async option => {
        await page.getByRole('combobox').click();
        await page.getByRole('option', { name: option, exact: true }).click();
      };
      await goto('/reports');
      assert.match(await page.locator('.report-metrics-grid').innerText(), /0 pendentes/);
      const fixture = await page.evaluate(async () => {
        const create = async (route, body) => {
          const response = await fetch(`/api/${route}`, { method: 'POST', body: JSON.stringify(body) });
          if (!response.ok) throw new Error(`Fixture failed: ${route}`);
          return response.json();
        };
        const month = new Date().toISOString().slice(0, 7);
        const a = await create('works', { name: 'Obra Alfa teste', address: 'Rua fictícia Alfa, 10', estimatedPrice: 1000 });
        const b = await create('works', { name: 'Obra Beta teste', address: 'Rua fictícia Beta, 20', estimatedPrice: 2000 });
        await create('expenses', { workUuid: a.uuid, name: 'Material Alfa', amount: 125.25, type: 'material' });
        await create('expenses', { workUuid: b.uuid, name: 'Serviço Beta', amount: 250.5, type: 'labor' });
        await create('revenues', { workUuid: a.uuid, name: 'Entrada Alfa', amount: 500.75, type: 'sale', receivedAt: `${month}-15` });
        await create('tasks', { workUuid: a.uuid, title: 'Prazo Alfa', dueDate: `${month}-15`, status: 'todo' });
        await create('tasks', { workUuid: b.uuid, title: 'Prazo Beta', dueDate: `${month}-15`, status: 'done' });
        return { a, month };
      });
      await page.reload();
      await page.getByText('1 pendentes', { exact: true }).waitFor();
      const totals = () => page.locator('.report-metrics-grid article > strong').allTextContents();
      const normalize = values => values.map(value => value.replace(/\s/g, ''));
      assert.deepEqual(normalize(await totals()), ['R$3.000,00', 'R$375,75', 'R$500,75', '1pendentes']);
      await choose('Obra Alfa teste');
      assert.deepEqual(normalize(await totals()), ['R$1.000,00', 'R$125,25', 'R$500,75', '1pendentes']);
      assert.match((await page.locator('.report-metrics-grid').innerText()).replace(/\s/g, ''), /SaldoR\$375,50/);
      assert.deepEqual(await page.locator('.report-table strong').allTextContents(), ['Material Alfa']);
      await choose('Obra Beta teste');
      assert.deepEqual(normalize(await totals()), ['R$2.000,00', 'R$250,50', 'R$0,00', '0pendentes']);
      await choose('Todas as obras');
      assert.equal(await page.locator('.report-table strong').count(), 2);

      await goto('/calendar');
      const agenda = page.locator('.calendar-side-panel');
      assert.match(await agenda.innerText(), /Prazo Alfa/);
      assert.doesNotMatch(await agenda.innerText(), /Prazo Beta/);
      const days = page.locator(width < 768 ? '.mobile-day-strip' : '.calendar-grid');
      const day = days.getByRole('button', { name: /15 de .*2 tarefas/ });
      await day.click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      assert.match(await dialog.innerText(), /Prazo Alfa/);
      assert.match(await dialog.innerText(), /Prazo Beta/);
      await page.getByRole('button', { name: 'Fechar', exact: true }).click();
      await choose('Obra Beta teste');
      assert.match(await agenda.innerText(), /Nenhum prazo pendente/);
      await days.getByRole('button', { name: /15 de .*1 tarefas/ }).click();
      await dialog.waitFor();
      assert.doesNotMatch(await dialog.innerText(), /Prazo Alfa/);
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      const monthTitle = await page.locator('.calendar-toolbar h2').innerText();
      await page.getByRole('button', { name: 'Próximo', exact: true }).click();
      assert.notEqual(await page.locator('.calendar-toolbar h2').innerText(), monthTitle);
      await page.getByRole('button', { name: 'Hoje', exact: true }).click();
      assert.equal(await page.locator('.calendar-toolbar h2').innerText(), monthTitle);

      await goto('/map');
      const addresses = page.locator('.panel');
      await addresses.getByText('Rua fictícia Alfa, 10', { exact: true }).waitFor();
      assert.match(await addresses.innerText(), /Rua fictícia Beta, 20/);
      await addresses.getByRole('link', { name: 'Obra Alfa teste', exact: true }).click();
      await page.waitForURL(`**/#/works/${fixture.a.uuid}`);
      await page.getByRole('heading', { name: 'Obra Alfa teste', exact: true }).waitFor();
      assert.deepEqual(errors, []);
      console.log(`OK reports/calendar/addresses ${width}: totals, work filters, deadlines, modal, month navigation and address links`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
