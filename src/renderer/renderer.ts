// Renderer setup: WebGPURenderer (automatic WebGL2 fallback), quality tiers, atmosphere (sky, fog,
// reflection probe) and the post-processing chain.
import * as THREE from 'three/webgpu';
import { pass, mrt, output, emissive, uniform, vec2, vec3, vec4, float, screenUV, mix, smoothstep, length, color, fog,
  positionWorld, positionView, exp, clamp, normalWorldGeometry, max, pow, time, mx_noise_float, hash, fract, uv } from 'three/tsl';
import { U, fogDensity as fogDensityU } from '../materials/materials';
import type { PostQuality } from './post';

export type Tier = 'low' | 'medium' | 'high';
export interface Quality {
  tier: Tier; renderScale: number; rain: number; lightPool: number; shadows: number; cones: boolean; post: PostQuality;
  /** humans: crowd density (people per metre of walkway), pooled skinned heroes, VAT bake fps, LOD radii, NPC hero LOD */
  crowd: { density: number; pool: number; vatFps: number; nearR: number; midR: number; farR: number; npcLod: 0 | 1 };
  /** street furniture, decals and roof clutter are drawn only for chunks within this radius (m) */
  detailR: number;
}
export const TIERS: Record<Tier, Quality> = {
  low: { tier: 'low', renderScale: 0.6, rain: 2500, lightPool: 4, shadows: 0, cones: true,
    post: { ssr: false, ao: false, traa: false, dof: false, motionBlur: false, anamorphic: false, lensDrops: true, ca: false },
    crowd: { density: 0.03, pool: 5, vatFps: 6, nearR: 20, midR: 20, farR: 220, npcLod: 1 }, detailR: 90 }, // Low: no VAT band (pooled heroes → silhouettes)
  medium: { tier: 'medium', renderScale: 0.8, rain: 5000, lightPool: 8, shadows: 1024, cones: true,
    post: { ssr: true, ao: false, traa: true, dof: false, motionBlur: true, anamorphic: true, lensDrops: true, ca: true },
    crowd: { density: 0.05, pool: 6, vatFps: 15, nearR: 22, midR: 70, farR: 260, npcLod: 0 }, detailR: 130 },
  high: { tier: 'high', renderScale: 1.0, rain: 9000, lightPool: 12, shadows: 2048, cones: true,
    post: { ssr: true, ao: true, traa: true, dof: true, motionBlur: true, anamorphic: true, lensDrops: true, ca: true },
    crowd: { density: 0.07, pool: 10, vatFps: 15, nearR: 25, midR: 80, farR: 300, npcLod: 0 }, detailR: 170 },
};

export async function createRenderer(container: HTMLElement, forceWebGL: boolean) {
  const renderer = new THREE.WebGPURenderer({ antialias: false, forceWebGL, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  await renderer.init();
  const backend = (renderer.backend as any).isWebGPUBackend ? 'WebGPU' : 'WebGL2';
  return { renderer, backend };
}

/** Sky gradient + city-glow haze, height/distance fog, moon, ambient and a neon reflection probe. */
export class Atmosphere {
  fogColor = uniform(new THREE.Color(0x05070f));
  hazeColor = uniform(new THREE.Color(0x3a1238));
  fogDensity = fogDensityU;
  moon: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  constructor(public scene: THREE.Scene, renderer: THREE.WebGPURenderer, shadowSize: number) {
    const dir = normalWorldGeometry; // background uses view direction
    const h = clamp(dir.y, -1, 1);
    const glow = smoothstep(0.35, -0.05, h);
    const top = vec3(0.004, 0.006, 0.016);
    const sky = mix(top, this.hazeColor.mul(0.55), glow.pow(1.6)).add(this.fogColor.mul(glow.mul(0.6)));
    // faint cloud deck lit from below by the city
    const cloud = mx_noise_float(vec3(dir.x.mul(3.0).add(time.mul(0.004)), dir.z.mul(3.0), h.mul(2.0))).mul(0.5).add(0.5);
    scene.backgroundNode = sky.add(this.hazeColor.mul(cloud.mul(smoothstep(0.05, 0.4, h)).mul(smoothstep(0.9, 0.3, h)).mul(0.08)));
    // fog: exponential with height falloff (thicker near the ground), tinted by city haze up high
    const dist = positionView.z.negate();
    const hf = exp(positionWorld.y.max(0).mul(-0.035));
    const f = float(1).sub(exp(dist.mul(this.fogDensity).mul(hf.mul(0.8).add(0.2)).negate()));
    const fcol = mix(this.fogColor, this.hazeColor.mul(0.5), smoothstep(10, 60, positionWorld.y));
    scene.fogNode = fog(fcol, f);

    this.hemi = new THREE.HemisphereLight(0x3a4a7a, 0x0a0608, 0.12);
    scene.add(this.hemi);
    this.moon = new THREE.DirectionalLight(0x8fa6ff, 0.35);
    this.moon.position.set(-60, 120, -40);
    if (shadowSize > 0) {
      this.moon.castShadow = true; this.moon.shadow.mapSize.set(shadowSize, shadowSize);
      const c = this.moon.shadow.camera as THREE.OrthographicCamera; c.left = -70; c.right = 70; c.top = 70; c.bottom = -70; c.near = 1; c.far = 400;
      this.moon.shadow.bias = -0.0005; this.moon.shadow.normalBias = 0.05;
    }
    scene.add(this.moon); scene.add(this.moon.target);
    scene.environment = this.makeProbe(renderer);
    scene.environmentIntensity = 0.35;
  }

  /** Reflection probe fallback: PMREM of an abstract neon city (glowing panels around a dark horizon). */
  makeProbe(renderer: THREE.WebGPURenderer) {
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x020308);
    const cols = [0xff2aa8, 0x19e6ff, 0xffa142, 0xb84dff, 0xff3b5c, 0xffd28a];
    let s = 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2, r = 30 + rnd() * 20, y = 2 + rnd() * 18;
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(cols[i % cols.length]).multiplyScalar(1.5 + rnd() * 4) });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1 + rnd() * 5, 0.5 + rnd() * 3), m);
      p.position.set(Math.cos(a) * r, y, Math.sin(a) * r); p.lookAt(0, y, 0); env.add(p);
    }
    const haze = new THREE.Mesh(new THREE.SphereGeometry(80, 32, 16), new THREE.MeshBasicMaterial({ color: 0x1a0c22, side: THREE.BackSide }));
    env.add(haze);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: 0x010102 }));
    ground.rotation.x = -Math.PI / 2; env.add(ground);
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(env, 0.02);
    pm.dispose();
    return rt.texture;
  }

  follow(target: THREE.Vector3) {
    this.moon.position.set(target.x - 60, target.y + 120, target.z - 40);
    this.moon.target.position.copy(target);
  }
}

export const _u = { mrt, output, emissive, vec2, color, max, pow, hash, fract, uv };
