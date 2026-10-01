import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { googleVerifier } from './auth.js';
import { loadSettings } from './settings.js';
import { MemoryStore, createFirestoreStore } from './store.js';

const settings = loadSettings();
const store = settings.store === 'memory' ? new MemoryStore() : await createFirestoreStore();
const app = createApp({ settings, store, verify: googleVerifier(settings.googleClientId) });

serve({ fetch: app.fetch, port: settings.port }, (info) => {
  console.log(JSON.stringify({ severity: 'INFO', message: `school-hwp api listening on ${info.port}`, store: settings.store }));
});
