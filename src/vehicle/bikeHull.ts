// Hero hover-bike hull: bevelled extruded side profiles (fairing, side pods, seat, screen), lathed thruster
// bells and intake, hover emitters, steering vanes, accent light strips and handlebars that meet the rider's
// hands. Forward is -z. Returns handles the BikeModel animates (vanes, thruster glow, bars).
import * as THREE from 'three/webgpu';

const shape = (pts: [number, number][]) => { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath(); return s; };
/** Side profile (z, y) extruded across x with rounded bevels; centred on x. */
export function profile(pts: [number, number][], width: number, bevel: number, smooth = true) {
  const sh = shape(pts);
  const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.01, width - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 4, curveSegments: 6 });
  g.translate(0, 0, -(width - bevel * 2) / 2); g.rotateY(-Math.PI / 2);
  if (smooth) { g.deleteAttribute('normal'); const m = (g as any).toNonIndexed ? g : g; m.computeVertexNormals(); }
  return g;
}
function phys(col: number, rough: number, metal: number, clear = 0) {
  const m = clear ? new THREE.MeshPhysicalNodeMaterial() : new THREE.MeshStandardNodeMaterial();
  m.color = new THREE.Color(col); m.roughness = rough; m.metalness = metal; if (clear) { (m as any).clearcoat = clear; (m as any).clearcoatRoughness = 0.15; }
  return m;
}
export function glowMat(col: number, k: number) { const m = new THREE.MeshBasicNodeMaterial(); m.color = new THREE.Color(col).multiplyScalar(k); return m; }

export interface HullHandles { vanes: THREE.Object3D[]; flaps: THREE.Object3D[]; thrusterGlow: THREE.MeshBasicNodeMaterial; emitterGlow: THREE.MeshBasicNodeMaterial; setGrips: (l: THREE.Vector3, r: THREE.Vector3) => void }

