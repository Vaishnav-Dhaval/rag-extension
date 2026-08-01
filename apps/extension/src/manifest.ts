import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'AI Reply Composer',
  version: '0.1.0',
  description: 'Generate AI-powered replies on X.com',
  permissions: ['storage', 'scripting'],
  host_permissions: ['https://x.com/*', 'https://twitter.com/*'],
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'Generate Reply',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://x.com/*', 'https://twitter.com/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_start',
    },
  ],
  icons: {
    16: 'src/icons/icon-16.png',
    48: 'src/icons/icon-48.png',
    128: 'src/icons/icon-128.png',
  },
});
