// TSL node materials. Everything is world-space procedural (no UV tiling): wet asphalt with puddles,
// rain ripples and oily sheen; facades with lit window grids; metal; concrete; neon; canal water.
import * as THREE from 'three/webgpu';
import {
  Fn, float, vec2, vec3, color, uniform, mix, smoothstep, step, fract, floor, abs, max, min, sin, clamp, dot, length, normalize,
  positionWorld, normalWorld, time, hash, mx_noise_float, mx_fractal_noise_float, bumpMap, attribute, select, exp,
} from 'three/tsl';

/** Global look uniforms driven by weather / time of day. */
export const U = {
  wet: uniform(1.0),          // 0 dry .. 1 soaked
  rain: uniform(1.0),         // rain intensity (ripples)
  night: uniform(1.0),        // 0 dusk .. 1 deep night (window lighting)
  flicker: uniform(1.0),      // 1 normal, 0 = reduce flicker/flashing
  neonGain: uniform(1.0),
  time,
};

const n2 = (p: any): any => mx_noise_float(vec3((p as any).x, float(0.0), (p as any).y)); // -1..1

/** Rain ripple height field in puddles (expanding rings on a jittered cell grid). */
const rippleHeight = Fn(([p]: any[]) => {
  const out = float(0).toVar();
  for (let layer = 0; layer < 2; layer++) {
    const sc = layer === 0 ? 1.7 : 2.9;
    const q = p.mul(sc).add(layer * 17.3);
    const cell = floor(q);
    const f = fract(q);
    const rnd = hash((cell as any).x.mul(157.0).add((cell as any).y.mul(113.0)).add(layer * 31));
    const rnd2 = hash((cell as any).x.mul(71.0).add((cell as any).y.mul(193.0)).add(layer * 7));
    const ctr = vec2(rnd.mul(0.6).add(0.2), rnd2.mul(0.6).add(0.2));
    const ph = fract(U.time.mul(0.9 + layer * 0.35).add(rnd.mul(7.0)));
    const d = length(f.sub(ctr));
    const r = ph.mul(0.45);
    const ring = sin(d.sub(r).mul(42.0)).mul(smoothstep(0.08, 0.0, abs(d.sub(r)))).mul(float(1).sub(ph)).mul(float(1).sub(ph));
    out.addAssign(ring);
  }
  return out.mul(U.rain);
});

export interface GroundOpts { base: number; tint?: [number, number, number]; puddles: number; grain: number; rough: number }

/** Wet ground: asphalt / sidewalk / deck. */
export function wetGround(o: GroundOpts) {
  const m = new THREE.MeshStandardNodeMaterial();
  const p = positionWorld.xz;
  const big = mx_fractal_noise_float(vec3(p.x.mul(0.035), float(1.3), p.y.mul(0.035)), 3, 2.0, 0.5, 1.0);
  const small = n2(p.mul(0.9));
  const grain = n2(p.mul(9.0)).mul(o.grain);
  // puddle mask: low-frequency noise, sharper edge; only on near-horizontal surfaces
  const up = smoothstep(0.85, 0.98, normalWorld.y);
  const pud = smoothstep(0.32, 0.42, big.mul(0.6).add(small.mul(0.18)).add(o.puddles - 0.5)).mul(U.wet).mul(up);
  const t = o.tint ?? [1, 1, 1];
  const baseCol = vec3(t[0], t[1], t[2]).mul(o.base).mul(float(1).add(big.mul(0.25)).add(grain));
  // wet darkening; puddles darker still (they read through reflections)
  const wetDark = mix(float(1), float(0.62), U.wet);
  m.colorNode = baseCol.mul(wetDark).mul(mix(float(1), float(0.35), pud));
  const dryRough = float(o.rough).add(grain.mul(0.5));
  const wetRough = mix(dryRough, float(0.3).add(small.mul(0.08)).add(grain.mul(0.4)), U.wet);
  m.roughnessNode = clamp(mix(wetRough, float(0.035), pud), 0.02, 1.0);
  m.metalnessNode = float(0.0);
  const h = rippleHeight(p).mul(pud).mul(0.012).add(grain.mul(0.004).mul(float(1).sub(pud)));
  m.normalNode = bumpMap(h, float(1.0));
  return m;
}

