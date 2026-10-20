// The Stacks (zone 1): 700 × 700 m. Hand-authored Hoshi Street slice embedded in the middle, procedural
// blocks around it on a street grid, the elevated Ring (z = -230, +12 m), the tram line (z = 220, +8 m),
// the east Black Canal with a canal-edge road, Wan Tower landmark, crowds' walk paths and hover-traffic lanes.
import { BoxDef, LightDef, NeonDef } from './defs';
import { ramp, rng } from './testarea';
import { buildSlice, type SliceWorld } from './slice';
import type { WalkSeg } from '../crowds/crowds';
import type { Lane } from './traffic';
import { addOldMarket } from './oldmarket';
import { addNoodleBar } from './noodlebar';

export type StacksWorld = SliceWorld & { walk: WalkSeg[]; lanes: Lane[]; tram: { a: [number, number, number]; b: [number, number, number] } };

const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mat: BoxDef['mat'], extra: Partial<BoxDef> = {}): BoxDef => ({
  c: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], h: [Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2], mat, ...extra,
});

export const ZONE = 350;
const SR = { x0: -95, x1: 135, z0: -195, z1: 155 };             // slice footprint (hand-authored)
const V: [number, number, number][] = [[-300, -350, 350], [-210, -350, 350], [-130, -350, 350], [0, 155, 350], [100, -350, -150], [35, -350, -140], [190, -350, 350], [270, -350, 350]];
const H: [number, number, number][] = [[-300, -350, 350], [-230, -350, 350], [-110, -350, -130], [60, -350, -130], [220, -350, 350], [300, -350, 300], [-90, 190, 300], [70, 190, 300]];
const DIAG: [number, number, number, number] = [60.7, -102.4, 100, -158];
const CANAL_E = { x0: 300, x1: 326, water: -2.5, floor: -5 };
const RING = { z: -230, y: 12, w: 12, x0: -292, x1: 252 };
const TRAM = { z: 220, y: 8 };
const CORR = 10; // street half-width + sidewalk

function nearSeg(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(ax + dx * t - px, az + dz * t - pz);
}
function rectHitsStreet(x0: number, z0: number, x1: number, z1: number, pad = 0) {
  for (const [x, a, b] of V) if (x1 > x - CORR - pad && x0 < x + CORR + pad && z1 > a && z0 < b) return true;
  for (const [z, a, b] of H) if (z1 > z - CORR - pad && z0 < z + CORR + pad && x1 > a && x0 < b) return true;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, r = Math.hypot(x1 - x0, z1 - z0) / 2;
  if (nearSeg(cx, cz, ...DIAG) < CORR + r * 0.7) return true;
  return false;
}
const inRect = (x0: number, z0: number, x1: number, z1: number, R: { x0: number; x1: number; z0: number; z1: number }) => x1 > R.x0 && x0 < R.x1 && z1 > R.z0 && z0 < R.z1;

