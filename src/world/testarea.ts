// M1 grey-box test area + mood strip. 500 x 500 m grid of blocks, an elevated deck with a hop gap,
// a tunnel, a slalom, a canal with bank ramps, and a wet neon street (z = 180) for the mood test.
import { BoxDef, LightDef, NeonDef, WorldDef } from './defs';

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Slab whose top surface runs from p0 to p1 (centre line), width w, thickness th. */
export function ramp(p0: [number, number, number], p1: [number, number, number], w: number, mat: BoxDef['mat'] = 'deck', th = 1): BoxDef {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2];
  const hl = Math.hypot(dx, dz), L = Math.hypot(hl, dy);
  const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, hl);
  const ux = Math.sin(pitch) * Math.sin(yaw), uy = Math.cos(pitch), uz = Math.sin(pitch) * Math.cos(yaw);
  const mx = (p0[0] + p1[0]) / 2 - ux * th / 2, my = (p0[1] + p1[1]) / 2 - uy * th / 2, mz = (p0[2] + p1[2]) / 2 - uz * th / 2;
  return { c: [mx, my, mz], h: [w / 2, th / 2, L / 2 + 0.05], yaw, pitch, mat, surface: 'concrete' };
}

const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mat: BoxDef['mat'], extra: Partial<BoxDef> = {}): BoxDef => ({
  c: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], h: [Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2], mat, ...extra,
});

export const GRID = [-180, -90, 0, 90, 180];
export const STREET_W = 16;
export const DECK_Y = 10;
export const CANAL = { x0: 200, x1: 232, water: -1.5, floor: -4 };

