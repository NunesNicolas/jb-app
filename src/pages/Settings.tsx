import { useState } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { exportBackup, inspectBackup, restoreBackup } from '../data/api';
import { saveTextFile } from '../save-file';
import { navigate } from '../compat/router';

export default function Settings() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [candidate, setCandidate] = useState<{ text: string; counts: Record<string, number> } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  async function saveBackup() {
    setBusy(true); setMessage('');
    try {
      await saveTextFile(await exportBackup(), `jb-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, 'application/json');
      setMessage('Arquivo preparado. Guarde o backup fora do armazenamento interno do app.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao exportar backup.'); }
    finally { setBusy(false); }
  }
  async function selectBackup(file?: File) {
    setCandidate(null); setConfirmed(false); setMessage('');
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error('O backup deve ter até 100 MB.');
      const text = await file.text();
      setCandidate({ text, counts: inspectBackup(text) });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Arquivo inválido.'); }
    finally { setBusy(false); }
  }
  async function restore() {
    if (!candidate || !confirmed || busy) return;
    setBusy(true); setMessage('');
    try { await restoreBackup(candidate.text); await navigate('/dashboard', true); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao restaurar. Os dados atuais foram preservados.'); }
    finally { setBusy(false); }
  }
  return <main className="dashboard-page">
    <AppSidebar subtitle="Dados e backup" />
    <section className="dashboard-hero"><div><span className="eyebrow">Neste aparelho</span><h1>Dados e backup</h1><p>Suas obras, tarefas, lançamentos e anexos ficam salvos localmente, sem conta ou sincronização.</p></div></section>
    <section className="work-form-panel"><h2>Exportar seus dados</h2><p>O backup inclui todos os registros e anexos. Salve uma cópia em uma pasta de sua escolha antes de trocar de aparelho ou desinstalar o app.</p><button type="button" disabled={busy} onClick={saveBackup}>Exportar backup</button></section>
    <section className="work-form-panel"><h2>Restaurar um backup</h2><p>A restauração substitui os dados atuais pelos dados do arquivo. Exporte uma cópia antes de continuar.</p>
      <label>Arquivo de backup<input type="file" accept=".json,application/json" disabled={busy} onChange={event => { void selectBackup(event.target.files?.[0]); event.target.value = ''; }} /></label>
      {candidate && <div className="auth-form"><p>{candidate.counts.works} obras · {candidate.counts.tasks} tarefas · {candidate.counts.expenses} despesas · {candidate.counts.revenues} receitas · {candidate.counts.attachments} anexos</p>
        <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />Confirmo que quero substituir os dados deste aparelho pelo backup selecionado.</label>
        <button type="button" disabled={busy || !confirmed} onClick={restore}>{busy ? 'Restaurando…' : 'Restaurar dados'}</button>
      </div>}
    </section>
    {message && <p className="form-alert" role="status">{message}</p>}
  </main>;
}
