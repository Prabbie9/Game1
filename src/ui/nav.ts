// Navigation + job UI: heat pips and detection warning, compass strip with objective marker, minimap,
// full map (Tab), fixer prompts, dialogue box with synthesized blips, job timer panel, rating card, garage.
// All DOM, readable against bright neon (dark plates + text shadows).
import type { WorldDef } from '../world/defs';
import { glyph } from '../input/actions';
import type { Rating, JobDef } from '../jobs/jobs';

const CSS = `
.nav-top{position:absolute;left:50%;top:14px;transform:translateX(-50%);width:min(560px,70vw);height:30px;overflow:hidden;background:rgba(4,6,12,.55);border:1px solid rgba(25,230,255,.18)}
.nav-top .tk{position:absolute;top:6px;font-size:13px;color:var(--nc-dim);transform:translateX(-50%);letter-spacing:2px}
.nav-top .tk.c{color:var(--nc-fg);font-weight:700}.nav-top .obj{position:absolute;top:0;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:12px solid var(--nc-amb);transform:translateX(-50%);filter:drop-shadow(0 0 6px var(--nc-amb))}
.nav-dist{position:absolute;left:50%;top:48px;transform:translateX(-50%);font-size:14px;letter-spacing:3px;color:var(--nc-amb);text-shadow:0 0 6px #000,0 0 2px #000}
.heat{position:absolute;right:36px;top:18px;display:flex;gap:6px;align-items:center}
.heat i{width:13px;height:13px;transform:rotate(45deg);border:1.5px solid rgba(255,80,100,.5);background:rgba(0,0,0,.4)}
.heat i.on{background:#ff3050;box-shadow:0 0 10px #ff3050;border-color:#ff8090}
.heat span{font-size:12px;letter-spacing:3px;color:var(--nc-dim);margin-right:6px}
.detect{position:absolute;left:50%;top:76px;transform:translateX(-50%);width:220px;height:6px;background:rgba(0,0,0,.5);border:1px solid rgba(255,200,80,.4);opacity:0;transition:opacity .2s}
.detect b{display:block;height:100%;width:0;background:linear-gradient(90deg,#ffd040,#ff3050)}
.detect-l{position:absolute;left:50%;top:86px;transform:translateX(-50%);font-size:12px;letter-spacing:4px;color:#ffd040;text-shadow:0 0 6px #000;opacity:0}
.minimap{position:absolute;left:24px;top:18px;width:170px;height:170px;border-radius:50%;overflow:hidden;border:1px solid rgba(25,230,255,.35);background:rgba(4,6,12,.7)}
.fullmap{position:absolute;inset:6vh 0 0 0;margin:auto;width:min(80vh,92vw);height:min(80vh,92vw);background:rgba(4,6,12,.92);border:1px solid rgba(25,230,255,.35);display:none;pointer-events:auto}
.fullmap .lg{position:absolute;left:12px;bottom:10px;font-size:13px;color:var(--nc-dim);letter-spacing:1px}
.prompt{position:absolute;left:50%;bottom:22%;transform:translateX(-50%);font-size:18px;letter-spacing:2px;padding:8px 16px;background:rgba(4,6,12,.75);border:1px solid rgba(255,161,66,.5);display:none}
.prompt b{color:#000;background:var(--nc-amb);padding:0 6px;margin-right:8px}
.dialog{position:absolute;left:50%;bottom:9%;transform:translateX(-50%);width:min(720px,90vw);padding:16px 20px;background:rgba(4,6,12,.88);border-left:3px solid var(--nc-amb);display:none;pointer-events:auto}
.dialog .who{font-size:13px;letter-spacing:4px;margin-bottom:6px}.dialog .txt{font-size:20px;line-height:1.4;min-height:56px}.dialog .hint{font-size:12px;color:var(--nc-dim);margin-top:8px;letter-spacing:2px}
.jobp{position:absolute;right:36px;top:46px;text-align:right;display:none;text-shadow:0 0 8px #000}
.jobp .ti{font-size:13px;letter-spacing:3px;color:var(--nc-dim)}.jobp .tm{font-size:34px;font-weight:700;font-variant-numeric:tabular-nums}.jobp .ob{font-size:14px;color:var(--nc-amb)}
.card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,90vw);padding:22px 26px;background:rgba(4,6,12,.92);border:1px solid rgba(25,230,255,.3);display:none;pointer-events:auto}
.card h2{margin:0 0 4px;letter-spacing:5px}.card .row{display:flex;justify-content:space-between;font-size:17px;margin:6px 0}.card .st{color:var(--nc-amb);letter-spacing:3px}
.card p{color:var(--nc-dim);font-size:15px;line-height:1.5}.card .big{font-size:30px;color:var(--nc-amb);letter-spacing:6px;margin:8px 0}
`;