export function buildHull(body: THREE.Group): HullHandles {
  const paint = phys(0x34405a, 0.3, 0.5, 1), pod = phys(0x4a1438, 0.38, 0.4, 0.6), carbon = phys(0x0b0b0e, 0.55, 0.3),
    chrome = phys(0xa8afba, 0.12, 1.0), seatM = phys(0x111013, 0.75, 0.0), glass = phys(0x0b1620, 0.04, 0.9);
  const accent = glowMat(0xff2aa8, 1.8), cyan = glowMat(0x30e8ff, 3), white = glowMat(0xeaf6ff, 12), red = glowMat(0xff1030, 8);
  const thrusterGlow = glowMat(0x30e8ff, 6), emitterGlow = glowMat(0xff2aa8, 3);
  const add = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent: THREE.Object3D = body) => {
    const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  };
  // main fairing: low nose, raised tank, seat dip, kicked-up tail
  add(profile([[-1.32, 0.02], [-1.16, -0.16], [-0.62, -0.25], [0.55, -0.24], [1.02, -0.1], [1.14, 0.1], [0.98, 0.22], [0.72, 0.27], [0.28, 0.24], [0.06, 0.36],
    [-0.32, 0.44], [-0.72, 0.36], [-1.08, 0.18]], 0.44, 0.06), paint);
  // side pods (wider lower body) with accent light strips along their top edge
  for (const s of [-1, 1]) {
    const p = profile([[-0.98, -0.02], [-0.86, -0.2], [0.62, -0.22], [0.86, -0.04], [0.7, 0.08], [-0.7, 0.1]], 0.14, 0.03);
    add(p, pod, s * 0.27, -0.03, 0);
    add(new THREE.BoxGeometry(0.02, 0.025, 1.36), accent, s * 0.345, 0.075, -0.06);
    add(new THREE.BoxGeometry(0.02, 0.02, 0.5), cyan, s * 0.3, -0.18, 0.52);
  }
  // seat + rear cowl
  add(profile([[-0.05, 0.3], [0.08, 0.38], [0.62, 0.36], [0.78, 0.31], [0.7, 0.26], [0.0, 0.26]], 0.36, 0.04), seatM);
  // windscreen (thin tinted extrusion)
  add(profile([[-0.78, 0.38], [-0.62, 0.58], [-0.55, 0.6], [-0.66, 0.4]], 0.34, 0.012), glass);
  // nose intake: lathed bell with a glowing core
  const intake = new THREE.LatheGeometry([new THREE.Vector2(0.06, 0), new THREE.Vector2(0.15, 0.02), new THREE.Vector2(0.17, 0.12), new THREE.Vector2(0.14, 0.2)], 20);
  add(intake, chrome, 0, 0.0, -1.22, -Math.PI / 2);
  add(new THREE.CircleGeometry(0.12, 20), cyan, 0, 0.0, -1.24, 0, Math.PI);
  // headlights: twin LED slits + low projector
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.16, 0.022, 0.02), white, s * 0.12, 0.13, -1.12, 0, 0, s * -0.15);
  add(new THREE.CylinderGeometry(0.04, 0.05, 0.05, 12), white, 0, -0.08, -1.2, Math.PI / 2);
  // thruster bells (rear): chrome lathe + inner glow + carbon mounts
  const bell = new THREE.LatheGeometry([new THREE.Vector2(0.09, 0), new THREE.Vector2(0.12, 0.06), new THREE.Vector2(0.17, 0.2), new THREE.Vector2(0.2, 0.3), new THREE.Vector2(0.185, 0.31), new THREE.Vector2(0.155, 0.2), new THREE.Vector2(0.1, 0.05)], 22);
  for (const s of [-1, 1]) {
    add(bell, chrome, s * 0.23, -0.04, 0.86, Math.PI / 2);
    add(new THREE.CircleGeometry(0.15, 20), thrusterGlow, s * 0.23, -0.04, 1.08);
    add(new THREE.BoxGeometry(0.08, 0.06, 0.3), carbon, s * 0.16, 0.02, 0.78);
  }
  add(new THREE.BoxGeometry(0.42, 0.03, 0.04), red, 0, 0.17, 1.1, -0.4);                // tail light bar
  // hover emitters under the hull
  for (const z of [-0.75, 0.6]) for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.1, 0.12, 0.05, 16), carbon, s * 0.17, -0.27, z);
    add(new THREE.CircleGeometry(0.085, 16), emitterGlow, s * 0.17, -0.3, z, Math.PI / 2);
  }
  // steering vanes at the front, stabiliser flaps at the rear (animated by steer / speed)
  const vanes: THREE.Object3D[] = [], flaps: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * 0.33, -0.05, -0.82); body.add(piv);
    add(profile([[-0.18, -0.12], [0.16, -0.08], [0.12, 0.08], [-0.14, 0.04]], 0.03, 0.008), carbon, 0, 0, 0, 0, 0, 0, piv);
    add(new THREE.BoxGeometry(0.012, 0.012, 0.28), accent, s * 0.016, 0.02, 0, 0, 0, 0, piv);
    vanes.push(piv);
    const fl = new THREE.Group(); fl.position.set(s * 0.3, 0.12, 0.98); body.add(fl);
    add(profile([[0, 0], [0.22, -0.03], [0.2, 0.05], [0.02, 0.06]], 0.025, 0.006), carbon, 0, 0, 0, 0, 0, 0, fl);
    flaps.push(fl);
  }
  // handlebars: rebuilt when the rider's grip positions are known
  const bars = new THREE.Group(); body.add(bars);
  const setGrips = (l: THREE.Vector3, r: THREE.Vector3) => {
    bars.clear();
    const stemTop = new THREE.Vector3(0, Math.min(l.y, r.y) - 0.06, (l.z + r.z) / 2 + 0.06), stemBase = new THREE.Vector3(0, 0.38, -0.42);
    const curve = new THREE.CatmullRomCurve3([l, new THREE.Vector3(l.x * 0.55, stemTop.y + 0.02, stemTop.z), stemTop, new THREE.Vector3(r.x * 0.55, stemTop.y + 0.02, stemTop.z), r]);
    add(new THREE.TubeGeometry(curve, 24, 0.016, 8), chrome, 0, 0, 0, 0, 0, 0, bars);
    add(new THREE.TubeGeometry(new THREE.LineCurve3(stemBase, stemTop), 2, 0.028, 8), carbon, 0, 0, 0, 0, 0, 0, bars);
    for (const g of [l, r]) add(new THREE.CylinderGeometry(0.022, 0.022, 0.11, 10), seatM, g.x, g.y, g.z, 0, 0, Math.PI / 2, bars);
    add(new THREE.BoxGeometry(0.1, 0.05, 0.02), cyan, 0, stemTop.y + 0.03, stemTop.z, -0.6, 0, 0, bars); // little dash display
  };
  setGrips(new THREE.Vector3(-0.3, 0.62, -0.45), new THREE.Vector3(0.3, 0.62, -0.45));
  return { vanes, flaps, thrusterGlow, emitterGlow, setGrips };
}
