// Photo mode (P): freezes the sim, free-flying camera (drive axes move, mouse looks, hop keys rise/fall),
// panel with FOV, focus, bokeh, exposure, time of day, rain, vignette, grain, bike visibility and a capture
// button (PNG via the viewer's downloads capability when hosted, a plain download offline).
import * as THREE from 'three/webgpu';
import type { ActionState } from '../input/actions';
import { glyph } from '../input/actions';
import { POST } from '../renderer/post';

export class PhotoMode {
  active = false;
  pos = new THREE.Vector3(); yaw = 0; pitch = 0; fov = 50;
  focus = 8; bokeh = 1.2; exposure = 1; time = 23.5; rain = 1; vignette = 0.45; grain = 0.05; showBike = true;
  private el: HTMLDivElement;
  constructor(private hooks: { setTime: (h: number) => void; setRain: (r: number) => void; bike: THREE.Object3D; capture: () => Promise<void>; onExit: () => void }) {
    this.el = document.createElement('div');
    this.el.className = 'panel tune';
    this.el.style.cssText = 'display:none;left:16px;right:auto;top:16px;width:300px;pointer-events:auto';
    document.getElementById('nc-ui')!.appendChild(this.el);
  }

  enter(cam: THREE.PerspectiveCamera, time: number, rain: number) {
    this.active = true; this.pos.copy(cam.position);
    const d = new THREE.Vector3(); cam.getWorldDirection(d);
    this.yaw = Math.atan2(-d.x, -d.z); this.pitch = Math.asin(d.y); this.fov = cam.fov; this.time = time; this.rain = rain;
    this.focus = 8; this.render(); this.el.style.display = 'block';
  }
  exit() { this.active = false; this.el.style.display = 'none'; this.hooks.bike.visible = true; POST.exposure.value = 1; POST.vignette.value = 0.45; POST.grain.value = 0.05; this.hooks.onExit(); }

  private render() {
    const rows: [string, keyof PhotoMode, number, number, number, (v: number) => void][] = [
      ['FOV', 'fov', 20, 100, 1, () => {}], ['Focus (m)', 'focus', 1, 80, 0.5, () => {}], ['Bokeh', 'bokeh', 0, 4, 0.1, () => {}],
      ['Exposure', 'exposure', 0.3, 2.5, 0.05, () => {}], ['Time of day', 'time', 18, 29, 0.25, (v) => this.hooks.setTime(v >= 24 ? v - 24 : v)],
      ['Rain', 'rain', 0, 1, 0.05, (v) => this.hooks.setRain(v)], ['Vignette', 'vignette', 0, 1, 0.05, () => {}], ['Grain', 'grain', 0, 0.3, 0.01, () => {}],
    ];
    this.el.innerHTML = `<h2>PHOTO MODE</h2><p style="font-size:12px;color:var(--nc-dim);margin:0 0 8px">${glyph('throttle')} / ${glyph('steer')} move · ${glyph('hopLeft')}/${glyph('hopRight')} down/up · mouse drag look · ${glyph('photo')} exit</p><div class="rows"></div>
      <div class="presets"><button class="cap">Capture PNG</button><button class="bike">Hide bike</button><button class="ex">Exit</button></div>`;
    const box = this.el.querySelector('.rows')!;
    for (const [label, key, mn, mx, st, on] of rows) {
      const r = document.createElement('div'); r.className = 'row';
      r.innerHTML = `<label for="ph-${key}">${label}</label><input id="ph-${key}" type="range" min="${mn}" max="${mx}" step="${st}" value="${this[key]}"><span class="val">${this[key]}</span>`;
      const inp = r.querySelector('input')!; inp.oninput = () => { (this as any)[key] = +inp.value; r.querySelector('.val')!.textContent = inp.value; on(+inp.value); };
      box.appendChild(r);
    }
    (this.el.querySelector('.cap') as HTMLButtonElement).onclick = () => { this.el.style.visibility = 'hidden'; this.hooks.capture().finally(() => { this.el.style.visibility = ''; }); };
    (this.el.querySelector('.bike') as HTMLButtonElement).onclick = (e) => { this.showBike = !this.showBike; this.hooks.bike.visible = this.showBike; (e.target as HTMLElement).textContent = this.showBike ? 'Hide bike' : 'Show bike'; };
    (this.el.querySelector('.ex') as HTMLButtonElement).onclick = () => this.exit();
  }

  update(dt: number, a: ActionState, look: { dx: number; dy: number }, cam: THREE.PerspectiveCamera) {
    this.yaw -= look.dx; this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch - look.dy));
    const f = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    const r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const sp = (a.down.boost ? 18 : 6) * dt;
    this.pos.addScaledVector(f, a.axes.throttle * sp).addScaledVector(r, a.axes.steer * sp);
    this.pos.y += ((a.down.hopRight ? 1 : 0) - (a.down.hopLeft ? 1 : 0)) * sp;
    this.pos.y = Math.max(0.3, this.pos.y);
    cam.position.copy(this.pos); cam.up.set(0, 1, 0); cam.lookAt(this.pos.clone().add(f)); cam.fov = this.fov; cam.updateProjectionMatrix();
    POST.focusDist.value = this.focus; POST.focalLen.value = 12 + this.focus * 0.8; POST.bokeh.value = this.bokeh;
    POST.exposure.value = this.exposure; POST.vignette.value = this.vignette; POST.grain.value = this.grain; POST.blurAmount.value = 0;
  }
}
