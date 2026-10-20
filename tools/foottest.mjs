// On-foot test: dismount, walk, sprint, jump, enter Hoshi, leave, remount.
import { serve, launch, openPage } from './browser.mjs';
const srv = await serve('dist', 8096); const b = await launch();
const { page, errors } = await openPage(b, 'http://localhost:8096/index.html?backend=webgl&w=640&h=360&quality=low&nosplash');
await page.waitForFunction(() => window.__NC_READY && window.NRC_DEBUG.game.frameCount() > 5, null, { timeout: 240000, polling: 500 });
const frames = (n) => page.evaluate((n) => new Promise((r) => { const f0 = window.NRC_DEBUG.game.frameCount(); const t = () => window.NRC_DEBUG.game.frameCount() - f0 >= n ? r() : requestAnimationFrame(t); t(); }), n);
const press = async (code, hold = 2) => { await page.keyboard.down(code); await frames(hold); await page.keyboard.up(code); await frames(2); };
const st = () => page.evaluate(() => ({ ...window.NRC_DEBUG.foot(), pos: window.NRC_DEBUG.stats().pos.map((v) => +v.toFixed(2)), speed: +window.NRC_DEBUG.stats().speed.toFixed(2) }));
const out = {};
const h = await page.evaluate(() => window.NRC_DEBUG.game.world.anchors.hoshi);
// park the bike on the street in front of Hoshi (away from Kiso's ring) and dismount
await page.evaluate((h) => window.NRC_DEBUG.teleport(h.pos[0] + Math.sin(h.yaw) * 7, 1, h.pos[2] + Math.cos(h.yaw) * 7 + 9, 0), h);
await frames(10); out.start = await st();
await press('KeyF'); await frames(8); out.dismounted = await st();
await page.keyboard.down('KeyW'); await frames(15); out.walking = await st(); await page.keyboard.down('ShiftLeft'); await frames(15); out.sprinting = await st(); await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW'); await frames(6);
await page.keyboard.down('KeyQ'); await frames(2); out.jump = []; for (let i = 0; i < 4; i++) { await frames(1); out.jump.push((await st()).pos[1]); } await page.keyboard.up('KeyQ'); await frames(10);
await page.screenshot({ path: (process.env.FOOT_PREFIX || 'shots/m5_') + 'onfoot.png' });
// walk to Hoshi's door
await page.evaluate((h) => window.NRC_DEBUG.teleport(h.pos[0] + Math.sin(h.yaw) * 1.6, 1, h.pos[2] + Math.cos(h.yaw) * 1.6, 0), h);
await frames(8); out.atDoor = await st(); out.prompt = await page.evaluate(() => document.querySelector('.prompt')?.textContent);
await press('KeyF'); await frames(16); out.inside = await st();
await page.screenshot({ path: (process.env.FOOT_PREFIX || 'shots/m5_') + 'noodlebar.png' });
await press('KeyF'); await frames(16); out.outside = await st();
console.log(JSON.stringify(out, null, 1));
console.log('errors:', errors.length ? errors.slice(0, 5) : 'none');
await b.close(); srv.close();
