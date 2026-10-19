import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jbmanagement.app',
  appName: 'JB Management',
  webDir: 'dist',
  // Assets are bundled locally. Do not set server.url for the standalone build.
  android: { allowMixedContent: false },
};
export default config;