/** Building facade with world-space window grid. Uses per-vertex attributes bseed (building id) and blit (lit density). */
export function facade(variant: 'panel' | 'brick') {
  const m = new THREE.MeshStandardNodeMaterial();
  const seed = attribute('bseed', 'float');
  const litD = attribute('blit', 'float');
  const nW = normalWorld;
  const vertical = step(abs(nW.y), float(0.5));
  // horizontal coordinate along the face
  const tan = normalize(vec3(nW.z.negate(), 0, nW.x));
  const u = dot(positionWorld, tan);
  const y = positionWorld.y;
  const cw = float(variant === 'brick' ? 3.6 : 3.0), chh = float(3.4);
  const cu = u.div(cw), cv = y.div(chh);
  const fu = fract(cu), fv = fract(cv);
  // stable per-cell random (sin-hash on small numbers; uint hash showed per-pixel dropout on WebGL2)
  const ci = floor(cu).mod(97.0), cj = floor(cv).mod(89.0), cs = floor(seed.add(0.5)).mod(53.0); // round: interpolated attributes jitter
  const sh = (k: number) => fract(sin(ci.mul(12.9898 + k).add(cj.mul(78.233 - k)).add(cs.mul(37.719 + k))).mul(43758.5453));
  const r = sh(0), r2 = sh(1.7), r3 = sh(3.1);
  const winU = smoothstep(0.22, 0.25, fu).mul(smoothstep(0.78, 0.75, fu));
  const winV = smoothstep(0.3, 0.33, fv).mul(smoothstep(0.78, 0.75, fv));
  const groundFloor = step(y, float(4.2));
  const isWin = winU.mul(winV).mul(vertical).mul(float(1).sub(groundFloor));
  const lit = step(r, litD.mul(mix(0.5, 1.0, U.night))).mul(isWin);
  // warm / cool / magenta interiors, curtains gradient
  const warm = vec3(1.0, 0.55, 0.22), cool = vec3(0.55, 0.85, 1.0), mag = vec3(1.0, 0.3, 0.75);
  const interior = mix(mix(warm, cool, step(0.62, r2)), mag, step(0.9, r2));
  const curtain = mix(float(1), smoothstep(0.2, 0.9, fv).mul(0.7).add(0.3), step(0.5, r3));
  const winGlow = interior.mul(curtain).mul(r3.mul(r3).mul(1.6).add(0.15)).mul(lit);
  // wall surface
  const grime = mx_fractal_noise_float(vec3(u.mul(0.6), y.mul(0.05), seed), 3, 2.0, 0.5, 1.0);
  const streak = n2(vec2(u.mul(3.0), y.mul(0.08).add(seed))).mul(0.5).add(0.5);
  let wall;
  if (variant === 'brick') {
    const bu = u.mul(4.2).add(step(0.5, fract(y.mul(6.6))).mul(0.5));
    const mortar = step(0.9, fract(bu)).max(step(0.86, fract(y.mul(6.6))));
    const brickCol = mix(vec3(0.22, 0.09, 0.07), vec3(0.3, 0.14, 0.1), fract(sin(floor(bu).mod(101.0).mul(12.9898).add(floor(y.mul(6.6)).mod(103.0).mul(78.233))).mul(43758.5453)));
    wall = mix(brickCol, vec3(0.13, 0.12, 0.11), mortar);
  } else {
    const panel = step(0.97, fract(u.div(1.5))).max(step(0.97, fract(y.div(1.7))));
    wall = mix(vec3(0.16, 0.165, 0.18), vec3(0.07, 0.07, 0.08), panel);
  }
  const wallCol = wall.mul(float(0.75).add(grime.mul(0.35))).mul(mix(float(1), streak.mul(0.5).add(0.55), U.wet));
  const glass = vec3(0.02, 0.025, 0.03);
  // roofs (horizontal faces): dark tar
  const roof = vec3(0.05, 0.05, 0.055).mul(float(1).add(grime.mul(0.3)));
  const base = mix(roof, mix(wallCol, glass, isWin), vertical);
  m.colorNode = base.mul(mix(float(1), float(0.7), U.wet));
  m.roughnessNode = clamp(mix(mix(float(0.85), float(0.45), U.wet.mul(streak)), float(0.08), isWin), 0.05, 1);
  m.metalnessNode = isWin.mul(0.2);
  m.emissiveNode = winGlow;
  return m;
}

export function metal(col = 0x3a3d44, rough = 0.35) {
  const m = new THREE.MeshStandardNodeMaterial();
  const p = positionWorld;
  const scratch = mx_noise_float(p.mul(vec3(2.0, 12.0, 2.0)));
  m.colorNode = color(col).mul(float(0.85).add(scratch.mul(0.15)));
  m.roughnessNode = clamp(float(rough).add(scratch.mul(0.12)).sub(U.wet.mul(0.12)), 0.08, 1);
  m.metalnessNode = float(0.85);
  return m;
}

