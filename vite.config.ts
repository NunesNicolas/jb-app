import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const path = (value: string) => fileURLToPath(new URL(value, import.meta.url));
export default defineConfig({
  plugins: [react(), tailwindcss()],
  publicDir: '../jb-web-frontend/public',
  resolve: {
    dedupe: ['react', 'react-dom', 'lucide-react', 'leaflet', 'react-leaflet'],
    alias: [
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