export function buildStacks(): StacksWorld {
  const W = buildSlice({ embed: true }) as StacksWorld;
  const R = rng(2077);
  const { boxes, neons, lights } = W;
  const { props, cables, steam, holos } = W.dressing;
  const walk: WalkSeg[] = [], lanes: Lane[] = [];
  const words = ['HOTEL', 'RAMEN', 'KARAOKE', 'DATA', '24H', 'CLINIC', 'SUSHI', 'PACHINKO', 'BAR', 'LOANS', 'MODS', 'CYBER', 'NOODLE', 'MAHJONG', 'TATTOO', 'ARCADE', 'PAWN', 'DIM SUM'];
  const pal = ['#ff2aa8', '#19e6ff', '#ffa142', '#b84dff', '#ff3b5c', '#4dff9a', '#ff2aa8', '#ffa142'];

  // the slice's own walkways → crowd paths
  for (const b of boxes) if (b.mat === 'sidewalk' && Math.max(b.h[0], b.h[2]) > 3) {
    const yaw = b.yaw ?? 0, along = b.h[2] >= b.h[0] ? b.h[2] : b.h[0];
    const fx = b.h[2] >= b.h[0] ? -Math.sin(yaw) : Math.cos(yaw), fz = b.h[2] >= b.h[0] ? -Math.cos(yaw) : -Math.sin(yaw);
    walk.push({ a: [b.c[0] - fx * along, b.c[2] - fz * along], b: [b.c[0] + fx * along, b.c[2] + fz * along], y: b.c[1] + b.h[1] });
  }

  // ---- procedural blocks ----
  const xs = [-350, -300, -210, -130, 0, 35, 100, 190, 270, 298];
  const zs = [-350, -300, -230, -110, -90, 60, 70, 220, 300, 350];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const fx0 = xs[i] + (i === 0 ? 3 : CORR), fx1 = xs[i + 1] - (i + 1 === xs.length - 1 ? 2 : CORR);
    const fz0 = zs[j] + (j === 0 ? 3 : CORR), fz1 = zs[j + 1] - (j + 1 === zs.length - 1 ? 3 : CORR);
    if (fx1 - fx0 < 12 || fz1 - fz0 < 12) continue;
    // lots along the longer axis
    const alongX = fx1 - fx0 >= fz1 - fz0;
    const span = alongX ? fx1 - fx0 : fz1 - fz0, depthAll = alongX ? fz1 - fz0 : fx1 - fx0;
    const rows = depthAll > 46 ? 2 : 1;
    let placed = 0;
    for (let r = 0; r < rows; r++) {
      let t = 0;
      while (t < span - 6) {
        const w = Math.min(span - t, 12 + R() * 22);
        const d0 = r * depthAll / rows, d1 = (r + 1) * depthAll / rows - (rows > 1 && r === 0 ? 0.0 : 0);
        const lx0 = alongX ? fx0 + t : fx0 + d0, lx1 = alongX ? fx0 + t + w : fx0 + d1;
        const lz0 = alongX ? fz0 + d0 : fz0 + t, lz1 = alongX ? fz0 + d1 : fz0 + t + w;
        t += w;
        if (inRect(lx0, lz0, lx1, lz1, SR) || rectHitsStreet(lx0, lz0, lx1, lz1)) continue;
        const isWan = lx0 < -170 && lx1 > -170 && lz0 < -170 && lz1 > -170;
        const low = !isWan && R() < 0.12;
        const h = isWan ? 165 : low ? 8 + R() * 3 : 18 + R() * R() * 85;
        const seed = Math.floor(R() * 1e6);
        boxes.push(box(lx0, 0, lz0, lx1, h, lz1, R() < 0.5 ? 'facade' : 'facadeB', { lit: 0.18 + R() * 0.35, seed, surface: 'brick' }));
        placed++;
        if (isWan) {
          holos.push({ pos: [(lx0 + lx1) / 2, 150, lz1 + 0.5], yaw: 0, size: [26, 26], color: '#3fe6ff', kind: 'face' });
          holos.push({ pos: [lx1 + 0.5, 120, (lz0 + lz1) / 2], yaw: Math.PI / 2, size: [30, 18], color: '#ff4fd0', kind: 'koi' });
          lights.push({ pos: [(lx0 + lx1) / 2, 168, (lz0 + lz1) / 2], color: '#ff2050', intensity: 0, range: 1 });
        }
        if (low) for (let k = 0; k < 3; k++) { // rooftop shanties
          const sx = lx0 + 2 + R() * (lx1 - lx0 - 6), sz = lz0 + 2 + R() * (lz1 - lz0 - 6);
          boxes.push(box(sx, h, sz, sx + 3 + R() * 2, h + 2.4, sz + 3, 'metal', { collide: 'none' }));
          props.push({ kind: 'lantern', pos: [sx + 1.5, h + 2.8, sz + 1.5], yaw: 0, size: [0.25, 0, 0] });
        }
        // dress faces that front a street (each side of the lot on the block boundary)
        const faces: [number, number, number, number, number][] = []; // x, z (centre on face), yaw normal, width, side
        if (lz1 >= fz1 - 0.1) faces.push([(lx0 + lx1) / 2, lz1, 0, lx1 - lx0, 0]);
        if (lz0 <= fz0 + 0.1) faces.push([(lx0 + lx1) / 2, lz0, Math.PI, lx1 - lx0, 0]);
        if (lx1 >= fx1 - 0.1) faces.push([lx1, (lz0 + lz1) / 2, Math.PI / 2, lz1 - lz0, 0]);
        if (lx0 <= fx0 + 0.1) faces.push([lx0, (lz0 + lz1) / 2, -Math.PI / 2, lz1 - lz0, 0]);
        for (const [cx, cz, yaw, fw] of faces) {
          const nx = Math.sin(yaw), nz = Math.cos(yaw), tx = Math.cos(yaw), tz = -Math.sin(yaw);
          const px = cx + nx * 0.06, pz = cz + nz * 0.06;
          const k = R();
          if (k < 0.5) props.push({ kind: 'shopwin', pos: [px, 1.7, pz], yaw, size: [Math.min(fw - 2, 10), 2.4, 0], seed: R() * 100 });
          else if (k < 0.8) props.push({ kind: 'shutter', pos: [px, 1.6, pz], yaw, size: [Math.min(fw - 2, 10), 3, 0] });
          if (R() < 0.45) props.push({ kind: 'awning', pos: [px, 3.4, pz], yaw, size: [Math.min(fw - 1, 10), 0, 1.4], seed: R() * 10 });
          if (R() < 0.75 && h > 10) { const al = (R() - 0.5) * (fw - 3); neons.push({ pos: [cx + nx * 1.0 + tx * al, 6 + R() * Math.min(10, h - 9), cz + nz * 1.0 + tz * al], size: [1.2, 4 + R() * 3], yaw: yaw + Math.PI / 2, color: pal[Math.floor(R() * pal.length)], text: words[Math.floor(R() * words.length)], vertical: true, flicker: R() < 0.15 ? 0.7 : 0, light: R() < 0.5 ? 14 : 0 }); }
          if (R() < 0.45) neons.push({ pos: [px + nx * 0.2, 4.6 + R() * 1.4, pz + nz * 0.2], size: [Math.min(fw - 2, 6), 1.2], yaw, color: pal[Math.floor(R() * pal.length)], text: words[Math.floor(R() * words.length)], light: 0 });
          for (let q = 0; q < 3; q++) { const y = 5 + R() * Math.max(2, h - 8); if (y < h - 1) props.push({ kind: R() < 0.7 ? 'ac' : 'balcony', pos: [cx + tx * (R() - 0.5) * (fw - 2), y, cz + tz * (R() - 0.5) * (fw - 2)], yaw, size: [0.9, 0.6, 0.5] }); }
          if (R() < 0.12) steam.push({ pos: [cx + nx * 2.2, 0.2, cz + nz * 2.2], radius: 0.6, height: 4, tint: '#8a7aa8' });
        }
      }
    }
    if (!placed) continue;
    // sidewalk ring + walk paths + lamps around the footprint
    const sw: [number, number, number, number][] = [[fx0 - 3, fz0 - 3, fx1 + 3, fz0], [fx0 - 3, fz1, fx1 + 3, fz1 + 3], [fx0 - 3, fz0, fx0, fz1], [fx1, fz0, fx1 + 3, fz1]];
    for (const [a0, b0, a1, b1] of sw) {
      boxes.push(box(a0, 0, b0, a1, 0.15, b1, 'sidewalk', { collide: 'ground', surface: 'concrete' }));
      const lx = a1 - a0 > b1 - b0;
      walk.push(lx ? { a: [a0 + 2, (b0 + b1) / 2], b: [a1 - 2, (b0 + b1) / 2], y: 0.15 } : { a: [(a0 + a1) / 2, b0 + 2], b: [(a0 + a1) / 2, b1 - 2], y: 0.15 });
    }
    for (let x = fx0 + 8; x < fx1 - 4; x += 32) for (const z of [fz0 - 3.6, fz1 + 3.6]) {
      boxes.push(box(x - 0.12, 0, z - 0.12, x + 0.12, 6.5, z + 0.12, 'metal', { surface: 'metal' }));
      lights.push({ pos: [x, 6.3, z + (z < fz0 ? -1.4 : 1.4)], color: R() < 0.8 ? '#ff9a40' : '#7fe0ff', intensity: 36, range: 18, cone: { dirYaw: 0, dirPitch: -Math.PI / 2, angle: 0.5 } });
    }
    // cables across the street in front of the block's north edge
    if (R() < 0.6) cables.push({ a: [fx0 + 5, 9 + R() * 4, fz0 - 0.5], b: [fx0 + 5 + (R() - 0.5) * 6, 9 + R() * 4, fz0 - 19.5], sag: 1.2, laundry: R() < 0.25 });
  }

  // ---- the Ring: elevated lane along z = -230 at +12 m ----
  boxes.push(ramp([-345, 0, RING.z], [RING.x0, RING.y, RING.z], RING.w));
  boxes.push(box(RING.x0, RING.y - 1, RING.z - RING.w / 2, RING.x1, RING.y, RING.z + RING.w / 2, 'deck', { surface: 'concrete' }));
  boxes.push(ramp([RING.x1, RING.y, RING.z], [292, 0, RING.z], RING.w));
  for (const s of [-1, 1]) {
    const zz = RING.z + s * (RING.w / 2 + 0.25);
    boxes.push(box(RING.x0, RING.y, zz - 0.25, RING.x1, RING.y + 1.1, zz + 0.25, 'metal', { surface: 'metal' }));
    for (let x = RING.x0 + 12; x < RING.x1; x += 30) {
      if (V.some(([vx]) => Math.abs(vx - x) < 12)) continue;
      boxes.push(box(x - 0.7, 0, zz - s * 0.9 - 0.7, x + 0.7, RING.y - 1, zz - s * 0.9 + 0.7, 'concrete', { surface: 'concrete' }));
    }
    for (let x = RING.x0; x < RING.x1; x += 16) neons.push({ pos: [x, RING.y + 0.6, zz + s * 0.3], size: [3, 0.25], yaw: s > 0 ? 0 : Math.PI, color: s < 0 ? '#ff2aa8' : '#19e6ff', text: '', light: 0 });
  }
  for (let x = RING.x0; x < RING.x1; x += 24) lights.push({ pos: [x, RING.y - 1.4, RING.z], color: '#8ff0ff', intensity: 14, range: 12 });

  // ---- tram line along z = 220 (+8 m deck, visual; pillars solid) ----
  boxes.push(box(-345, TRAM.y - 0.8, TRAM.z - 2.2, 345, TRAM.y, TRAM.z + 2.2, 'concrete', { collide: 'none' }));
  // portal frames on the sidewalks (pillars never stand in the road) carrying the deck
  for (let x = -330; x <= 330; x += 36) if (!V.some(([vx]) => Math.abs(vx - x) < 11)) for (const s of [-1, 1]) {
    const zz = TRAM.z + s * 8.6;
    boxes.push(box(x - 0.5, 0, zz - 0.5, x + 0.5, TRAM.y, zz + 0.5, 'concrete', { surface: 'concrete' }));
  }
  for (let x = -330; x <= 330; x += 36) if (!V.some(([vx]) => Math.abs(vx - x) < 11)) boxes.push(box(x - 0.4, TRAM.y - 0.8, TRAM.z - 9, x + 0.4, TRAM.y, TRAM.z + 9, 'concrete', { collide: 'none' }));
  for (let x = -330; x <= 330; x += 12) neons.push({ pos: [x, TRAM.y - 0.9, TRAM.z + 2.25], size: [6, 0.12], yaw: 0, color: '#ffa142', text: '', light: 0 });

  // ---- east Black Canal + canal-edge road ----
  boxes.push(box(CANAL_E.x0, CANAL_E.floor - 1, -ZONE, CANAL_E.x1, CANAL_E.floor, ZONE, 'concrete', { collide: 'ground' }));
  boxes.push(box(CANAL_E.x0, CANAL_E.water - 0.2, -ZONE, CANAL_E.x1, CANAL_E.water, ZONE, 'water', { surface: 'water', collide: 'water' }));
  const gaps = [[-60, -40], [140, 160]];
  let zc = -ZONE;
  for (const [a, b] of [...gaps, [ZONE, ZONE]]) { if (a > zc) { boxes.push(box(CANAL_E.x0 - 0.6, CANAL_E.floor, zc, CANAL_E.x0, 0, a, 'canalWall', { surface: 'concrete' })); boxes.push(box(CANAL_E.x0 - 0.5, 0, zc, CANAL_E.x0 - 0.3, 1, a, 'metal', { surface: 'metal' })); } zc = b; }
  for (const [a, b] of gaps) boxes.push(ramp([CANAL_E.x0 - 2, 0, (a + b) / 2], [CANAL_E.x0 + 16, CANAL_E.water - 0.7, (a + b) / 2], b - a, 'concrete'));
  boxes.push(box(CANAL_E.x1, CANAL_E.floor, -ZONE, CANAL_E.x1 + 0.6, 0, ZONE, 'canalWall', { surface: 'concrete' }));
  for (let z = -330; z < 340; z += 26) lights.push({ pos: [CANAL_E.x1 + 1, 5.5, z], color: '#5fd8ff', intensity: 22, range: 18, cone: { dirYaw: 0, dirPitch: -Math.PI / 2, angle: 0.45 } });
  // the east bank: tall towers over the canal-edge road
  for (let z = -340; z < 340; z += 24) boxes.push(box(334, 0, z, 352, 30 + R() * 70, z + 22, R() < 0.5 ? 'facade' : 'facadeB', { lit: 0.35, seed: Math.floor(R() * 1e6), surface: 'brick' }));

  // ---- zone boundary: tall walls of towers (fog swallows them) ----
  for (const [x0, z0, x1, z1] of [[-360, -360, 360, -350], [-360, 350, 360, 360]]) boxes.push(box(x0, 0, z0, x1, 60, z1, 'facade', { lit: 0.3, seed: Math.floor(R() * 1e6) }));

  // ---- hover traffic lanes over the streets ----
  for (const [x, a, b] of V) for (const [h, dir] of [[15, 1], [19, -1], [26, 1]] as [number, number][]) {
    const z0 = dir > 0 ? a : b, z1 = dir > 0 ? b : a; lanes.push({ a: [x + dir * 2.5, h, z0], b: [x + dir * 2.5, h, z1], cars: Math.max(1, Math.round(Math.abs(b - a) / 70)), speed: 22 + R() * 14 });
  }
  for (const [z, a, b] of H) for (const [h, dir] of [[17, 1], [22, -1]] as [number, number][]) {
    const x0 = dir > 0 ? a : b, x1 = dir > 0 ? b : a; lanes.push({ a: [x0, h, z + dir * 2.5], b: [x1, h, z + dir * 2.5], cars: Math.max(1, Math.round(Math.abs(b - a) / 70)), speed: 22 + R() * 14 });
  }
  lanes.push({ a: [0, 16, 140], b: [0, 16, -10], cars: 3, speed: 20 }, { a: [3, 21, -10], b: [3, 21, 140], cars: 2, speed: 26 });

  W.walk = walk; W.lanes = lanes;
  addOldMarket(W); // zone 2 to the west
  addNoodleBar(W); // Hoshi interior (door teleports)
  W.tram = { a: [-330, TRAM.y, TRAM.z], b: [330, TRAM.y, TRAM.z] };
  W.spawn = { pos: [0, 1, 115], yaw: 0 };
  W.routes.cross = { pts: [[0, 115], [0, 220], [-130, 220], [-130, -230], [190, -230], [190, 220], [0, 220]], targetTime: [0, 0] };
  W.routes.ring = { pts: [[-345, -230], [252, -230], [296, -230]], targetTime: [0, 0] };
  for (const r of [W.routes.cross, W.routes.ring]) {
    let L = 0; for (let i = 1; i < r.pts.length; i++) L += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
    r.targetTime = [Math.round(L / 34), Math.round(L / 16)];
  }
  return W;
}
export const _s: LightDef[] = []; export const _n: NeonDef[] = [];
