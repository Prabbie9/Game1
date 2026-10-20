// M2 look slice: "Hoshi Street" in The Stacks. ~220 m street with a 35° bend, an alley with a steamy courtyard,
// the Black Canal (drivable water, ramps in/out), and the Skyway elevated lane (ramp up along the canal bank,
// crossing over the street = underpass). Hand-authored layout + seeded procedural dressing.
import { BoxDef, LightDef, NeonDef, WorldDef } from './defs';
import { ramp, rng } from './testarea';
import type { CableDef, HoloDef, PropDef, SteamDef } from './kit';

export interface Dressing { props: PropDef[]; cables: CableDef[]; steam: SteamDef[]; holos: HoloDef[] }
export type SliceWorld = WorldDef & { dressing: Dressing };

const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mat: BoxDef['mat'], extra: Partial<BoxDef> = {}): BoxDef => ({
  c: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], h: [Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2], mat, ...extra,
});
/** Oriented box from a centre on the ground, yaw, size across (x), height, along (z). */
const obox = (cx: number, cz: number, yaw: number, across: number, h: number, along: number, mat: BoxDef['mat'], y0 = 0, extra: Partial<BoxDef> = {}): BoxDef => ({
  c: [cx, y0 + h / 2, cz], h: [across / 2, h / 2, along / 2], yaw, mat, ...extra,
});

export const ROAD_HW = 7, WALK = 3; // road half-width, sidewalk width
export const SKY = { x: 35, y: 10, w: 11, zRampStart: 112, zRampTop: 62, zEnd: -96, zDownEnd: -140 };
export const CANAL2 = { x0: 12, x1: 30, z0: 10, z1: 112, water: -2.5, floor: -5 };

/** Centre-line samples of Hoshi Street: straight north 100 m, 35° right bend (R = 50), 90 m north-east. */
export function streetPath(step = 2): { x: number; z: number; yaw: number; s: number }[] {
  const pts: { x: number; z: number; yaw: number; s: number }[] = [];
  let s = 0;
  for (let z = 100; z > 0; z -= step) { pts.push({ x: 0, z, yaw: 0, s }); s += step; }
  const R = 50, A = 35 * Math.PI / 180, arcLen = R * A;
  for (let d = 0; d < arcLen; d += step) { const th = d / R; pts.push({ x: R - R * Math.cos(th), z: -R * Math.sin(th), yaw: -th, s: s + d }); }
  s += arcLen;
  const x0 = R - R * Math.cos(A), z0 = -R * Math.sin(A), fx = Math.sin(A), fz = -Math.cos(A);
  for (let d = 0; d <= 90; d += step) pts.push({ x: x0 + fx * d, z: z0 + fz * d, yaw: -A, s: s + d });
  return pts;
}

