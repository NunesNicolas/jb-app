import { useEffect, useRef, useState } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { AppearanceSettings } from '@/components/AppearanceSettings';
import { confirmBackup, exportBackup, getBackupStatus, inspectBackup, restoreBackup } from '../data/api';
import type { BackupStatus } from '../data/store';
import { saveTextFile } from '../save-file';
import { navigate } from '../compat/router';

export default function Settings() {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [exported, setExported] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [messageTarget, setMessageTarget] = useState<'export' | 'restore'>('export');
  const [candidate, setCandidate] = useState<{ text: string; name: string; counts: Record<string, number> } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => { getBackupStatus().then(setStatus).catch(() => setMessage('Não foi possível consultar a data do backup.')); }, []);
  async function saveBackup() {
    if (running.current) return;
    running.current = true;
    setExported(null);
    setMessageTarget('export');
    setBusy(true); setMessage('');
    try {
      const text = await exportBackup();
      await saveTextFile(text, `jb-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, 'application/json');
      setExported(text);
      setMessage('Arquivo preparado. Guarde o backup fora do armazenamento interno do app.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao exportar backup.'); }
    finally { running.current = false; setBusy(false); }
  }
  async function confirmSaved() {
    if (!exported || running.current) return;
    setMessageTarget('export');
    running.current = true; setBusy(true);
    try {
      await confirmBackup(exported);
      setStatus(await getBackupStatus()); setExported(null);
      setMessage('Cópia salva confirmada. A data corresponde aos dados exportados.');
    } catch { setMessage('Não foi possível registrar a confirmação. Seu arquivo de backup continua válido.'); }
    finally { running.current = false; setBusy(false); }
  }
  async function selectBackup(file?: File) {
    if (running.current) return;
    setMessageTarget('restore');
    setCandidate(null); setConfirmed(false); setMessage('');
    if (!file) return;
    running.current = true;
    setBusy(true);
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error('O backup deve ter até 100 MB.');
      const text = await file.text();
      setCandidate({ text, name: file.name, counts: inspectBackup(text) });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Arquivo inválido.'); }
    finally { running.current = false; setBusy(false); }
  }
  async function restore() {
    if (!candidate || !confirmed || running.current) return;
    setMessageTarget('restore');
    running.current = true;
    setBusy(true); setMessage('');
    try { await restoreBackup(candidate.text); await navigate('/dashboard', true); }
    catch { setMessage('Não foi possível restaurar. Os dados atuais foram preservados. Tente novamente antes de sair desta tela.'); }
    finally { running.current = false; setBusy(false); }
  }
  return <main className="dashboard-page backup-page">
    <AppSidebar subtitle="Configurações" />
    <section className="dashboard-hero"><div><h1>Configurações</h1><p>Personalize o JB e cuide dos dados deste aparelho.</p></div></section>
    <AppearanceSettings />
    <section className="dashboard-hero"><div><span className="eyebrow">Neste aparelho</span><h2>Dados e backup</h2><p>Suas obras, tarefas, lançamentos e anexos ficam salvos localmente, sem conta ou sincronização.</p></div></section>
    <section className="work-form-panel"><h2>Exportar seus dados</h2><p>O backup inclui todos os registros e anexos. Salve uma cópia em uma pasta de sua escolha antes de trocar de aparelho ou desinstalar o app.</p><button type="button" disabled={busy} onClick={saveBackup}>Exportar backup</button>
      {exported && <div className="backup-confirmation"><p>Confira se o arquivo foi salvo fora do app. Se cancelou o compartilhamento, exporte novamente.</p><button type="button" disabled={busy} onClick={confirmSaved}>Já salvei o arquivo</button></div>}
      {message && messageTarget === 'export' && <p className="form-alert" role="status">{message}</p>}
    </section>
    <section className="work-form-panel backup-status" aria-label="Situação do backup">
      <h2>Última cópia salva</h2>
      <p data-testid="last-backup">{status ? status.savedAt ? new Date(status.savedAt).toLocaleString('pt-BR') : 'Nenhuma cópia confirmada neste aparelho.' : 'Consultando…'}</p>
      {status?.savedAt && <p>{status.hasChanges ? 'Há alterações posteriores ao último backup.' : 'Os registros atuais estão incluídos nessa cópia.'}</p>}
      <p>O JB lembra de exportar quando há registros sem backup ou alterações sem uma nova cópia há sete dias.</p>
    </section>
    <section className="work-form-panel"><h2>Restaurar um backup</h2><p>A restauração substitui os dados atuais pelos dados do arquivo. Exporte uma cópia antes de continuar.</p>
      <label>Arquivo de backup<input type="file" accept=".json,application/json" disabled={busy} onChange={event => { void selectBackup(event.target.files?.[0]); event.target.value = ''; }} /></label>
      {candidate && <div className="auth-form"><p className="backup-filename">Arquivo selecionado: <strong>{candidate.name}</strong></p><p>{candidate.counts.works} obras · {candidate.counts.tasks} tarefas · {candidate.counts.expenses} despesas · {candidate.counts.revenues} receitas · {candidate.counts.attachments} anexos</p>
        <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />Confirmo que quero substituir os dados deste aparelho pelo backup selecionado.</label>
        <button type="button" disabled={busy || !confirmed} onClick={restore}>{busy ? 'Restaurando…' : 'Restaurar dados'}</button>
        <button className="backup-cancel" type="button" disabled={busy} onClick={() => { setCandidate(null); setConfirmed(false); setMessage(''); }}>Cancelar restauração</button>
      </div>}
      {message && messageTarget === 'restore' && <p className="form-alert" role="status">{message}</p>}
    </section>
  </main>;
}
