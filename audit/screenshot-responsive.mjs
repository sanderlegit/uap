import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const OUT = './audit/after/responsive';

const viewports = [
  { name: '1280', width: 1280, height: 800 },
  { name: '1920', width: 1920, height: 1080 },
];

const routes = [
  { name: 'dashboard', hash: '' },
  { name: 'disclosure', hash: '#/disclosure' },
  { name: 'pulse', hash: '#/pulse' },
  { name: 'cases', hash: '#/cases' },
];

const browser = await chromium.launch();

for (const vp of viewports) {
  for (const { name, hash } of routes) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto(`${BASE}/${hash}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/${name}-${vp.name}.png`, fullPage: false });
    await page.close();
  }
}

await browser.close();
console.log('Done');
