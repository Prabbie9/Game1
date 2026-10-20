// Street furniture placement shared by the hand-authored slice and the procedural Stacks blocks: vending
// machines, bins, benches, stalls, barriers and crates against street-facing walls (the kerb side and the road
// stay clear), rooftop clutter. Solid pieces get a matching collider box (render: false) so physics stays in sync.
import type { BoxDef } from './defs';
import { DECAL, type PropDef } from './kit';

// keep job drops, fixers and spawn clear of furniture
const KEEP_CLEAR: [number, number][] = [[-210, 236], [-300, 236], [0, 104], [290, -50], [-130, -172], [0, 115]];
const clear = (x: number, z: number) => KEEP_CLEAR.every(([a, b]) => Math.hypot(a - x, b - z) > 9);
/** Collider for a prop: local centre (ox, oy, oz) + half extents, rotated by the prop yaw. */
export function solidProp(boxes: BoxDef[], x: number, y: number, z: number, yaw: number, ox: number, oy: number, oz: number, hx: number, hy: number, hz: number) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  boxes.push({ c: [x + ox * c + oz * s, y + oy, z - ox * s + oz * c], h: [hx, hy, hz], yaw, mat: 'metal', surface: 'metal', render: false });
}
export function furnishFace(props: PropDef[], boxes: BoxDef[], R: () => number, cx: number, cz: number, yaw: number, fw: number, blk: [number, number, number, number] | null) {
  // along the wall (tangent t), local +z = the wall normal (toward the street)
  const tx = Math.cos(yaw), tz = -Math.sin(yaw), L = fw - 3;
  for (let d = -L / 2 + R() * 3; d < L / 2; d += 6 + R() * 7) {
    const x = cx + tx * d, z = cz + tz * d, k = R(), seed = R() * 100;
    if (!clear(x, z)) continue;
    // block corners stay open (riders cut the turn across the sidewalk there)
    if (blk && Math.min(Math.abs(x - blk[0]), Math.abs(x - blk[2])) < 6 && Math.min(Math.abs(z - blk[1]), Math.abs(z - blk[3])) < 6) continue;
    const pos: [number, number, number] = [x, 0.15, z];
    if (k < 0.2) {
      props.push({ kind: 'vending', pos, yaw, size: [0, 0, 0], seed }); solidProp(boxes, x, 0.15, z, yaw, 0, 0.95, 0.375, 0.46, 0.95, 0.375);
      if (R() < 0.5 && d + 1 < L / 2) { const x2 = x + tx, z2 = z + tz; props.push({ kind: 'vending', pos: [x2, 0.15, z2], yaw, size: [0, 0, 0], seed: seed + 3.1 }); solidProp(boxes, x2, 0.15, z2, yaw, 0, 0.95, 0.375, 0.46, 0.95, 0.375); d += 1; }
    }
    else if (k < 0.4) { props.push({ kind: 'bin', pos, yaw, size: [0, 0, 0], seed }); solidProp(boxes, x, 0.15, z, yaw, 0, 0.45, 0.35, 0.3, 0.45, 0.3); }
    else if (k < 0.52) { props.push({ kind: 'bench', pos, yaw, size: [0, 0, 0] }); solidProp(boxes, x, 0.15, z, yaw, 0, 0.4, 0.55, 0.9, 0.4, 0.25); }
    else if (k < 0.64) { const w = 2.2 + R() * 1.2; if (d + w / 2 > L / 2) continue; props.push({ kind: 'stall', pos, yaw, size: [w, 0, 0], seed }); solidProp(boxes, x, 0.15, z, yaw, 0, 0.5, 0.75, w / 2, 0.5, 0.45); d += w / 2; }
    else if (k < 0.7) { props.push({ kind: 'barrier', pos, yaw, size: [1.8, 0, 0] }); solidProp(boxes, x, 0.15, z, yaw, 0, 0.5, 0.3, 0.9, 0.5, 0.08); }
    else if (k < 0.78) { props.push({ kind: 'crate', pos: [x + Math.sin(yaw) * 0.5, 0.55, z + Math.cos(yaw) * 0.5], yaw, size: [0.9, 0.8, 0.8] }); solidProp(boxes, x, 0.15, z, yaw, 0, 0.4, 0.5, 0.45, 0.4, 0.4); }
  }
}
export function roofClutter(props: PropDef[], R: () => number, x0: number, z0: number, x1: number, z1: number, h: number) {
  const n = 1 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    const x = x0 + 2.5 + R() * (x1 - x0 - 5), z = z0 + 2.5 + R() * (z1 - z0 - 5), k = R();
    if (k < 0.4) props.push({ kind: 'tank', pos: [x, h, z], yaw: 0, size: [1.1 + R() * 0.8, 0, 0] });
    else if (k < 0.7) props.push({ kind: 'antenna', pos: [x, h, z], yaw: R() * 3, size: [0, 4 + R() * 6, 0] });
    else if (k < 0.85) props.push({ kind: 'dish', pos: [x, h, z], yaw: R() * 6.28, size: [0.6 + R() * 0.6, 0, 0] });
    else props.push({ kind: 'ac', pos: [x, h + 0.4, z], yaw: R() * 6.28, size: [1.4, 0.8, 1.0] });
  }
  if (R() < 0.18) { // big lit sign rig on the front roof edge
    props.push({ kind: 'signrig', pos: [(x0 + x1) / 2, h, z1 - 0.6], yaw: 0, size: [Math.min(10, x1 - x0 - 2), 3 + R() * 2, 0], seed: R() * 100 });
  }
}


