// Drop-in asset overrides. Any assets/**/*.glb present at build time is bundled (inlined as base64 by the
// single-file build) and loaded asynchronously before the scene is built. Code asks override('vehicles/bike')
// and gets a fresh clone, or null → the procedural model is used. With no files present this costs nothing.
// See assets/WANTED.md for names, scale and orientation conventions.
import type * as THREE from 'three/webgpu';

// import.meta.glob only exists under Vite (Node bot tests import heat/craft without it: import.meta.env is undefined there)
const FILES = (import.meta.env ? import.meta.glob('/assets/**/*.glb', { query: '?url', import: 'default', eager: true }) : {}) as Record<string, string>;
const loaded = new Map<string, THREE.Object3D>();

export const overrideNames = () => Object.keys(FILES).map((k) => k.replace(/^\/assets\//, '').replace(/\.glb$/, ''));

/** Load every bundled GLB (one per tick so a big file never blocks the page). Failures fall back silently. */
export async function loadOverrides(onStatus?: (s: string) => void, tick: () => Promise<void> = async () => {}) {
  const names = Object.keys(FILES);
  if (!names.length) return 0;
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  let i = 0;
  for (const k of names) {
    onStatus?.(`LOADING ASSETS ${++i}/${names.length}`);
    try { const g = await loader.loadAsync(FILES[k]); loaded.set(k.replace(/^\/assets\//, '').replace(/\.glb$/, ''), g.scene); }
    catch (e) { console.warn('asset override failed, using procedural', k, e); }
    await tick();
  }
  return loaded.size;
}

/** A clone of the named override (e.g. 'vehicles/bike'), or null when none was supplied. */
export function override(name: string): THREE.Object3D | null {
  const o = loaded.get(name); if (!o) return null;
  const c = o.clone(true); c.traverse((m: any) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return c;
}
