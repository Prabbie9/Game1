// Modelled pursuit craft, built from shared geometry + materials (built once, so a heat spike never compiles
// a new shader mid-chase): patrol cruiser, quad-rotor drone, hound interceptor, heavy sweeper.
// Forward is -z. Children named 'strobe' blink, 'rotor' spins (Pursuer.update drives both).
import * as THREE from 'three/webgpu';
import { profile, glowMat } from '../vehicle/bikeHull';
import { override } from '../assets/overrides';

let K: ReturnType<typeof kit> | null = null;
function kit() {
  const std = (c: number, r: number, m: number) => { const s = new THREE.MeshStandardNodeMaterial(); s.color = new THREE.Color(c); s.roughness = r; s.metalness = m; return s; };
  const M = {
    hull: std(0x2a3040, 0.3, 0.7), ductGlow: glowMat(0xbfe6ff, 2.2), white: std(0x8d939e, 0.35, 0.5), dark: std(0x08090c, 0.6, 0.3), glass: std(0x061018, 0.05, 0.9),
    red: glowMat(0xff2040, 8), blue: glowMat(0x2050ff, 9), white8: glowMat(0xeaf6ff, 8),
    cyan: glowMat(0xbfe6ff, 6), mag: glowMat(0xff2aa8, 6), amber: glowMat(0xfff2c0, 6),
  };
  const lathe = (pts: [number, number][], seg = 18) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  const G = {
    cruiser: profile([[-2.2, -0.2], [-2.25, 0.05], [-1.6, 0.25], [-0.6, 0.38], [-0.2, 0.72], [1.0, 0.74], [1.7, 0.4], [2.15, 0.32], [2.2, -0.2], [1.6, -0.36], [-1.6, -0.36]], 1.9, 0.12),
    cruiserGlass: profile([[-0.15, 0.4], [-0.1, 0.68], [0.95, 0.7], [1.4, 0.42]], 1.94, 0.02),
    pod: lathe([[0.0, -0.6], [0.24, -0.5], [0.3, -0.1], [0.3, 0.3], [0.22, 0.6], [0.0, 0.62]]),
    bell: lathe([[0.12, 0], [0.18, 0.08], [0.24, 0.24], [0.22, 0.26], [0.15, 0.1]]),
    disc: new THREE.CircleGeometry(1, 18),
    box: new THREE.BoxGeometry(1, 1, 1),
    droneBody: lathe([[0.0, -0.32], [0.38, -0.26], [0.55, -0.05], [0.5, 0.12], [0.3, 0.24], [0.0, 0.26]], 20),
    duct: new THREE.TorusGeometry(0.42, 0.06, 6, 22),
    blade: new THREE.BoxGeometry(0.78, 0.015, 0.07),
    lens: new THREE.SphereGeometry(0.16, 12, 8),
    hound: profile([[-2.4, -0.05], [-1.2, 0.18], [0.2, 0.42], [1.4, 0.46], [1.9, 0.2], [1.95, -0.18], [1.2, -0.3], [-1.4, -0.22]], 1.4, 0.08),
    fin: profile([[0, 0], [0.7, 0.1], [0.9, 0.7], [0.65, 0.72]], 0.06, 0.015),
    sweeper: lathe([[0.0, -0.5], [1.1, -0.42], [1.6, -0.1], [1.5, 0.15], [0.9, 0.35], [0.0, 0.42]], 28),
    ring: new THREE.TorusGeometry(1.75, 0.07, 6, 40),
  };
  for (const g of Object.values(G)) g.computeBoundingSphere();
  return { M, G };
}

export function buildCraft(kind: 'drone' | 'patrol' | 'hound' | 'sweeper') {
  const ov = override('vehicles/' + kind); // drop-in GLB (assets/WANTED.md)
  if (ov) { const w = new THREE.Group(); w.add(ov); return w; }
  K ??= kit();
  const { M, G } = K;
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, name = '', parent: THREE.Object3D = g) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx, ry, rz); o.name = name; o.castShadow = true; parent.add(o); return o;
  };
  if (kind === 'patrol') {
    add(G.cruiser, M.hull); add(G.cruiserGlass, M.glass);
    add(G.box, M.white, 0, 0.0, 0, 1.96, 0.16, 2.6);                      // livery band
    add(G.box, M.dark, 0, 0.78, 0.45, 1.0, 0.1, 0.5);                      // light-bar housing
    add(G.box, M.red, -0.32, 0.86, 0.45, 0.42, 0.1, 0.36, 0, 0, 0, 'strobe');
    add(G.box, M.blue, 0.32, 0.86, 0.45, 0.42, 0.1, 0.36, 0, 0, 0, 'strobe');
    for (const s of [-1, 1]) {
      add(G.pod, M.hull, s * 1.15, -0.2, 0.1, 1, 1, 1, Math.PI / 2);      // side thruster pods
      add(G.disc, M.cyan, s * 1.15, -0.2, 0.74, 0.2, 0.2, 1);
      add(G.box, M.white8, s * 0.6, 0.05, -2.24, 0.42, 0.06, 0.04);        // headlights
      add(G.box, M.red, s * 0.6, 0.22, 2.21, 0.4, 0.06, 0.04);             // tail
    }
    add(G.disc, M.red, 0, -0.37, 0, 0.9, 1.6, 1, Math.PI / 2);             // underglow
  } else if (kind === 'drone') {
    add(G.droneBody, M.hull);
    add(G.box, M.cyan, 0, 0.0, -0.52, 0.3, 0.05, 0.04);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * Math.PI / 2, x = Math.cos(a) * 1.0, z = Math.sin(a) * 1.0;
      add(G.box, M.dark, x / 2, 0.05, z / 2, 0.12, 0.06, 1.05, 0, -a + Math.PI / 2);
      add(G.duct, M.hull, x, 0.08, z, 1, 1, 1, Math.PI / 2);
      add(G.duct, M.ductGlow, x, 0.13, z, 1.02, 1.02, 0.3, Math.PI / 2);
      add(G.blade, M.dark, x, 0.1, z, 1, 1, 1, 0, i, 0, 'rotor');
    }
    add(G.lens, M.cyan, 0, -0.3, -0.12);
  } else if (kind === 'hound') {
    add(G.hound, M.hull);
    add(G.box, M.mag, 0, 0.3, 0.3, 1.42, 0.03, 2.2);                       // spine light
    for (const s of [-1, 1]) {
      add(G.fin, M.dark, s * 0.6, 0.3, 0.7, 1, 1, 1, 0, 0, s * -0.35);
      add(G.bell, M.white, s * 0.4, -0.02, 1.85, 1, 1, 1, Math.PI / 2);
      add(G.disc, M.mag, s * 0.4, -0.02, 2.1, 0.17, 0.17, 1);
      add(G.box, M.mag, s * 0.66, 0.06, -1.0, 0.04, 0.04, 1.8);
    }
    add(G.box, M.red, 0, 0.02, -2.32, 0.7, 0.05, 0.04, 0, 0, 0, 'strobe');
  } else {
    add(G.sweeper, M.hull);
    add(G.ring, M.amber, 0, -0.05, 0, 1, 1, 1, Math.PI / 2);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; add(G.box, M.dark, Math.cos(a) * 1.2, 0.3, Math.sin(a) * 1.2, 0.3, 0.12, 0.6, 0, -a); }
    add(G.lens, M.amber, 0, -0.5, 0, 2, 1, 2);
  }
  return g;
}
