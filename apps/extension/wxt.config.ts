import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  manifest: ({ browser }) => ({
    name: 'PinjamAkun',
    description: 'Bagikan snapshot sesi secara sadar, terbatas, dan terenkripsi.',
    version: '0.1.0',
    permissions: ['cookies', 'storage', 'alarms'],
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    ...(browser === 'firefox'
      ? { browser_specific_settings: { gecko: { id: 'extension@pinjamakun.local' } } }
      : {}),
  }),
});
