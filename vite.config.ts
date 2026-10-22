import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const path = (value: string) => fileURLToPath(new URL(value, import.meta.url));
export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'local-content-policy',
    apply: 'build',
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'" }, injectTo: 'head-prepend' }];
    },
  }],
  publicDir: '../jb-web-frontend/public',
  resolve: {
    dedupe: ['react', 'react-dom', 'lucide-react', 'leaflet', 'react-leaflet'],
    alias: [
      { find: '@/lib/runtime', replacement: path('./src/runtime.ts') },
      { find: '@/lib/save-file', replacement: path('./src/save-file.ts') },
      { find: '@/lib/server-api', replacement: path('./src/data/api.ts') },
      { find: '@/components/WorkLocationPicker', replacement: path('./src/components/LocalLocationPicker.tsx') },
      { find: '@/components/WorksMap', replacement: path('./src/components/LocalWorksMap.tsx') },
      { find: 'next/router', replacement: path('./src/compat/router.tsx') },
      { find: 'next/link', replacement: path('./src/compat/link.tsx') },
      { find: 'next/head', replacement: path('./src/compat/head.tsx') },
      { find: 'next/dynamic', replacement: path('./src/compat/dynamic.tsx') },
      { find: '@', replacement: path('../jb-web-frontend/src') },
    ],
  },
  server: { fs: { allow: [path('..')] } },
  ssr: { noExternal: ['lucide-react'] },
});
