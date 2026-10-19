// Headless check of the delivery test page (served or file://).
import { chromium } from 'playwright-core';
const url = process.argv[2];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] });
const p = await b.newPage();
p.on('console', m => m.type() === 'error' && console.log('console error:', m.text()));
await p.goto(url);
await p.waitForFunction(() => window.__DELIVERY && (window.__DELIVERY.done || Object.keys(window.__DELIVERY).length >= 4), null, { timeout: 60000 }).catch(() => {});
await p.waitForTimeout(2500);
console.log(JSON.stringify(await p.evaluate(() => ({ r: window.__DELIVERY, fps: window.__FPS })), null, 1));
await b.close();
