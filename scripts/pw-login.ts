// Interactive: opens a real browser to production so you can log in via WorkOS.
// Once the Bulk Export page loads (authenticated), it saves the session to
// .auth/state.json for the automated test to reuse.
// Run:  npx tsx scripts/pw-login.ts
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'https://versecut.vercel.app';

async function main() {
  mkdirSync('.auth', { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/export`);
  console.log('\n>>> Log in with WorkOS in the browser window. Waiting for the Bulk Export page…\n');
  await page.getByRole('heading', { name: 'Bulk Export' }).waitFor({ timeout: 180_000 });
  await context.storageState({ path: '.auth/state.json' });
  console.log('✅ Session saved to .auth/state.json');
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
