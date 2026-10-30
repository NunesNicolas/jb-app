const { spawn } = require('node:child_process');
const path = require('node:path');

(async () => {
  const { preview } = await import('vite');
  const server = await preview({ root: path.resolve(__dirname, '..'), preview: { host: '127.0.0.1', port: 5175, strictPort: true } });
  try {
    for (const [script, width] of [['check-settings.cjs', 390], ['check-reports-calendar.cjs', 1280], ['check-work-form.cjs', 1280], ['check-flows.cjs', 1280], ['check-flows.cjs', 390], ['check-backup-mobile.cjs', 390], ['check-mobile-recovery.cjs', 360], ['check-dashboard.cjs', 360], ['check-task-form.cjs', 360]]) {
      console.log(`\n${script} (${width}px)`);
      await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(__dirname, script)], { stdio: 'inherit', env: { ...process.env, JB_TEST_URL: 'http://127.0.0.1:5175', JB_TEST_WIDTH: String(width) } });
        child.on('error', reject);
        child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${script}: exit ${code}`)));
      });
    }
  } finally { await new Promise(resolve => server.httpServer.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