export function concrete(col = 0x55565a, rough = 0.8) {
  const m = new THREE.MeshStandardNodeMaterial();
  const p = positionWorld;
  const n = mx_fractal_noise_float(p.mul(0.4), 3, 2.0, 0.5, 1.0);
  const fine = mx_noise_float(p.mul(6.0));
  const streak = mx_noise_float(vec3(p.x.mul(2.0).add(p.z.mul(2.0)), p.y.mul(0.1), 0)).mul(0.5).add(0.5);
  m.colorNode = color(col).mul(float(0.8).add(n.mul(0.3)).add(fine.mul(0.05))).mul(mix(float(1), float(0.65).add(streak.mul(0.2)), U.wet));
  m.roughnessNode = clamp(mix(float(rough), float(0.4).add(streak.mul(0.3)), U.wet), 0.1, 1);
  m.metalnessNode = float(0);
  return m;
}

/** Amber hazard stripes (obstacles must read at speed). */
export function hazard() {
  const m = new THREE.MeshStandardNodeMaterial();
  const p = positionWorld;
  const s = step(0.5, fract(p.x.add(p.y).add(p.z).mul(1.6)));
  m.colorNode = mix(vec3(0.02, 0.02, 0.02), vec3(0.9, 0.45, 0.05), s);
  m.emissiveNode = vec3(1.0, 0.45, 0.05).mul(s).mul(0.9);
  m.roughnessNode = float(0.4);
  return m;
}

/** Unlit emissive strip (kerbs, tunnel lights). Kept moderate so bloom stays readable. */
/** Fog-equivalent fade for additive / unlit effects (multiply instead of mixing toward fog colour). */
export const fogDensity = uniform(0.016);
export function distFade() {
  const { positionView } = THREE.TSL as any;
  return exp(positionView.z.mul(fogDensity).mul(0.85));
}

export function emissive(col: number, strength: number) {
  const m = new THREE.MeshBasicNodeMaterial();
  m.colorNode = color(col).mul(strength);
  return m;
}

/** Neon sign face: canvas texture as emissive with tube flicker. */
export function neon(tex: THREE.Texture, col: THREE.Color, strength: number, flicker: number, seed: number) {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  const { texture: tx, uv } = THREE.TSL as any;
  const s = tx(tex, uv());
  const fl = float(1).sub(step(0.82, mx_noise_float(vec3(U.time.mul(9.0), seed, 0))).mul(flicker).mul(U.flicker).mul(0.85));
  m.colorNode = vec3(col.r, col.g, col.b).mul(s.r.mul(strength).add(s.g.mul(0.9))).mul(fl).mul(U.neonGain).mul(distFade());
  m.opacityNode = clamp(s.r.add(s.g), 0, 1);
  m.blending = THREE.AdditiveBlending;
  m.fog = false;
  return m;
}

/** Canal water: very smooth, scrolling wind ripples + rain rings. */
export function water() {
  const m = new THREE.MeshStandardNodeMaterial();
  const p = positionWorld.xz;
  const w1 = mx_noise_float(vec3(p.x.mul(0.25).add(U.time.mul(0.15)), U.time.mul(0.1), p.y.mul(0.6)));
  const h = w1.mul(0.03).add(rippleHeight(p).mul(0.01));
  m.colorNode = vec3(0.008, 0.012, 0.018);
  m.roughnessNode = float(0.03);
  m.metalnessNode = float(0.0);
  m.normalNode = bumpMap(h, float(1.0));
  return m;
}

/** Fake volumetric light shaft (additive cone). v = 0 at the lamp, 1 at the base. */
export function lightCone(col: THREE.Color, strength: number) {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const { uv, positionView, normalView } = THREE.TSL as any;
  const v = uv().y;
  const fres = abs(dot(normalize(positionView).negate(), normalView));
  const dust = mx_noise_float(vec3(positionWorld.x.mul(0.7), positionWorld.y.mul(0.7).add(U.time.mul(0.6)), positionWorld.z.mul(0.7))).mul(0.25).add(0.75);
  const fade = float(1).sub(v).pow(1.6).mul(smoothstep(0.0, 0.08, v));
  m.colorNode = vec3(col.r, col.g, col.b).mul(fade.mul(fres.pow(3.0)).mul(dust).mul(strength)).mul(distFade());
  m.blending = THREE.AdditiveBlending;
  m.fog = false; // additive: scene fog would add fog colour over the whole cone
  return m;
}

export const _unused = { max, min, exp, sin };