export class NavUI {
  root: HTMLElement;
  private comp: HTMLDivElement; private obj: HTMLDivElement; private dist: HTMLDivElement; private ticks: HTMLDivElement[] = [];
  private heatEl: HTMLDivElement; private det: HTMLDivElement; private detL: HTMLDivElement;
  private mini: HTMLCanvasElement; private full: HTMLCanvasElement; private fullWrap: HTMLDivElement;
  private prompt: HTMLDivElement; private dlg: HTMLDivElement; private jobp: HTMLDivElement; private card: HTMLDivElement;
  private mapImg: HTMLCanvasElement;
  mapOpen = false;
  private dlgLines: string[] = []; private dlgI = 0; private dlgChar = 0; private dlgDone: (() => void) | null = null; private dlgT = 0;
  blip: (pitch: number) => void = () => {};
  dlgPitch = 1;
  constructor(parent: HTMLElement, private world: WorldDef, private bounds = 360, private cx = 0, private cz = 0) {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    this.root = parent;
    const mk = (cls: string, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; parent.appendChild(d); return d; };
    this.comp = mk('nav-top');
    for (const [lbl] of [['N'], ['E'], ['S'], ['W']]) { const t = document.createElement('div'); t.className = 'tk c'; t.textContent = lbl; this.comp.appendChild(t); this.ticks.push(t); }
    for (let i = 0; i < 8; i++) { const t = document.createElement('div'); t.className = 'tk'; t.textContent = '|'; this.comp.appendChild(t); this.ticks.push(t); }
    this.obj = document.createElement('div'); this.obj.className = 'obj'; this.comp.appendChild(this.obj);
    this.dist = mk('nav-dist');
    this.heatEl = mk('heat', '<span>HEAT</span>' + '<i></i>'.repeat(5));
    this.det = mk('detect', '<b></b>'); this.detL = mk('detect-l', 'BEING SPOTTED');
    this.mini = document.createElement('canvas'); this.mini.width = this.mini.height = 170; this.mini.className = 'minimap'; parent.appendChild(this.mini);
    this.fullWrap = mk('fullmap', `<div class="lg">${glyph('map')} close · amber = objective · coloured rings = fixers</div>`);
    this.full = document.createElement('canvas'); this.full.width = this.full.height = 900; this.full.style.cssText = 'width:100%;height:100%'; this.fullWrap.prepend(this.full);
    this.prompt = mk('prompt'); this.dlg = mk('dialog', '<div class="who"></div><div class="txt"></div><div class="hint"></div>');
    this.jobp = mk('jobp', '<div class="ti"></div><div class="tm"></div><div class="ob"></div>');
    this.card = mk('card');
    this.mapImg = this.renderMapImage();
  }

  /** Pre-render the zone's building footprints once (top-down), used by minimap + full map. */
  private renderMapImage() {
    const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d')!;
    const s = 1024 / (this.bounds * 2), X = (x: number) => (x + this.bounds) * s, Xx = (x: number) => X(x - this.cx), Xz = (z: number) => X(z - this.cz);
    g.fillStyle = '#0d1424'; g.fillRect(0, 0, 1024, 1024);
    for (const b of this.world.boxes) {
      if (b.mat === 'asphalt' || b.c[1] < -20) continue; // skip ground + hidden interiors
      const col = b.mat === 'water' ? '#0b3550' : b.mat === 'deck' ? '#5a3a6a' : b.mat === 'sidewalk' ? '#1c2438' : b.h[1] > 2 ? '#03050a' : null;
      if (!col) continue;
      g.save(); g.translate(Xx(b.c[0]), Xz(b.c[2])); g.rotate(-(b.yaw ?? 0)); g.fillStyle = col;
      const pz = b.pitch ? Math.cos(b.pitch) : 1;
      g.fillRect(-b.h[0] * s, -b.h[2] * s * pz, b.h[0] * 2 * s, b.h[2] * 2 * s * pz); g.restore();
    }
    return c;
  }

