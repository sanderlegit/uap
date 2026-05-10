import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4176';
const OUT = process.env.OUT_DIR || './audit/before';

const routes = [
  { name: 'dashboard', hash: '' },
  { name: 'documents', hash: '#/documents' },
  { name: 'map', hash: '#/map' },
  { name: 'timeline', hash: '#/timeline' },
  { name: 'graph', hash: '#/graph' },
  { name: 'search', hash: '#/search' },
  { name: 'disclosure', hash: '#/disclosure' },
  { name: 'theories', hash: '#/theories' },
  { name: 'cases', hash: '#/cases' },
  { name: 'international', hash: '#/international' },
  { name: 'pulse', hash: '#/pulse' },
  { name: 'analysis-report', hash: '#/analysis/report' },
  { name: 'analysis-fbi', hash: '#/analysis/fbi' },
  { name: 'analysis-redactions', hash: '#/analysis/redactions' },
];

const browser = await chromium.launch();

for (const { name, hash } of routes) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const url = `${BASE}/${hash}`;
  console.log(`📸 ${name}: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  await page.close();
}

await browser.close();
console.log(`✅ Done — screenshots in ${OUT}`);
