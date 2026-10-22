import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

function safeFilename(filename: string) { return filename.replace(/[^\p{L}\p{N}._-]/gu, '_'); }

export async function saveTextFile(content: string, filename: string, mimeType = 'text/csv;charset=utf-8') {
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({ path: `exports/${Date.now()}-${safeFilename(filename)}`, directory: Directory.Cache, data: content, encoding: Encoding.UTF8, recursive: true });
    await Share.share({ title: filename, files: [uri], dialogTitle: 'Salvar arquivo' });
    return;
  }
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function installNativeFileLinks() {
  if (!Capacitor.isNativePlatform()) return;
  document.addEventListener('click', event => {
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="data:"]') : null;
    if (!link) return;
    event.preventDefault();
    const match = link.href.match(/^data:(image\/(?:png|jpeg|webp|gif)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return;
    const filename = link.download || `anexo.${match[1].split('/')[1]}`;
    void (async () => {
      const { uri } = await Filesystem.writeFile({ path: `exports/${Date.now()}-${safeFilename(filename)}`, directory: Directory.Cache, data: match[2], recursive: true });
      await Share.share({ title: filename, files: [uri], dialogTitle: 'Abrir ou salvar anexo' });
    })().catch(error => window.alert(error instanceof Error ? error.message : 'Não foi possível abrir o arquivo.'));
  });
}
