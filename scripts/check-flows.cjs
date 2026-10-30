const { chromium } = require('../../jb-web-frontend/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
  const page = await browser.newPage({ viewport: { width: Number(process.env.JB_TEST_WIDTH || 1280), height: 900 } });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const base = process.env.JB_TEST_URL || 'http://127.0.0.1:5174';
  const goto = async route => {
    await page.goto(`${base}/#${route}`);
    await page.locator('h1').waitFor();
  };
  const records = async path => page.evaluate(async path => (await fetch(`/api${path}`)).json(), path);
  const button = name => page.getByRole('button', { name, exact: true });
  const choose = async (scope, label, option) => {
    await scope.getByRole('combobox', { name: label, exact: true }).click();
    await page.getByRole('option', { name: option, exact: true }).click();
  };
  try {
    await goto('/works/new');
    await page.getByRole('textbox', { name: 'Nome da obra', exact: true }).fill('Obra revisão');
    await page.getByRole('textbox', { name: 'Endereço', exact: true }).fill('Rua Um, 10');
    await button('Salvar obra').click();
    await page.waitForURL(/#\/works\/[a-f0-9-]+$/);
    const work = (await records('/works'))[0];
    await button('Dados').click();
    await page.getByRole('textbox', { name: 'Nome', exact: true }).fill('Obra revisada');
    await button('Salvar alterações').click();
    await page.getByRole('heading', { name: 'Obra revisada', exact: true }).waitFor();
    assert.equal((await records(`/works/${work.uuid}`)).name, 'Obra revisada');
    console.log('OK create and edit work');

    const quickActions = page.getByRole('navigation', { name: 'Ações rápidas da obra' });
    for (const [action, title] of [['Nova tarefa', 'Criar tarefa'], ['Adicionar gasto', 'Adicionar gasto']]) {
      await quickActions.getByRole('button', { name: action, exact: true }).click();
      const quickDialog = page.getByRole('dialog', { name: title, exact: true });
      await quickDialog.waitFor();
      await quickDialog.getByRole('button', { name: 'Fechar', exact: true }).click();
      await quickDialog.waitFor({ state: 'hidden' });
    }

    await button('Financeiro').click();
    const output = path.resolve(__dirname, '../output/playwright');
    await fs.mkdir(output, { recursive: true });
    await page.locator('.financial-layout').screenshot({ path: path.join(output, `work-financial-${process.env.JB_TEST_WIDTH || 1280}.png`) });
    await button('Adicionar gasto').first().click();
    let dialog = page.getByRole('dialog', { name: 'Adicionar gasto' });
    await dialog.getByRole('textbox', { name: 'Nome', exact: true }).fill('Cimento');
    await dialog.getByRole('textbox', { name: 'Valor', exact: true }).fill('25000');
    await dialog.getByRole('button', { name: 'Adicionar gasto', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal((await records('/expenses'))[0].amount, 250);
    console.log('OK expense creation and decimal amount');

    await page.locator('.tabs-nav').getByRole('button', { name: 'Tarefas', exact: true }).click();
    await page.locator('.work-task-panel').screenshot({ path: path.join(output, `work-tasks-${process.env.JB_TEST_WIDTH || 1280}.png`) });
    await button('Nova tarefa').first().click();
    dialog = page.getByRole('dialog', { name: 'Criar tarefa' });
    await dialog.getByRole('textbox', { name: 'Título', exact: true }).fill('Conferir material');
    await dialog.getByRole('button', { name: 'Criar tarefa', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal((await records('/tasks'))[0].title, 'Conferir material');
    await button('Resumo').click();
    const pending = page.getByRole('region', { name: 'Tarefas pendentes da obra' });
    assert.match(await pending.innerText(), /Conferir material/);
    const summaryTabs = page.getByRole('tablist', { name: 'Resumo da obra', exact: true });
    await summaryTabs.getByRole('tab', { name: /Tarefas/ }).focus();
    await page.keyboard.press('ArrowRight');
    const expensePanel = page.getByRole('tabpanel', { name: /Gastos/ });
    await expensePanel.waitFor();
    assert.equal(await pending.isVisible(), false);
    assert.deepEqual(await expensePanel.locator('thead th').allTextContents(), ['Data', 'Gasto', 'Categoria', 'Valor']);
    assert.match(await expensePanel.getByRole('row', { name: /Cimento/ }).innerText(), /250,00/);
    assert.doesNotMatch(await expensePanel.innerText(), /Conferir material/);
    await expensePanel.screenshot({ path: path.join(output, `summary-expenses-${process.env.JB_TEST_WIDTH || 1280}.png`) });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await summaryTabs.getByRole('tab', { name: /Gastos/ }).focus();
    await page.keyboard.press('Home');
    await pending.waitFor();
    assert.equal(await expensePanel.isVisible(), false);
    await pending.getByRole('button', { name: 'Ver tarefas (1)', exact: true }).click();
    await page.getByRole('heading', { name: 'Quadro de tarefas', exact: true }).waitFor();
    await quickActions.screenshot({ path: path.join(output, `field-actions-${process.env.JB_TEST_WIDTH || 1280}.png`) });
    await goto('/tasks');
    await button('Ações de Conferir material').click();
    page.once('dialog', dialog => dialog.dismiss());
    await button('Remover').click();
    assert.equal((await records('/tasks')).length, 1);
    await button('Avançar').click();
    await page.waitForFunction(async () => (await (await fetch('/api/tasks')).json())[0].status === 'in_progress');
    console.log('OK task creation, movement and cancelled deletion');

    await goto(`/works/${work.uuid}`);
    await button('Financeiro').click();
    await button('Registrar receita').first().click();
    dialog = page.getByRole('dialog', { name: 'Registrar receita' });
    await dialog.getByRole('textbox', { name: 'Nome', exact: true }).fill('Entrada');
    await dialog.getByRole('textbox', { name: 'Valor', exact: true }).fill('1.250,90');
    await dialog.getByRole('button', { name: 'Registrar receita', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal((await records('/revenues'))[0].amount, 1250.9);
    console.log('OK revenue creation');

    await quickActions.getByLabel('Adicionar foto à obra', { exact: true }).setInputFiles({
      name: 'photo.png', mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'),
    });
    await page.getByRole('link', { name: 'Baixar foto' }).waitFor();
    await page.reload();
    await button('Progresso').click();
    const photoDownload = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Baixar foto' }).click();
    assert.ok((await fs.readFile(await (await photoDownload).path())).length > 0);
    console.log('OK progress photo upload, reload and download');

    await goto(`/works/${work.uuid}/expenses`);
    const csv = 'Nome;Tipo;Valor;Descrição\nAreia;Material;50,25;Teste';
    await page.locator('input[type=file]').setInputFiles({ name: 'gastos.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await button('Confirmar importação de 1 gastos').click();
    await page.getByText(/Importação concluída/).waitFor();
    assert.equal((await records('/expenses')).length, 2);
    const csvDownload = page.waitForEvent('download');
    await button('Exportar gastos (CSV)').click();
    assert.match(await fs.readFile(await (await csvDownload).path(), 'utf8'), /Areia/);
    console.log('OK CSV import and export');

    await goto('/dashboard');
    await page.locator('.dashboard-companies > summary').click();
    await page.getByRole('textbox', { name: 'Nova empresa' }).fill('Empresa teste');
    await button('Criar empresa').click();
    await page.waitForURL(/#\/groups\/[a-f0-9-]+$/);
    await choose(page, 'Adicionar obra', 'Obra revisada');
    await button('Adicionar').click();
    await page.getByRole('link', { name: 'Abrir', exact: true }).waitFor();
    await page.getByRole('textbox', { name: 'Nome da empresa' }).fill('Empresa revisada');
    await button('Salvar nome').click();
    await page.getByRole('heading', { name: 'Empresa revisada', exact: true }).waitFor();
    await button('Remover').click();
    await page.getByText('Nenhuma obra foi liberada para esta empresa ainda.').waitFor();
    assert.equal((await records('/works')).length, 1);
    console.log('OK company create, link, rename and unlink without deleting work');

    await goto('/settings');
    const backupDownload = page.waitForEvent('download');
    await button('Exportar backup').click();
    const backupPath = await (await backupDownload).path();
    const backup = await fs.readFile(backupPath);
    await page.getByLabel('Arquivo de backup').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
    await page.getByRole('status').waitFor();
    assert.equal(await button('Restaurar dados').count(), 0);
    assert.equal((await records('/works')).length, 1);
    await page.getByLabel('Arquivo de backup').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup });
    await button('Restaurar dados').waitFor();
    assert.equal(await button('Restaurar dados').isDisabled(), true);
    await page.getByRole('checkbox', { name: /Confirmo que quero substituir/ }).check();
    await button('Restaurar dados').click();
    await page.waitForURL(/#\/dashboard$/);
    await page.reload();
    await page.getByRole('heading', { name: 'Suas obras', exact: true }).waitFor();
    assert.equal((await records('/expenses')).length, 2);
    assert.equal((await records('/tasks')).length, 1);
    console.log('OK backup export, invalid file rejection, confirmation, restore and reload');

    await goto(`/works/${work.uuid}`);
    await button('Dados').click();
    page.once('dialog', dialog => dialog.dismiss());
    await button('Remover obra').click();
    assert.equal((await records('/works')).length, 1);
    await page.evaluate(() => {
      window.savedFetch = window.fetch;
      window.fetch = async () => { throw new TypeError('Simulated failure'); };
    });
    await button('Salvar alterações').click();
    await page.getByText('Não foi possível confirmar a operação. Confira os registros antes de tentar novamente.').waitFor();
    assert.equal(await button('Salvar alterações').isEnabled(), true);
    await page.evaluate(() => { window.fetch = window.savedFetch; });
    console.log('OK cancelled work deletion and edit failure recovery');

    await button('Financeiro').click();
    await button('Registrar receita').first().click();
    dialog = page.getByRole('dialog', { name: 'Registrar receita' });
    await choose(dialog, 'Tipo', 'Aluguel');
    await dialog.getByRole('textbox', { name: 'Valor', exact: true }).fill('100');
    await dialog.getByLabel('Início', { exact: true }).fill('2026-01-01');
    await dialog.getByLabel('Fim do contrato').fill('2026-03-01');
    await page.evaluate(() => {
      let calls = 0;
      window.fetch = (url, options) => {
        if (url === '/api/revenues' && options?.method === 'POST' && ++calls === 2)
          return Promise.reject(new TypeError('Simulated partial failure'));
        return window.savedFetch(url, options);
      };
    });
    await dialog.getByRole('button', { name: 'Registrar receita', exact: true }).click();
    await dialog.getByText(/2 de 3 receitas confirmadas/).waitFor();
    assert.equal(await dialog.getByRole('button', { name: 'Registrar receita', exact: true }).isDisabled(), true);
    assert.equal((await records('/revenues')).length, 3);
    await page.evaluate(() => { window.fetch = window.savedFetch; });
    console.log('OK partial rent failure reports confirmed entries and blocks duplicate retry');

    for (const route of ['/reports', '/calendar', '/map']) {
      await goto(route);
      assert.ok(await page.locator('h1').innerText());
    }
    assert.deepEqual(errors, []);
    console.log('OK reports, calendar, addresses and no uncaught browser errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
