// Post chain. Each stage is toggled by the quality tier (and comfort settings):
// scene MRT → SSR (+vertical streak blur = long neon streaks) → GTAO (ambient-ish, spares emissive) → TRAA
// → bloom + anamorphic streak → DoF (speed-scaled) → motion blur (speed-scaled) → lens rain droplets
// → chromatic aberration → vignette + grain → ACES output.
import * as THREE from 'three/webgpu';
import {
  pass, mrt, output, normalView, metalness, roughness, velocity, vec2, vec3, vec4, float, uniform, screenUV, sample,
  packNormalToRGB, unpackRGBToNormal, convertToTexture, smoothstep, step, dot, normalize, positionView, length, mix, luminance, fract, floor, sin, time, clamp, max, uv, Fn,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { film } from 'three/addons/tsl/display/FilmNode.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';
import { motionBlur } from 'three/addons/tsl/display/MotionBlur.js';
import { chromaticAberration } from 'three/addons/tsl/display/ChromaticAberrationNode.js';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';

export interface PostQuality { ssr: boolean; ao: boolean; traa: boolean; dof: boolean; motionBlur: boolean; anamorphic: boolean; lensDrops: boolean; ca: boolean }

export const POST = {
  bloomStrength: uniform(0.5), vignette: uniform(0.45), grain: uniform(0.05), exposure: uniform(1.0),
  ssrIntensity: uniform(1.0), streak: uniform(1.0), aoStrength: uniform(0.8), anamorphic: uniform(0.35),
  focusDist: uniform(6.0), focalLen: uniform(60.0), bokeh: uniform(0.0),
  blurAmount: uniform(0.0), lensWet: uniform(0.0), ca: uniform(0.0),
};

/** Screen-space raindrops on the lens: jittered cells, each drop refracts the image and slides/fades over time. */
const lensDrops = Fn(([img, wet]: any[]) => {
  const p = screenUV.mul(vec2(16.0, 9.0)).mul(1.4);
  const offs = vec2(0, 0).toVar(), mask = float(0).toVar();
  for (let L = 0; L < 2; L++) {
    const q = p.mul(L === 0 ? 1.0 : 2.3).add(L * 7.1);
    const cell = floor(q), f = fract(q);
    const cx = cell.x.mod(61.0), cy = cell.y.mod(53.0);
    const h1 = fract(sin(cx.mul(12.9898).add(cy.mul(78.233)).add(L * 1.37)).mul(43758.5453));
    const h2 = fract(sin(cx.mul(39.3468).add(cy.mul(11.135)).add(L * 2.71)).mul(24634.6345));
    const life = fract(time.mul(0.12 + L * 0.07).add(h1.mul(9.0)));
    const ctr = vec2(h1.mul(0.6).add(0.2), h2.mul(0.6).add(0.2).add(life.mul(life).mul(0.25)));
    const r = h2.mul(0.18).add(0.07).mul(L === 0 ? 1.0 : 0.6);
    const d = f.sub(ctr);
    const k = smoothstep(r, r.mul(0.7), length(d)).mul(smoothstep(1.0, 0.6, life)).mul(step(0.72, fract(h1.mul(7.31).add(h2))));
    offs.addAssign(d.div(r).mul(k).mul(0.012));
    mask.addAssign(k);
  }
  const m = clamp(mask, 0, 1).mul(wet);
  const refr = img.sample(screenUV.sub(offs.mul(wet)));
  return vec4(mix(img.sample(screenUV).rgb, refr.rgb.mul(1.08), m), 1);
});

export class Post {
  pipeline: THREE.RenderPipeline;
  stages: string[] = [];
  constructor(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, pq: PostQuality) {
    this.pipeline = new THREE.RenderPipeline(renderer);
    const scenePass = pass(scene, camera);
    const needMRT = pq.ssr || pq.ao || pq.traa || pq.motionBlur;
    if (needMRT) {
      // SSR weights reflections by the first channel, so write a reflectivity term instead of raw metalness:
      // wet dielectrics (puddles, wet asphalt, glass) reflect by smoothness and Schlick-like grazing fresnel.
      const ndv = clamp(dot(normalView, normalize(positionView).negate()), 0, 1);
      const refl = max(metalness, smoothstep(0.5, 0.03, roughness).mul(float(0.12).add(float(1).sub(ndv).pow(4.0).mul(0.88))));
      scenePass.setMRT(mrt({ output, normal: packNormalToRGB(normalView), metalrough: vec2(refl, roughness), velocity }));
      (scenePass.getTexture('normal') as THREE.Texture).type = THREE.UnsignedByteType;
      (scenePass.getTexture('metalrough') as THREE.Texture).type = THREE.UnsignedByteType;
    }
    const col = scenePass.getTextureNode('output');
    const depth = scenePass.getTextureNode('depth');
    const nrm: any = needMRT ? sample((u: any) => unpackRGBToNormal(scenePass.getTextureNode('normal').sample(u))) : null;
    const vel: any = needMRT ? scenePass.getTextureNode('velocity') : null;
    let img: any = col;

    if (pq.ssr) {
      const mr = scenePass.getTextureNode('metalrough');
      const s: any = ssr(col, depth, nrm, { metalnessNode: mr.r, roughnessNode: mr.g, camera } as any);
      s.quality.value = 0.5; s.maxDistance.value = 60; s.thickness.value = 0.25; s.intensity.value = 1.0; s.resolutionScale = 0.5;
      // long vertical streaks: wet asphalt smears reflections along screen-Y
      const streak = gaussianBlur(s, vec2(0.25, 2.2), 3);
      img = img.add(mix(s.rgb, streak.rgb.mul(1.15), POST.streak).mul(POST.ssrIntensity));
      this.stages.push('ssr');
    }
    if (pq.ao) {
      const a: any = ao(depth, nrm, camera);
      a.resolutionScale = 0.5;
      const aoV = a.getTextureNode().sample(screenUV).r;
      const lum = luminance(img.rgb);
      img = vec4(img.rgb.mul(mix(float(1), aoV, POST.aoStrength.mul(smoothstep(1.2, 0.2, lum)))), 1);
      this.stages.push('gtao');
    }
    if (pq.traa) {
      const t: any = traa(convertToTexture(img), depth, vel, camera);
      img = t; this.stages.push('traa');
    }
    const imgT = convertToTexture(img);
    const b: any = bloom(imgT, 1, 0.4, 0.0);
    b.strength = POST.bloomStrength;
    img = imgT.add(b);
    this.stages.push('bloom');
    if (pq.anamorphic) {
      const bright = convertToTexture(vec4(max(imgT.rgb.sub(1.4), 0), 1));
      const an = gaussianBlur(bright, vec2(2.0, 0.0), 12, { resolutionScale: 0.25 } as any); // small tap step: wide steps ghost lights into rows of discs
      img = img.add(an.rgb.mul(vec3(0.45, 0.65, 1.0)).mul(POST.anamorphic));
      this.stages.push('anamorphic');
    }
    if (pq.dof) {
      img = dof(convertToTexture(img), scenePass.getViewZNode(), POST.focusDist, POST.focalLen, POST.bokeh);
      this.stages.push('dof');
    }
    if (pq.motionBlur) {
      img = motionBlur(convertToTexture(img), vel!.mul(POST.blurAmount), 8 as any);
      this.stages.push('motionblur');
    }
    if (pq.lensDrops) { img = lensDrops(convertToTexture(img), POST.lensWet); this.stages.push('lensdrops'); }
    if (pq.ca) { img = chromaticAberration(convertToTexture(img), POST.ca, vec2(0.5, 0.5) as any, float(1.05) as any); this.stages.push('ca'); }
    const r = length(screenUV.sub(0.5));
    const vig = float(1).sub(smoothstep(0.35, 0.95, r).mul(POST.vignette));
    this.pipeline.outputNode = film(vec4(img.rgb.mul(vig).mul(POST.exposure), 1), POST.grain);
  }
  render() { this.pipeline.render(); }
}
export const _p = { vec3, uv };
