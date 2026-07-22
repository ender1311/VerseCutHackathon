// Automated production E2E: reuses the saved session, runs a Bulk Export to
// AWS, and reports the result. Run after scripts/pw-login.ts.
// Run:  npx tsx scripts/pw-export-test.ts
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';

const BASE = 'https://versecut.vercel.app';

async function main() {
  if (!existsSync('.auth/state.json')) {
    console.error('No .auth/state.json — run `npx tsx scripts/pw-login.ts` and log in first.');
    process.exit(2);
  }
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: '.auth/state.json', acceptDownloads: true });
  const page = await context.newPage();
  const failures: string[] = [];
  page.on('console', (m) => {
    if (m.text().includes('[bulk-export]')) failures.push(m.text());
  });

  await page.goto(`${BASE}/export`);
  await page.getByRole('heading', { name: 'Bulk Export' }).waitFor({ timeout: 30_000 });

  // Destination defaults to AWS, Limit defaults to 6.
  const exportBtn = page.getByRole('button', { name: /Export \d+ versions|Export all versions/ });
  console.log('Clicking:', (await exportBtn.textContent())?.trim());
  await exportBtn.click();

  // Wait for the run to finish (result summary appears).
  const summary = page.getByText(/\d+\/\d+ exported with links\./);
  await summary.waitFor({ timeout: 180_000 });
  const summaryText = (await summary.textContent())?.trim();
  const progress = (await page.getByText(/\d+\/\d+ rendered · \d+ failed/).textContent())?.trim();
  const failReason = await page
    .getByText(/^First failure —/)
    .textContent()
    .catch(() => null);

  console.log('\n=== RESULT ===');
  console.log('progress:', progress);
  console.log('summary :', summaryText);
  if (failReason) console.log('failure :', failReason.trim());
  if (failures.length) console.log('console :', failures.slice(0, 3).join(' | '));

  const m = summaryText?.match(/^(\d+)\/(\d+)/);
  const withLinks = m ? Number(m[1]) : 0;
  await browser.close();
  console.log(withLinks > 0 ? `\n✅ ${withLinks} asset(s) uploaded with links` : '\n❌ 0 assets uploaded with links');
  process.exit(withLinks > 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
