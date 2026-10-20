// Old Market (zone 2): x −1000..−360, z −320..320. Low roofs, narrow lanes on a jittered grid, amber lanterns
// strung across every lane, market stalls under awnings, steam vents, tangled cables, warm windows.
// Its east–west lanes line up with The Stacks' streets (z −300, −230 → the Ring's west ramp, −110, 60, 220, 300).
import { BoxDef, LightDef, NeonDef } from './defs';
import { rng } from './testarea';
import type { StacksWorld } from './stacks';

const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mat: BoxDef['mat'], extra: Partial<BoxDef> = {}): BoxDef => ({
  c: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], h: [Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2], mat, ...extra,
});

export const OM = { x0: -1000, x1: -360, z0: -320, z1: 320 };
const LANE = 5; // half corridor: 3.5 m road + 1.5 m walk

export function addOldMarket(W: StacksWorld) {
  const R = rng(1906);
  const { boxes, neons, lights } = W;
  const { props, cables, steam } = W.dressing;
  const words = ['TEA', 'NOODLE', 'FISH', 'HERBS', 'REPAIR', 'DUMPLING', 'SOUP', 'TAILOR', 'LUCK', 'RICE'];
  const warm = ['#ffa142', '#ff6a2a', '#ffcf7a', '#ff3b3b', '#ffa142'];
  // ground for the zone (Stacks ground ends at x = -360)
  boxes.push(box(OM.x0 - 10, -2, OM.z0 - 10, OM.x1 + 1, 0, OM.z1 + 10, 'asphalt', { collide: 'ground', surface: 'asphalt' }));
  // lane lines: E-W lanes continue the Stacks streets; N-S lanes on a jittered grid
  const zl = [-300, -230, -170, -110, -50, 0, 60, 120, 170, 220, 270, 300];
  const xl: number[] = []; for (let x = -390; x > OM.x0 + 20; x -= 44 + R() * 18) xl.push(Math.round(x));
  const xs = [OM.x1, ...xl, OM.x0].sort((a, b) => a - b), zs = [OM.z0, ...zl, OM.z1].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const fx0 = xs[i] + (i === 0 ? 2 : LANE), fx1 = xs[i + 1] - (i + 1 === xs.length - 1 ? 0.5 : LANE);
    const fz0 = zs[j] + (j === 0 ? 2 : LANE), fz1 = zs[j + 1] - (j + 1 === zs.length - 1 ? 2 : LANE);
    if (fx1 - fx0 < 8 || fz1 - fz0 < 8) continue;
    // a square every so often: open plaza with stalls instead of buildings
    const plaza = R() < 0.1 && fx1 - fx0 > 20 && fz1 - fz0 > 20;
    boxes.push(box(fx0 - 1.5, 0, fz0 - 1.5, fx1 + 1.5, 0.12, fz1 + 1.5, 'sidewalk', { collide: 'ground', surface: 'concrete' }));
    W.walk.push({ a: [fx0, fz0 - 0.8], b: [fx1, fz0 - 0.8], y: 0.12 }, { a: [fx0, fz1 + 0.8], b: [fx1, fz1 + 0.8], y: 0.12 }, { a: [fx0 - 0.8, fz0], b: [fx0 - 0.8, fz1], y: 0.12 });
    if (plaza) {
      for (let k = 0; k < 8; k++) {
        const sx = fx0 + 3 + R() * (fx1 - fx0 - 6), sz = fz0 + 3 + R() * (fz1 - fz0 - 6);
        boxes.push(box(sx - 1.2, 0, sz - 0.8, sx + 1.2, 1.0, sz + 0.8, 'metal', { surface: 'metal' }));
        props.push({ kind: 'awning', pos: [sx, 2.3, sz - 0.9], yaw: Math.PI, size: [2.8, 0, 1.6], seed: R() * 10 });
        props.push({ kind: 'lantern', pos: [sx, 2.0, sz + 0.9], yaw: 0, size: [0.2, 0, 0] });
        W.walk.push({ a: [sx - 4, sz + 2], b: [sx + 4, sz + 2], y: 0.12 });
      }
      lights.push({ pos: [(fx0 + fx1) / 2, 6, (fz0 + fz1) / 2], color: '#ffb36b', intensity: 34, range: 22, cone: { dirYaw: 0, dirPitch: -Math.PI / 2, angle: 0.55 } });
      steam.push({ pos: [(fx0 + fx1) / 2 + 3, 0.2, (fz0 + fz1) / 2], radius: 0.8, height: 5, tint: '#c09060' });
      continue;
    }
    // narrow shophouses along the longer side, two rows back to back
    const alongX = fx1 - fx0 >= fz1 - fz0;
    const span = alongX ? fx1 - fx0 : fz1 - fz0, depth = alongX ? fz1 - fz0 : fx1 - fx0;
    const rows = depth > 22 ? 2 : 1;
    for (let r = 0; r < rows; r++) {
      let t = 0;
      while (t < span - 3) {
        const w = Math.min(span - t, 5 + R() * 7), d0 = r * depth / rows, d1 = (r + 1) * depth / rows;
        const lx0 = alongX ? fx0 + t : fx0 + d0, lx1 = alongX ? fx0 + t + w : fx0 + d1, lz0 = alongX ? fz0 + d0 : fz0 + t, lz1 = alongX ? fz0 + d1 : fz0 + t + w;
        t += w;
        const h = 5 + R() * 9 + (R() < 0.08 ? 8 : 0);
        boxes.push(box(lx0, 0, lz0, lx1, h, lz1, R() < 0.6 ? 'facadeB' : 'facade', { lit: 0.35 + R() * 0.35, seed: Math.floor(R() * 1e6), surface: 'brick' }));
        // street-facing side(s): stall front, awning, lantern, sign
        const faces: [number, number, number, number][] = [];
        if (alongX) { if (r === 0) faces.push([(lx0 + lx1) / 2, lz0, Math.PI, lx1 - lx0]); if (r === rows - 1) faces.push([(lx0 + lx1) / 2, lz1, 0, lx1 - lx0]); }
        else { if (r === 0) faces.push([lx0, (lz0 + lz1) / 2, -Math.PI / 2, lz1 - lz0]); if (r === rows - 1) faces.push([lx1, (lz0 + lz1) / 2, Math.PI / 2, lz1 - lz0]); }
        for (const [cx, cz, yaw, fw] of faces) {
          const nx = Math.sin(yaw), nz = Math.cos(yaw);
          const px = cx + nx * 0.06, pz = cz + nz * 0.06, k = R();
          if (k < 0.55) props.push({ kind: 'shopwin', pos: [px, 1.5, pz], yaw, size: [fw - 1.2, 2.0, 0], seed: R() * 100 });
          else if (k < 0.75) props.push({ kind: 'shutter', pos: [px, 1.4, pz], yaw, size: [fw - 1.2, 2.6, 0] });
          if (R() < 0.75) props.push({ kind: 'awning', pos: [px, 2.9, pz], yaw, size: [fw - 0.4, 0, 1.8], seed: R() * 10 });
          if (R() < 0.5) props.push({ kind: 'lantern', pos: [cx + nx * 1.6, 2.7, cz + nz * 1.6], yaw: 0, size: [0.24, 0, 0] });
          if (R() < 0.35) neons.push({ pos: [cx + nx * 0.25, 3.7 + R(), cz + nz * 0.25], size: [Math.min(fw - 1, 3.5), 0.9], yaw, color: warm[Math.floor(R() * warm.length)], text: words[Math.floor(R() * words.length)], light: R() < 0.4 ? 10 : 0 });
          if (R() < 0.3) props.push({ kind: 'crate', pos: [cx + nx * 1.2, 0.45, cz + nz * 1.2], yaw, size: [0.9, 0.8, 0.8] });
          if (R() < 0.12) steam.push({ pos: [cx + nx * 1.8, 0.2, cz + nz * 1.8], radius: 0.5, height: 4, tint: '#b88a60' });
        }
      }
    }
  }
  // lantern strings + tangled cables across every lane, warm lamps
  for (const z of zl) for (let x = OM.x1 - 8; x > OM.x0 + 8; x -= 9 + R() * 6) {
    const y = 5 + R() * 2;
    cables.push({ a: [x, y, z - LANE + 0.2], b: [x + (R() - 0.5) * 3, y + (R() - 0.5), z + LANE - 0.2], sag: 0.6 + R() * 0.6, laundry: R() < 0.15, r: 0.015 });
    if (R() < 0.6) props.push({ kind: 'lantern', pos: [x, y - 0.5, z], yaw: 0, size: [0.28, 0, 0] });
    if (R() < 0.18) lights.push({ pos: [x, y - 0.8, z], color: R() < 0.8 ? '#ff9a40' : '#ff4a30', intensity: 16, range: 12 });
  }
  for (const x of xl) for (let z = OM.z0 + 10; z < OM.z1 - 10; z += 11 + R() * 7) {
    const y = 5 + R() * 2;
    cables.push({ a: [x - LANE + 0.2, y, z], b: [x + LANE - 0.2, y + (R() - 0.5), z + (R() - 0.5) * 3], sag: 0.5 + R() * 0.6, r: 0.015 });
    if (R() < 0.5) props.push({ kind: 'lantern', pos: [x, y - 0.45, z], yaw: 0, size: [0.26, 0, 0] });
    if (R() < 0.15) lights.push({ pos: [x, y - 0.8, z], color: '#ffa04a', intensity: 15, range: 12 });
  }
  // the zone edge: the Stacks' west wall is gone; seal the far west + north/south of the market
  for (const [x0, z0, x1, z1] of [[OM.x0 - 12, OM.z0 - 12, OM.x0, OM.z1 + 12], [OM.x0, OM.z0 - 12, OM.x1, OM.z0 - 2], [OM.x0, OM.z1 + 2, OM.x1, OM.z1 + 12]])
    boxes.push(box(x0, 0, z0, x1, 26, z1, 'facadeB', { lit: 0.3, seed: Math.floor(R() * 1e6) }));
  const xm = xl.reduce((b, x) => Math.abs(x + 640) < Math.abs(b + 640) ? x : b, xl[0]);
  // Lantern Run checkpoints (time trial): out along z 60, south down a market lane, back east to the Ring ramp
  const xf = xl.reduce((b, x) => Math.abs(x + 860) < Math.abs(b + 860) ? x : b, xl[0]);
  (W as any).marketRun = [[-470, 0, 60], [xm, 0, 60], [xm, 0, -110], [xf, 0, -110], [xf, 0, -230], [-500, 0, -230], [-330, 6, -230]];
  W.routes.market = { pts: [[-345, 60], [xm, 60], [xm, -230], [-360, -230]], targetTime: [0, 0] };
  let L = 0; const p = W.routes.market.pts; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  W.routes.market.targetTime = [Math.round(L / 34), Math.round(L / 15)];
}
export const _om: [LightDef[], NeonDef[]] = [[], []];
