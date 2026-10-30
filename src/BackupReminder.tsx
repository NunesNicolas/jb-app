import { useEffect, useState } from 'react';
import { getBackupStatus, postponeBackupReminder } from './data/api';
import Link from './compat/link';

export default function BackupReminder() {
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { getBackupStatus().then(status => setVisible(status.reminderDue)).catch(() => setError('Não foi possível consultar o lembrete de backup.')); }, []);
  if (!visible && !error) return null;
  return <aside className="backup-reminder" aria-label="Lembrete de backup">
    <div><strong>Guarde uma cópia das suas obras</strong><p>Seus dados estão neste aparelho. Exporte um backup para poder recuperá-los.</p>{error && <p role="status">{error}</p>}</div>
    <Link href="/settings">Fazer backup</Link>
    <button type="button" onClick={async () => { try { await postponeBackupReminder(); setError(''); setVisible(false); } catch { setError('Não foi possível adiar o lembrete.'); } }}>Lembrar amanhã</button>
  </aside>;
}