export function buildSlice(opts: { embed?: boolean } = {}): SliceWorld {
  const R = rng(7);
  const boxes: BoxDef[] = [], neons: NeonDef[] = [], lights: LightDef[] = [];
  const props: PropDef[] = [], cables: CableDef[] = [], steam: SteamDef[] = [], holos: HoloDef[] = [];
  const path = streetPath(2);
  let hoshiAt: { pos: [number, number, number]; yaw: number } | null = null;

  // ---- ground (cut around the canal) ----
  const G = opts.embed ? { x0: -360, x1: 360, z0: -360, z1: 360 } : { x0: -90, x1: 130, z0: -190, z1: 150 };
  boxes.push(box(G.x0, -2, G.z0, CANAL2.x0, 0, G.z1, 'asphalt', { collide: 'ground', surface: 'asphalt' }));
  boxes.push(box(CANAL2.x1, -2, G.z0, G.x1, 0, G.z1, 'asphalt', { collide: 'ground', surface: 'asphalt' }));
  boxes.push(box(CANAL2.x0, -2, G.z0, CANAL2.x1, 0, CANAL2.z0, 'asphalt', { collide: 'ground', surface: 'asphalt' }));
  boxes.push(box(CANAL2.x0, -2, CANAL2.z1, CANAL2.x1, 0, G.z1, 'asphalt', { collide: 'ground', surface: 'asphalt' }));
  boxes.push(box(CANAL2.x0, CANAL2.floor - 1, CANAL2.z0, CANAL2.x1, CANAL2.floor, CANAL2.z1, 'concrete', { collide: 'ground' }));
  boxes.push(box(CANAL2.x0, CANAL2.water - 0.2, CANAL2.z0, CANAL2.x1, CANAL2.water, CANAL2.z1, 'water', { surface: 'water', collide: 'water' }));
  // canal walls: west wall has the exit ramp gap (z 14..30); north/south closed (south has entry ramp inside)
  boxes.push(box(CANAL2.x0 - 0.6, CANAL2.floor, 30, CANAL2.x0, 0, CANAL2.z1, 'canalWall', { surface: 'concrete' }));
  boxes.push(box(CANAL2.x0 - 0.6, CANAL2.floor, CANAL2.z0, CANAL2.x0, 0, 14, 'canalWall', { surface: 'concrete' }));
  boxes.push(box(CANAL2.x1, CANAL2.floor, CANAL2.z0, CANAL2.x1 + 0.6, 0, CANAL2.z1, 'canalWall', { surface: 'concrete' }));
  boxes.push(box(CANAL2.x0, CANAL2.floor, CANAL2.z0 - 0.6, CANAL2.x1, 0, CANAL2.z0, 'canalWall', { surface: 'concrete' }));
  // ramps start below the water line so their side faces are submerged (no ledges to snag on)
  boxes.push(ramp([21, 0, CANAL2.z1 + 1], [21, CANAL2.water - 0.7, 88], CANAL2.x1 - CANAL2.x0 - 0.4, 'concrete'));
  boxes.push(ramp([CANAL2.x1 - 1, CANAL2.water - 0.7, 22], [CANAL2.x0 - 1, 0, 22], 16, 'concrete'));
  // amber edge strips along the exit ramp sides (they rise out of the water: must read as edges)
  for (const zz of [14.1, 29.9]) neons.push({ pos: [20, -1.1, zz], size: [18, 0.12], yaw: zz < 20 ? Math.PI : 0, color: '#ffa142', text: '', light: 0 });
  // canal railings (solid, low) on the west edge, broken at the exit ramp
  boxes.push(box(CANAL2.x0 - 0.5, 0, 30, CANAL2.x0 - 0.3, 1.0, 92, 'metal', { surface: 'metal' }));
  boxes.push(box(CANAL2.x0 - 0.5, 0, 10, CANAL2.x0 - 0.3, 1.0, 14, 'metal', { surface: 'metal' }));

  // ---- sidewalks + buildings along the street ----
  const corridor = (x: number, z: number) => Math.abs(x - SKY.x) < SKY.w / 2 + 3 && z < SKY.zRampStart && z > SKY.zDownEnd;
  const inCanal = (x: number, z: number) => x > CANAL2.x0 - 2 && x < CANAL2.x1 + 2 && z > CANAL2.z0 - 2 && z < CANAL2.z1 + 2;
  const alleyZ = [34, 46];
  const words = ['RAMEN', 'HOTEL', 'KARAOKE', 'DATA', '24H', 'CLINIC', 'SUSHI', 'PACHINKO', 'BAR', 'LOANS', 'MODS', 'CYBER'];
  const palette = ['#ff2aa8', '#19e6ff', '#ffa142', '#b84dff', '#ff3b5c', '#4dff9a'];
  for (const side of [-1, 1]) {
    let i = 0;
    while (i < path.length - 1) {
      const p = path[i];
      const w = 8 + Math.floor(R() * 4) * 2; // along-street width
      const steps = Math.max(1, Math.round(w / 2));
      const q = path[Math.min(path.length - 1, i + steps)];
      const cx0 = (p.x + q.x) / 2, cz0 = (p.z + q.z) / 2, yaw = (p.yaw + q.yaw) / 2;
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      // sidewalk slab segment
      const sw = { c: [cx0 + rx * side * (ROAD_HW + WALK / 2), 0.075, cz0 + rz * side * (ROAD_HW + WALK / 2)] as [number, number, number], h: [WALK / 2, 0.075, w / 2 + 0.3] as [number, number, number], yaw, mat: 'sidewalk' as const, collide: 'ground' as const, surface: 'concrete' as const };
      const depth = 14 + R() * 10;
      const off = ROAD_HW + WALK + depth / 2;
      const bx = cx0 + rx * side * off, bz = cz0 + rz * side * off;
      const isAlley = side === -1 && p.z < alleyZ[1] && p.z > alleyZ[0] - w && p.x < 1;
      const canalSide = side === 1 && inCanal(cx0 + rx * 12, cz0 + rz * 12);
      if (!canalSide) boxes.push(sw);
      if (!isAlley && !canalSide) {
        let h = 14 + R() * R() * 46 + (side === -1 ? 8 : 0);
        // any part of the footprint under the Skyway corridor → low roof so the deck passes over
        const fwx = -Math.sin(yaw), fwz = -Math.cos(yaw);
        let under = false;
        for (const a of [-0.5, -0.25, 0, 0.25, 0.5]) for (const b of [-0.5, 0, 0.5]) if (corridor(bx + rx * depth * a + fwx * w * b, bz + rz * depth * a + fwz * w * b)) under = true;
        if (under) h = 7.5;
        const seed = Math.floor(R() * 1e6);
        boxes.push(obox(bx, bz, yaw, depth, h, w, R() < 0.55 ? 'facade' : 'facadeB', 0, { lit: 0.2 + R() * 0.35, seed, surface: 'brick' }));
        // ground-floor dressing on the street face
        const fx = cx0 + rx * side * (ROAD_HW + WALK) , fz = cz0 + rz * side * (ROAD_HW + WALK);
        const fyaw = side === 1 ? yaw - Math.PI / 2 : yaw + Math.PI / 2; // plane normal points at the road
        const kind = R();
        const isHoshi = side === -1 && p.z < 70 && p.z > 50;
        const ox = -rx * side * 0.05, oz = -rz * side * 0.05;
        if (isHoshi && !hoshiAt) {
          hoshiAt = { pos: [fx, 1.9, fz], yaw: fyaw };
          props.push({ kind: 'warmwin', pos: [fx + ox, 1.9, fz + oz], yaw: fyaw, size: [w - 1.5, 2.8, 0] });
          props.push({ kind: 'awning', pos: [fx + ox, 3.6, fz + oz], yaw: fyaw, size: [w - 0.6, 0, 1.8], seed: 0.1 });
          for (const t of [-1, 1]) props.push({ kind: 'lantern', pos: [fx + rx * side * -0.9 + Math.sin(yaw) * t * (w / 2 - 1.2) * -1, 3.1, fz + rz * side * -0.9 + Math.cos(yaw) * t * (w / 2 - 1.2) * -1], yaw: 0, size: [0.32, 0, 0] });
          neons.push({ pos: [fx - rx * side * 1.2, 6.0, fz - rz * side * 1.2], size: [1.3, 4.6], yaw, color: '#ffb05a', text: 'HOSHI', vertical: true, light: 26 });
          lights.push({ pos: [fx - rx * side * 2.5, 2.4, fz - rz * side * 2.5], color: '#ffa04a', intensity: 34, range: 14 });
          steam.push({ pos: [fx - rx * side * 1.0, 0.3, fz - rz * side * 1.0 + 2], radius: 0.6, height: 4, tint: '#ffb070' });
        } else if (kind < 0.55) {
          props.push({ kind: 'shopwin', pos: [fx + ox, 1.7, fz + oz], yaw: fyaw, size: [w - 2, 2.4, 0], seed: R() * 100 });
          if (R() < 0.6) props.push({ kind: 'awning', pos: [fx + ox, 3.4, fz + oz], yaw: fyaw, size: [w - 1, 0, 1.4], seed: R() * 10 });
        } else {
          props.push({ kind: 'shutter', pos: [fx + ox, 1.6, fz + oz], yaw: fyaw, size: [w - 1.5, 3.0, 0] });
        }
        // blade signs sticking out over the sidewalk + flat signs
        if (R() < 0.7 && !isHoshi) {
          const col = palette[Math.floor(R() * palette.length)];
          const along = (R() - 0.5) * (w - 3);
          const sx = fx + Math.sin(-yaw) * along * 0 - Math.sin(yaw) * -along - rx * side * 1.0, sz = fz - Math.cos(yaw) * along - rz * side * 1.0;
          neons.push({ pos: [sx, 6 + R() * 8, sz], size: [1.2, 4 + R() * 3], yaw, color: col, text: words[Math.floor(R() * words.length)], vertical: true, flicker: R() < 0.2 ? 0.7 : 0, light: 16 });
        }
        if (R() < 0.5) neons.push({ pos: [fx - rx * side * 0.25, 4.6 + R() * 1.5, fz - rz * side * 0.25], size: [Math.min(w - 2, 6), 1.2], yaw: fyaw, color: palette[Math.floor(R() * palette.length)], text: words[Math.floor(R() * words.length)], light: 0 });
        // AC units + balconies up the facade
        for (let k = 0; k < 4; k++) {
          const y = 5 + R() * Math.max(2, h - 8); if (y > h - 1) continue;
          const along = (R() - 0.5) * (w - 2);
          props.push({ kind: R() < 0.7 ? 'ac' : 'balcony', pos: [fx + Math.sin(yaw) * along * -1 - rx * side * 0.0, y, fz - Math.cos(yaw) * along], yaw: fyaw, size: [0.9, 0.6, 0.5] });
        }
      }
      i += steps;
    }
  }
  // canal-side railing along the street east edge where the canal is
  // far canal bank: tall buildings facing the canal (reflections), clipped under the Skyway corridor
  for (let z = 108; z > 14; z -= 12) {
    const h = SKY.x - SKY.w / 2 - 3 < 44 ? 30 + R() * 30 : 20;
    boxes.push(box(44, 0, z - 11.5, 64, h, z, R() < 0.5 ? 'facade' : 'facadeB', { lit: 0.3 + R() * 0.3, seed: Math.floor(R() * 1e6), surface: 'brick' }));
    if (R() < 0.6) neons.push({ pos: [43.8, 6 + R() * 10, z - 6], size: [1.2, 5], yaw: -Math.PI / 2, color: palette[Math.floor(R() * palette.length)], text: words[Math.floor(R() * words.length)], vertical: true, light: 0 });
  }
  boxes.push(box(CANAL2.x1 + 0.6, 0, 10, 44, 0.15, 112, 'sidewalk', { collide: 'ground', surface: 'concrete' }));

  // ---- alley (west, z 34..46) with courtyard, steam, laundry ----
  const ax0 = -ROAD_HW - WALK, ax1 = -70;
  boxes.push(box(ax1 - 16, 0, 22, ax1, 26, 58, 'facadeB', { lit: 0.35, seed: 4242, surface: 'brick' }));         // courtyard back wall
  boxes.push(box(ax1, 0, 22, ax0 - 20, 18, alleyZ[0] - 0.5 - 6, 'facade', { lit: 0.3, seed: 911, surface: 'brick' }));   // courtyard south
  boxes.push(box(ax1, 0, alleyZ[1] + 0.5 + 6, ax0 - 20, 22, 58, 'facadeB', { lit: 0.3, seed: 912, surface: 'brick' })); // courtyard north
  boxes.push(box(ax0 - 20, 0, 22, ax0 - 0.3, 20, alleyZ[0], 'facade', { lit: 0.25, seed: 913, surface: 'brick' }));
  boxes.push(box(ax0 - 20, 0, alleyZ[1], ax0 - 0.3, 24, 58, 'facadeB', { lit: 0.25, seed: 914, surface: 'brick' }));
  for (let x = ax0 - 3; x > ax1 + 2; x -= 4) {
    cables.push({ a: [x, 7 + R() * 4, alleyZ[0] + 0.1], b: [x + (R() - 0.5) * 2, 7 + R() * 4, alleyZ[1] - 0.1], sag: 0.6, laundry: R() < 0.7 });
    if (R() < 0.5) props.push({ kind: 'ac', pos: [x, 3 + R() * 6, alleyZ[0] + 0.05], yaw: 0, size: [0.9, 0.6, 0.5] });
    if (R() < 0.4) props.push({ kind: 'crate', pos: [x, 0.4, alleyZ[1] - 0.6], yaw: 0, size: [1, 0.8, 0.8] });
  }
  for (const [sx, sz] of [[-30, 40], [-48, 37], [-74, 30], [-80, 50]]) { steam.push({ pos: [sx, 0.1, sz], radius: 0.8, height: 6, tint: '#7f6a9a' }); props.push({ kind: 'vent', pos: [sx, 0.1, sz], yaw: 0, size: [1.2, 0.2, 1.2] }); }
  lights.push({ pos: [-22, 4.5, 40], color: '#ffb36b', intensity: 24, range: 14 }, { pos: [-40, 5.5, 40], color: '#ff4fb0', intensity: 14, range: 12 }, { pos: [-62, 6, 41], color: '#38e8ff', intensity: 24, range: 14 });
  for (const [x, z, col, txt, yy] of [[-30, alleyZ[1] - 0.2, '#ff2aa8', 'MAHJONG', Math.PI], [-46, alleyZ[0] + 0.2, '#ffa142', 'NOODLE', 0], [-66, alleyZ[1] - 0.2, '#4dff9a', 'CLINIC', Math.PI]] as [number, number, string, string, number][])
    neons.push({ pos: [x, 4.2, z], size: [4.2, 1.1], yaw: yy, color: col, text: txt, light: 14 });
  props.push({ kind: 'shopwin', pos: [-36, 1.5, alleyZ[1] - 0.05], yaw: Math.PI, size: [3, 2.2, 0], seed: 3.3 });
  props.push({ kind: 'shopwin', pos: [-56, 1.5, alleyZ[0] + 0.05], yaw: 0, size: [2.4, 2.2, 0], seed: 7.7 });
  lights.push({ pos: [-78, 8, 40], color: '#ffb36b', intensity: 30, range: 18, cone: { dirYaw: 0, dirPitch: -Math.PI / 2, angle: 0.5 } });
  neons.push({ pos: [-85.8, 6, 40], size: [1.4, 5.5], yaw: Math.PI / 2, color: '#ff2aa8', text: 'BAR', vertical: true, light: 20 });
  neons.push({ pos: [-55, 5, alleyZ[0] + 0.2], size: [4, 1.1], yaw: 0, color: '#19e6ff', text: 'MODS', light: 10 });

  // ---- cables + street lamps across the main street ----
  for (let i = 4; i < path.length - 2; i += 9) {
    const p = path[i], rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    cables.push({ a: [p.x - rx * 10, 9 + R() * 5, p.z - rz * 10], b: [p.x + rx * 10, 9 + R() * 5, p.z + rz * 10], sag: 1 + R() * 1.5, r: 0.02 + R() * 0.02 });
    if (i % 18 === 4) {
      for (const side of [-1, 1]) {
        if (side === 1 && inCanal(p.x + rx * 12, p.z + rz * 12)) continue;
        const lx = p.x + rx * side * (ROAD_HW + 0.8), lz = p.z + rz * side * (ROAD_HW + 0.8);
        boxes.push(obox(lx, lz, p.yaw, 0.25, 6.6, 0.25, 'metal', 0, { surface: 'metal' }));
        lights.push({ pos: [lx - rx * side * 1.6, 6.4, lz - rz * side * 1.6], color: '#ff9a40', intensity: 42, range: 20, cone: { dirYaw: 0, dirPitch: -Math.PI / 2, angle: 0.5 } });
      }
    }
  }
  // canal-side lamps + railing lights
  for (let z = 100; z > 20; z -= 20) lights.push({ pos: [CANAL2.x0 - 1, 5.5, z], color: '#5fd8ff', intensity: 22, range: 18, cone: { dirYaw: 0, dirPitch: -Math.PI / 2, angle: 0.45 } });

  // ---- Skyway: ramp up along the canal's east bank, deck north, crosses the street, ramp down ----
  boxes.push(ramp([SKY.x, 0, SKY.zRampStart], [SKY.x, SKY.y, SKY.zRampTop], SKY.w));
  boxes.push(box(SKY.x - SKY.w / 2, SKY.y - 1, SKY.zEnd, SKY.x + SKY.w / 2, SKY.y, SKY.zRampTop, 'deck', { surface: 'concrete' }));
  boxes.push(ramp([SKY.x, SKY.y, SKY.zEnd], [SKY.x, 0, SKY.zDownEnd], SKY.w));
  for (const side of [-1, 1]) {
    const xx = SKY.x + side * (SKY.w / 2 + 0.25);
    boxes.push(box(xx - 0.25, SKY.y, SKY.zEnd, xx + 0.25, SKY.y + 1.1, SKY.zRampTop, 'metal', { surface: 'metal' }));
    for (let z = SKY.zRampTop - 10; z > SKY.zEnd + 5; z -= 24) {
      // pillars, skipping where they would stand in the street
      const pz = z, px = SKY.x + side * (SKY.w / 2 - 0.8);
      const onStreet = path.some((q) => Math.hypot(q.x - px, q.z - pz) < ROAD_HW + WALK + 0.8);
      if (!onStreet) boxes.push(box(px - 0.7, 0, pz - 0.7, px + 0.7, SKY.y - 1, pz + 0.7, 'concrete', { surface: 'concrete' }));
    }
    for (let z = SKY.zRampTop; z > SKY.zEnd; z -= 14) {
      neons.push({ pos: [xx + side * 0.3, SKY.y + 0.6, z], size: [3, 0.25], yaw: side * Math.PI / 2, color: side < 0 ? '#ff2aa8' : '#19e6ff', text: '', light: 0 });
    }
  }
  // underside lights over the underpass (where the Skyway crosses the street)
  for (let z = -48; z > -84; z -= 6) lights.push({ pos: [SKY.x, SKY.y - 1.4, z], color: '#8ff0ff', intensity: 18, range: 12 });
  holos.push({ pos: [70, 34, -40], yaw: -Math.PI / 2 + 0.4, size: [22, 14], color: '#ff4fd0', kind: 'koi' });
  holos.push({ pos: [6, 27, -58], yaw: 0.25, size: [18, 11], color: '#ff4fd0', kind: 'koi' });
  holos.push({ pos: [-24, 30, -20], yaw: Math.PI / 2 - 0.2, size: [10, 14], color: '#3fe6ff', kind: 'face' });
  holos.push({ pos: [58, 18, 70], yaw: -Math.PI / 2, size: [12, 6], color: '#ffa142', kind: 'ad' });

  // ---- plaza at the south end, boundary walls ----
  boxes.push(box(-20, 0, 112, 12, 0.15, 118, 'sidewalk', { collide: 'ground', surface: 'concrete' }));
  if (!opts.embed) for (const [x0, z0, x1, z1] of [[G.x0, G.z0, G.x1, G.z0 + 2], [G.x0, G.z1 - 2, G.x1, G.z1], [G.x0, G.z0, G.x0 + 2, G.z1], [G.x1 - 2, G.z0, G.x1, G.z1]]) boxes.push(box(x0, 0, z0, x1, 40, z1, 'facade', { lit: 0.25, seed: Math.floor(R() * 1e6) }));
  // far skyline (render-only, no collision) to fill the fog with lit towers
  for (let k = 0; k < (opts.embed ? 0 : 40); k++) {
    const a = R() * Math.PI * 2, d = 230 + R() * 140;
    const x = 20 + Math.cos(a) * d, z = -20 + Math.sin(a) * d, h = 40 + R() * 110, w = 14 + R() * 20;
    boxes.push(box(x - w / 2, 0, z - w / 2, x + w / 2, h, z + w / 2, R() < 0.5 ? 'facade' : 'facadeB', { lit: 0.35, seed: Math.floor(R() * 1e6), collide: 'none' }));
  }
  // traffic bollards at the plaza edge (hazard readability)
  for (let x = -6; x <= 6; x += 4) boxes.push(box(x - 0.3, 0, 104.7, x + 0.3, 1.0, 105.3, 'hazard', { surface: 'metal' }));

  const W: SliceWorld = {
    boxes, neons, lights, dressing: { props, cables, steam, holos },
    spawn: { pos: [0, 1, 115], yaw: 0 },
    anchors: hoshiAt ? { hoshi: hoshiAt } : {},
    routes: {
      loop: { pts: [[0, 115], [0, 4], ...path.filter((p, i) => p.z < 0 && i % 4 === 0).map((p) => [p.x, p.z] as [number, number]), [60, -102]], targetTime: [0, 0] },
      skyway: { pts: [[SKY.x, 110], [SKY.x, SKY.zEnd + 2], [SKY.x, SKY.zDownEnd + 5]], targetTime: [0, 0] },
      canal: { pts: [[0, 115], [21, 112], [21, 90], [26, 60], [27.5, 34], [27, 22], [12, 22], [2, 20], [0, 6], [0, 0]], targetTime: [0, 0] },
    },
  };
  for (const r of Object.values(W.routes)) {
    let L = 0; for (let i = 1; i < r.pts.length; i++) L += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
    r.targetTime = [Math.round(L / 34), Math.round(L / 16)];
  }
  return W;
}