  update(p: { x: number; z: number; yaw: number }, camYaw: number, objective: { x: number; z: number } | null, markers: { x: number; z: number; color: string }[],
    heat: number, meter: number, seen: boolean) {
    // compass: camYaw 0 = north (-z). Bearing of world dir (dx,dz): atan2(dx, -dz)
    const W = this.comp.clientWidth || 500, fov = Math.PI * 0.9;
    const place = (el: HTMLElement, bearing: number) => { let d = bearing - (-camYaw); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; el.style.display = Math.abs(d) < fov / 2 ? '' : 'none'; el.style.left = (W / 2 + d / (fov / 2) * (W / 2)) + 'px'; };
    this.ticks.forEach((t, i) => place(t, i < 4 ? i * Math.PI / 2 : (i - 4) * Math.PI / 4 + Math.PI / 8));
    if (objective) {
      const dx = objective.x - p.x, dz = objective.z - p.z;
      place(this.obj, Math.atan2(dx, -dz)); this.obj.style.visibility = 'visible';
      this.dist.textContent = Math.round(Math.hypot(dx, dz)) + ' M';
    } else { this.obj.style.visibility = 'hidden'; this.dist.textContent = ''; }
    Array.from(this.heatEl.querySelectorAll('i')).forEach((el, i) => el.classList.toggle('on', i < Math.ceil(heat - 0.01)));
    this.det.style.opacity = meter > 0.02 ? '1' : '0'; this.detL.style.opacity = meter > 0.02 && meter < 1 ? '1' : '0';
    (this.det.firstChild as HTMLElement).style.width = (meter * 100) + '%';
    this.detL.textContent = seen ? 'BEING SPOTTED' : 'LOSING THEM';
    this.drawMini(p, camYaw, objective, markers);
    if (this.mapOpen) this.drawFull(p, objective, markers);
  }

  private drawMini(p: { x: number; z: number }, camYaw: number, objective: { x: number; z: number } | null, markers: { x: number; z: number; color: string }[]) {
    const g = this.mini.getContext('2d')!, R = 85, scale = 1024 / (this.bounds * 2), zoom = 0.55; // ~150 m radius
    g.save(); g.clearRect(0, 0, 170, 170); g.translate(R, R); g.rotate(camYaw); g.scale(zoom * 2.4, zoom * 2.4);
    g.drawImage(this.mapImg, -(p.x - this.cx + this.bounds) * scale, -(p.z - this.cz + this.bounds) * scale);
    g.restore();
    const toMini = (x: number, z: number) => {
      const dx = (x - p.x) * scale * zoom * 2.4, dz = (z - p.z) * scale * zoom * 2.4, c = Math.cos(camYaw), s = Math.sin(camYaw);
      let u = dx * c - dz * s, v = dx * s + dz * c; const l = Math.hypot(u, v); if (l > R - 8) { u *= (R - 8) / l; v *= (R - 8) / l; }
      return [R + u, R + v];
    };
    for (const m of markers) { const [u, v] = toMini(m.x, m.z); g.strokeStyle = m.color; g.lineWidth = 2; g.beginPath(); g.arc(u, v, 5, 0, 7); g.stroke(); }
    if (objective) { const [u, v] = toMini(objective.x, objective.z); g.fillStyle = '#ffa142'; g.beginPath(); g.arc(u, v, 6, 0, 7); g.fill(); }
    g.fillStyle = '#e9f3ff'; g.beginPath(); g.moveTo(R, R - 7); g.lineTo(R + 5, R + 5); g.lineTo(R - 5, R + 5); g.fill();
  }

  private drawFull(p: { x: number; z: number; yaw?: number }, objective: { x: number; z: number } | null, markers: { x: number; z: number; color: string }[]) {
    const g = this.full.getContext('2d')!, S = 900 / (this.bounds * 2), Xx = (v: number) => (v - this.cx + this.bounds) * S, Xz = (v: number) => (v - this.cz + this.bounds) * S;
    g.drawImage(this.mapImg, 0, 0, 900, 900);
    for (const m of markers) { g.strokeStyle = m.color; g.lineWidth = 3; g.beginPath(); g.arc(Xx(m.x), Xz(m.z), 9, 0, 7); g.stroke(); }
    if (objective) { g.fillStyle = '#ffa142'; g.beginPath(); g.arc(Xx(objective.x), Xz(objective.z), 9, 0, 7); g.fill(); }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(Xx(p.x), Xz(p.z), 6, 0, 7); g.fill();
  }
  toggleMap(on?: boolean) { this.mapOpen = on ?? !this.mapOpen; this.fullWrap.style.display = this.mapOpen ? 'block' : 'none'; }