const decal = (props: PropDef[], x: number, y: number, z: number, yaw: number, w: number, l: number, type: number, r: number, vertical = 0) =>
  props.push({ kind: 'decal', pos: [x, y, z], yaw, size: [w, l, vertical], seed: type + Math.min(0.999, r) });

/** Road markings + wear along a straight street centreline (a → b), skipping `skip(x, z)` (junctions). */
export function streetDecals(props: PropDef[], R: () => number, ax: number, az: number, bx: number, bz: number, hw: number, skip: (x: number, z: number) => boolean) {
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux;
  const yaw = Math.atan2(ux, uz); // plane length (local y before laying flat) runs along the street
  for (let d = 2; d < L - 2; d += 9) {
    const x = ax + ux * d, z = az + uz * d; if (skip(x, z)) continue;
    decal(props, x, 0, z, yaw, 0.16, 3.2, DECAL.dash, R());
  }
  for (let d = R() * 20; d < L; d += 14 + R() * 26) {
    const o = (R() - 0.5) * hw * 1.6, x = ax + ux * d + nx * o, z = az + uz * d + nz * o; if (skip(x, z)) continue;
    const k = R();
    if (k < 0.5) decal(props, x, 0, z, R() * 6.28, 2 + R() * 4, 2 + R() * 4, DECAL.grime, R());
    else if (k < 0.8) decal(props, x, 0, z, R() * 6.28, 0.6, 3 + R() * 5, DECAL.crack, R());
    else decal(props, x, 0, z, 0, 0.8, 0.8, DECAL.manhole, R());
  }
}
/** Zebra crossing across a street at (x, z): stripes run along the street direction `yaw`, spread across `hw`. */
export function zebra(props: PropDef[], R: () => number, x: number, z: number, yaw: number, hw: number) {
  const nx = Math.cos(yaw), nz = -Math.sin(yaw);
  for (let o = -hw + 0.8; o < hw - 0.5; o += 1.2) decal(props, x + nx * o, 0, z + nz * o, yaw, 0.6, 3, DECAL.zebra, R());
}
/** Posters pasted on a wall face (centre cx, cz, normal yaw, width fw). */
export function posters(props: PropDef[], R: () => number, cx: number, cz: number, yaw: number, fw: number) {
  const tx = Math.cos(yaw), tz = -Math.sin(yaw), nx = Math.sin(yaw), nz = Math.cos(yaw);
  const n = Math.floor(R() * 3);
  for (let i = 0; i < n; i++) { const al = (R() - 0.5) * (fw - 2); decal(props, cx + tx * al + nx * 0.02, 1.4 + R() * 0.8, cz + tz * al + nz * 0.02, yaw, 0.7 + R() * 0.3, 1.0 + R() * 0.3, DECAL.poster, R(), 1); }
}