export function buildTestArea(): WorldDef {
  const R = rng(1337);
  const boxes: BoxDef[] = [];
  const neons: NeonDef[] = [];
  const lights: LightDef[] = [];

  // ground (split around the canal)
  boxes.push(box(-250, -2, -250, CANAL.x0, 0, 250, 'asphalt', { surface: 'asphalt', collide: 'ground' }));
  boxes.push(box(CANAL.x1, -2, -250, 250, 0, 250, 'asphalt', { surface: 'asphalt', collide: 'ground' }));
  boxes.push(box(CANAL.x0, CANAL.floor - 1, -250, CANAL.x1, CANAL.floor, 250, 'concrete', { collide: 'ground' }));
  boxes.push(box(CANAL.x0, CANAL.water - 0.2, -250, CANAL.x1, CANAL.water, 250, 'water', { surface: 'water', collide: 'water' }));
  // canal walls with gaps for bank ramps
  const gapsW = [[-30, -10], [130, 150]], gapsE = [[-130, -110]];
  const wallRun = (x0: number, x1: number, gaps: number[][]) => {
    let z = -250;
    for (const [a, b] of [...gaps, [250, 250]]) { if (a > z) boxes.push(box(x0, CANAL.floor, z, x1, 0, a, 'canalWall', { surface: 'concrete' })); z = b; }
  };
  wallRun(CANAL.x0 - 1, CANAL.x0, gapsW); wallRun(CANAL.x1, CANAL.x1 + 1, gapsE);
  for (const [a, b] of gapsW) boxes.push(ramp([CANAL.x0 - 2, 0, (a + b) / 2], [CANAL.x0 + 12, CANAL.water, (a + b) / 2], b - a, 'concrete'));
  for (const [a, b] of gapsE) boxes.push(ramp([CANAL.x1 + 2, 0, (a + b) / 2], [CANAL.x1 - 12, CANAL.water, (a + b) / 2], b - a, 'concrete'));

  // outer boundary walls
  boxes.push(box(-252, 0, -252, 252, 30, -250, 'greyDark'), box(-252, 0, 250, 252, 30, 252, 'greyDark'));
  boxes.push(box(-252, 0, -250, -250, 30, 250, 'greyDark'), box(250, 0, -250, 252, 30, 250, 'greyDark'));

  // blocks between grid streets
  const edges = [-250, ...GRID, CANAL.x0 - 1];
  const zEdges = [-250, ...GRID, 250];
  const hw = STREET_W / 2;
  for (let i = 0; i < edges.length - 1; i++) {
    for (let j = 0; j < zEdges.length - 1; j++) {
      const x0 = edges[i] + (i === 0 ? 2 : hw + 2), x1 = edges[i + 1] - (i + 1 === edges.length - 1 ? 8 : hw + 2);
      const z0 = zEdges[j] + (j === 0 ? 2 : hw + 2), z1 = zEdges[j + 1] - (j + 1 === zEdges.length - 1 ? 2 : hw + 2);
      if (x1 - x0 < 6 || z1 - z0 < 6) continue;
      // sidewalk slab (low kerb the bike hovers over)
      boxes.push(box(x0 - 2, 0, z0 - 2, x1 + 2, 0.15, z1 + 2, 'sidewalk', { collide: 'ground', surface: 'concrete' }));
      // split block into buildings along x
      let x = x0;
      while (x < x1 - 4) {
        const w = Math.min(x1 - x, 14 + R() * 26);
        const h = 12 + R() * R() * 60;
        // buildings abut so walls have no corner notches to snag on (collisions must slide)
        boxes.push(box(x, 0, z0, x + w, h, z1, R() < 0.5 ? 'facade' : 'facadeB', { lit: 0.15 + R() * 0.35, seed: Math.floor(R() * 1e6), surface: 'brick' }));
        x += w;
      }
    }
  }

  // elevated deck along z = -90 with ramps, side barriers and a hop gap at x 20..26
  const dz = -90, dw = 12;
  boxes.push(ramp([-172, 0, dz], [-100, DECK_Y, dz], dw));
  boxes.push(ramp([100, DECK_Y, dz], [172, 0, dz], dw));
  boxes.push(box(-100, DECK_Y - 1, dz - dw / 2, 20, DECK_Y, dz + dw / 2, 'deck', { surface: 'concrete' }));
  boxes.push(box(26, DECK_Y - 1, dz - dw / 2, 100, DECK_Y, dz + dw / 2, 'deck', { surface: 'concrete' }));
  for (const side of [-1, 1]) {
    boxes.push(box(-100, DECK_Y, dz + side * dw / 2 - 0.3, 20, DECK_Y + 1.1, dz + side * dw / 2 + 0.3, 'metal', { surface: 'metal' }));
    boxes.push(box(26, DECK_Y, dz + side * dw / 2 - 0.3, 100, DECK_Y + 1.1, dz + side * dw / 2 + 0.3, 'metal', { surface: 'metal' }));
    for (let x = -90; x <= 90; x += 22) if (Math.abs(x) > 6) boxes.push(box(x - 0.6, 0, dz + side * 6.8 - 0.6, x + 0.6, DECK_Y - 1, dz + side * 6.8 + 0.6, 'concrete'));
  }
  for (let x = -96; x <= 96; x += 12) lights.push({ pos: [x, DECK_Y + 4.5, dz + (x % 24 === 0 ? -5.5 : 5.5)], color: '#ffb36b', intensity: 30, range: 22 });

  // tunnel over z = 90 from x -80..80
  const tz = 90;
  boxes.push(box(-80, 7, tz - hw - 2, 80, 8.5, tz + hw + 2, 'tunnel', { surface: 'concrete' }));
  for (let x = -76; x <= 76; x += 8) lights.push({ pos: [x, 6.4, tz], color: '#7fe8ff', intensity: 14, range: 12 });

  // slalom bollards on z = 0, x -160..-100
  let k = 0;
  for (let x = -160; x <= -100; x += 12, k++) {
    const zz = (k % 2 ? 3.5 : -3.5);
    boxes.push(box(x - 0.45, 0, zz - 0.45, x + 0.45, 1.2, zz + 0.45, 'hazard', { surface: 'metal' }));
  }

  // mood strip: neon street z = 180, sodium lamps + signs on facades facing the street
  const palette = ['#ff2aa8', '#19e6ff', '#ffa142', '#b84dff', '#ff3b5c'];
  const words = ['NOODLE', 'HOTEL', '24H', 'PACHINKO', 'KARAOKE', 'RAMEN', 'CLINIC', 'BAR', 'DATA', 'SUSHI', 'CYBER', 'LOANS'];
  for (let x = -170, n = 0; x <= 170; x += 17, n++) {
    const north = n % 2 === 0;
    const z = north ? 180 - hw - 2 + 0.2 : 180 + hw + 2 - 0.2;
    const vertical = R() < 0.45;
    const col = palette[n % palette.length];
    neons.push({
      pos: [x + R() * 4 - 2, vertical ? 7 + R() * 3 : 4.2 + R() * 4, z], size: vertical ? [1.4, 5.5] : [6 + R() * 3, 1.5],
      yaw: north ? 0 : Math.PI, color: col, text: words[n % words.length], vertical, flicker: R() < 0.2 ? 0.6 : 0, light: 18,
    });
  }
  for (let x = -165; x <= 165; x += 30) {
    for (const side of [-1, 1]) {
      const z = 180 + side * (hw + 0.8);
      boxes.push(box(x - 0.12, 0, z - 0.12, x + 0.12, 6.5, z + 0.12, 'metal', { surface: 'metal' }));
      lights.push({ pos: [x, 6.3, z - side * 1.6], color: '#ff9a40', intensity: 40, range: 20, cone: { dirYaw: 0, dirPitch: -Math.PI / 2, angle: 0.55 } });
    }
  }

  const W: WorldDef = {
    boxes, neons, lights,
    spawn: { pos: [-150, 1, 180], yaw: -Math.PI / 2 },
    anchors: {
      mood: { pos: [-40, 1.6, 184], yaw: -Math.PI / 2 - 0.12, pitch: -0.03 },
      moodWide: { pos: [-120, 7, 176], yaw: -Math.PI / 2 - 0.08, pitch: -0.12 },
      deck: { pos: [-60, DECK_Y + 1, dz], yaw: -Math.PI / 2 },
      tunnel: { pos: [-70, 1, tz], yaw: -Math.PI / 2 },
      canal: { pos: [216, 0, 0], yaw: Math.PI },
    },
    routes: {
      loop: {
        pts: [[-150, 180], [180, 180], [180, 90], [-90, 90], [-90, 0], [-180, 0], [-180, -90], [-100, -90], [100, -90], [180, -90], [180, -20], [216, -20], [216, 140], [180, 140], [180, 180], [-150, 180]],
        targetTime: [0, 0], // filled below from route length
      },
    },
  };
  // time band from speeds: no faster than ~34 m/s average (all boost), no slower than 18 m/s (sub-cruise)
  for (const r of Object.values(W.routes)) {
    let L = 0; for (let i = 1; i < r.pts.length; i++) L += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
    r.targetTime = [Math.round(L / 34), Math.round(L / 18)];
  }
  return W;
}
