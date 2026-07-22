// One-shot production E2E: opens a headed browser, waits for you to log in via
// WorkOS, then navigates to /export, runs a Bulk Export (AWS default), and
// reports the result. Run: npx tsx scripts/pw-prod-test.ts
import { chromium } from '@playwright/test';

const BASE = 'https://verse-cut-hackathon.vercel.app';

async function main() {
  // Persistent profile so the WorkOS login survives across runs — log in once.
  const context = await chromium.launchPersistentContext('.auth/chrome-profile', {
    headless: false,
    acceptDownloads: true,
    viewport: { width: 1280, height: 900 },
  });
  const page = context.pages()[0] ?? (await context.newPage());
  const failures: string[] = [];
  page.on('console', (m) => {
    if (m.text().includes('[bulk-export]')) failures.push(m.text());
  });

  await page.goto(`${BASE}/export`);
  console.log('\n>>> Log in with WorkOS in the browser window…\n');
  // Wait until we are back on the app (any non-login path) after SSO.
  await page.waitForURL(
    (url) =>
      url.hostname === 'versecut.vercel.app' &&
      !url.pathname.startsWith('/login') &&
      !url.pathname.startsWith('/callback'),
    { timeout: 300_000 },
  );
  console.log('✅ Authenticated. Opening /export…');

  await page.goto(`${BASE}/export`);
  await page.getByRole('heading', { name: 'Bulk Export' }).waitFor({ timeout: 30_000 });

  const exportBtn = page.getByRole('button', { name: /Export \d+ versions|Export all versions/ });
  console.log('Clicking:', (await exportBtn.textContent())?.trim());
  await exportBtn.click();

  const summary = page.getByText(/\d+\/\d+ exported with links\./);
  await summary.waitFor({ timeout: 180_000 });
  const summaryText = (await summary.textContent())?.trim();
  const progress = (await page
    .getByText(/\d+\/\d+ rendered · \d+ failed/)
    .textContent()
    .catch(() => null))?.trim();
  const failReason = (await page
    .getByText(/^First failure —/)
    .textContent()
    .catch(() => null))?.trim();

  console.log('\n=== RESULT (production) ===');
  console.log('progress:', progress);
  console.log('summary :', summaryText);
  if (failReason) console.log('failure :', failReason);
  if (failures.length) console.log('console :', failures.slice(0, 3).join(' | '));

  const m = summaryText?.match(/^(\d+)\/(\d+)/);
  const withLinks = m ? Number(m[1]) : 0;
  await context.close();
  console.log(withLinks > 0 ? `\n✅ ${withLinks} asset(s) uploaded with links` : '\n❌ 0 uploaded with links');
  process.exit(withLinks > 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