  showPrompt(text: string | null) { if (!text) { this.prompt.style.display = 'none'; return; } this.prompt.innerHTML = text; this.prompt.style.display = 'block'; }

  // ---- dialogue (typewriter + blips) ----
  get dialogOpen() { return this.dlg.style.display === 'block'; }
  dialog(who: string, color: string, lines: string[], hint: string, done: () => void) {
    this.dlgLines = lines; this.dlgI = 0; this.dlgChar = 0; this.dlgDone = done;
    (this.dlg.querySelector('.who') as HTMLElement).textContent = who.toUpperCase(); (this.dlg.querySelector('.who') as HTMLElement).style.color = color;
    this.dlg.style.borderLeftColor = color;
    (this.dlg.querySelector('.hint') as HTMLElement).textContent = hint;
    this.dlg.style.display = 'block';
  }
  /** Returns true when the dialogue consumed the advance press. */
  dialogTick(dt: number, advance: boolean) {
    if (!this.dialogOpen) return false;
    const line = this.dlgLines[this.dlgI] ?? '';
    this.dlgT += dt;
    while (this.dlgT > 0.022 && this.dlgChar < line.length) { this.dlgT -= 0.022; this.dlgChar++; if (this.dlgChar % 3 === 0 && line[this.dlgChar] !== ' ') this.blip(this.dlgPitch * (0.9 + (line.charCodeAt(this.dlgChar - 1) % 7) * 0.03)); }
    (this.dlg.querySelector('.txt') as HTMLElement).textContent = line.slice(0, this.dlgChar);
    if (advance) {
      if (this.dlgChar < line.length) this.dlgChar = line.length;
      else if (this.dlgI < this.dlgLines.length - 1) { this.dlgI++; this.dlgChar = 0; }
      else { this.dlg.style.display = 'none'; const d = this.dlgDone; this.dlgDone = null; d?.(); }
      return true;
    }
    return false;
  }
  closeDialog() { this.dlg.style.display = 'none'; this.dlgDone = null; }

  jobPanel(job: JobDef | null, remaining: number, objective: string) {
    if (!job) { this.jobp.style.display = 'none'; return; }
    this.jobp.style.display = 'block';
    (this.jobp.querySelector('.ti') as HTMLElement).textContent = job.title.toUpperCase();
    const tm = this.jobp.querySelector('.tm') as HTMLElement;
    tm.textContent = `${Math.floor(Math.max(0, remaining) / 60)}:${String(Math.floor(Math.max(0, remaining) % 60)).padStart(2, '0')}`;
    tm.style.color = remaining < 10 ? '#ff3050' : '';
    (this.jobp.querySelector('.ob') as HTMLElement).textContent = objective;
  }

  showCard(html: string | null) { if (!html) { this.card.style.display = 'none'; return; } this.card.innerHTML = html; this.card.style.display = 'block'; }
  get cardOpen() { return this.card.style.display === 'block'; }

  ratingCard(job: JobDef, r: Rating, line: string) {
    const st = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
    this.showCard(`<h2>${job.type === 'trial' ? 'FINISHED' : job.type === 'dark' ? 'CLEAN RUN' : job.type === 'chase' ? 'SHAKEN + DELIVERED' : 'DELIVERED'}</h2><p>${job.title}</p><div class="big">${st(r.stars)}</div>
      <div class="row"><span>Time ${r.time.toFixed(1)} s</span><span class="st">${st(r.timeStars)}</span></div>
      <div class="row"><span>Style ${Math.round(r.style)}</span><span class="st">${st(r.styleStars)}</span></div>
      <div class="row"><span>Heat ${r.heat.toFixed(1)}</span><span class="st">${st(r.heatStars)}</span></div>
      <div class="row"><span>Paid</span><span class="st">¤ ${r.reward}</span></div><p>“${line}”</p><p>${glyph('interact')} continue</p>`);
  }
}
