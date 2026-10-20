// DOM UI: HUD (speed, boost, drift charge), pause menu, settings (quality + comfort), live tuning panel,
// credits and controls. Menus are driven by menu actions through FocusGroup (keyboard now, gamepad later).
import { FocusGroup } from '../input/focus';
import { glyph, type ActionState } from '../input/actions';
import { PRESETS, RANGES, type Tuning, cloneTuning } from '../vehicle/tuning';

export interface Settings {
  tier: 'low' | 'medium' | 'high'; fovOffset: number; motionBlur: boolean; shake: boolean; reduceFlicker: boolean;
  music: boolean; volume: number; preset: string;
}
export const DEFAULT_SETTINGS: Settings = { tier: 'high', fovOffset: 0, motionBlur: true, shake: true, reduceFlicker: false, music: true, volume: 0.8, preset: 'Balanced' };

export function loadSettings(): Settings {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('nc.settings') || '{}') }; } catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(s: Settings) { try { localStorage.setItem('nc.settings', JSON.stringify(s)); } catch { /* storage unavailable */ } }

const CSS = `
#nc-ui.nohud > :not(.menu):not(.tune){display:none!important}
:root{--nc-bg:rgba(6,8,16,.82);--nc-fg:#e9f3ff;--nc-dim:#8a97b0;--nc-cyan:#19e6ff;--nc-mag:#ff2aa8;--nc-amb:#ffa142;--nc-font:"Rajdhani","Bahnschrift","Segoe UI","Roboto Condensed",system-ui,sans-serif}
#nc-ui{position:fixed;inset:0;pointer-events:none;font-family:var(--nc-font);color:var(--nc-fg);user-select:none;z-index:5}
#nc-ui .panel{pointer-events:auto;background:var(--nc-bg);border:1px solid rgba(25,230,255,.25);box-shadow:0 0 40px rgba(0,0,0,.6);backdrop-filter:blur(6px)}
.hud-speed{position:absolute;right:36px;bottom:30px;text-align:right;text-shadow:0 0 12px rgba(0,0,0,.9),0 0 2px #000}
.hud-speed .v{font-size:64px;font-weight:700;line-height:.9;letter-spacing:-1px;font-variant-numeric:tabular-nums}
.hud-speed .u{font-size:14px;letter-spacing:3px;color:var(--nc-dim)}
.hud-boost{margin-top:8px;display:flex;gap:3px;justify-content:flex-end}
.hud-boost i{display:block;width:14px;height:8px;background:rgba(255,255,255,.12);transform:skewX(-20deg)}
.hud-boost i.on{background:var(--nc-cyan);box-shadow:0 0 8px var(--nc-cyan)}
.hud-boost.active i.on{background:#fff;box-shadow:0 0 12px var(--nc-cyan)}
.hud-drift{height:3px;margin-top:5px;background:linear-gradient(90deg,var(--nc-mag),var(--nc-amb));transform-origin:right;transform:scaleX(0)}
.hud-hint{position:absolute;left:36px;bottom:30px;font-size:15px;letter-spacing:1px;color:var(--nc-dim);line-height:1.6;transition:opacity 1.5s;text-shadow:0 0 6px #000}
.hud-hint b{color:var(--nc-fg);border:1px solid rgba(255,255,255,.3);padding:0 5px;margin-right:4px;font-weight:600}
.hud-toast{position:absolute;left:50%;top:18%;transform:translateX(-50%);font-size:22px;letter-spacing:4px;color:var(--nc-amb);text-shadow:0 0 14px rgba(255,161,66,.6);opacity:0;transition:opacity .3s}
.menu{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,90vw);max-height:84vh;overflow:auto;padding:26px 28px}
.menu h1{margin:0 0 4px;font-size:30px;letter-spacing:6px;font-weight:700}.menu h1 span{color:var(--nc-mag)}
.menu .sub{color:var(--nc-dim);font-size:13px;letter-spacing:2px;margin-bottom:18px}
.menu .item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 12px;margin:2px 0;border-left:2px solid transparent;font-size:18px;letter-spacing:1px;cursor:pointer}
.menu .item.focus,.menu .item:hover{border-left-color:var(--nc-cyan);background:rgba(25,230,255,.08)}
.menu button{all:unset;cursor:pointer;width:100%}
.menu input[type=range]{width:150px;accent-color:var(--nc-cyan)}
.menu .val{color:var(--nc-cyan);min-width:56px;text-align:right;font-variant-numeric:tabular-nums}
.menu p{color:var(--nc-dim);font-size:14px;line-height:1.5}
.tune{position:absolute;right:16px;top:16px;width:330px;max-height:calc(100vh - 32px);overflow:auto;padding:14px 16px;font-size:13px}
.tune h2{margin:0 0 8px;font-size:16px;letter-spacing:3px}.tune .row{display:grid;grid-template-columns:110px 1fr 48px;gap:6px;align-items:center;margin:3px 0}
.tune input{width:100%;accent-color:var(--nc-mag)}.tune .val{text-align:right;color:var(--nc-cyan);font-variant-numeric:tabular-nums}
.tune .presets{display:flex;gap:6px;margin:8px 0}.tune button{pointer-events:auto;font:inherit;background:#111a2a;color:var(--nc-fg);border:1px solid rgba(25,230,255,.35);padding:4px 8px;cursor:pointer}
.tune button.sel{background:var(--nc-cyan);color:#000}.tune textarea{width:100%;height:80px;font:11px monospace;background:#05070d;color:#9fe;border:1px solid #234}
.loading{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;background:#04050a;color:var(--nc-fg);font-family:var(--nc-font);z-index:9;letter-spacing:6px;transition:opacity .8s}
.loading .t{font-size:42px;font-weight:700}.loading .t span{color:var(--nc-mag)}.loading .s{margin-top:12px;font-size:13px;color:var(--nc-dim);letter-spacing:3px}
.loading .go{margin-top:28px;font-size:16px;color:var(--nc-cyan);animation:pulse 1.6s infinite}@keyframes pulse{50%{opacity:.4}}
@media (prefers-reduced-motion: reduce){.loading .go{animation:none}}
`;

export type MenuItem = { label: string; kind: 'button'; on: () => void } | { label: string; kind: 'toggle'; get: () => boolean; set: (v: boolean) => void }
  | { label: string; kind: 'slider'; min: number; max: number; step: number; get: () => number; set: (v: number) => void; fmt?: (v: number) => string }
  | { label: string; kind: 'choice'; options: string[]; get: () => string; set: (v: string) => void };

export class UI {
  root: HTMLDivElement;
  private speedV: HTMLDivElement; private boostBar: HTMLDivElement; private driftBar: HTMLDivElement; private hint: HTMLDivElement; private toastEl: HTMLDivElement;
  private menuEl: HTMLDivElement | null = null; private focus: FocusGroup | null = null;
  private tuneEl: HTMLDivElement | null = null;
  menuOpen = false; tuningOpen = false;
  private toastT = 0;
  private stack: (() => void)[] = [];

  constructor(public settings: Settings, public tuning: Tuning, private hooks: {
    onSettings: (s: Settings) => void; onTuning: (t: Tuning) => void; onResume: () => void; onShots: () => void; credits: string;
    garage?: () => MenuItem[]; wallet?: () => number;
  }) {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    this.root = document.createElement('div'); this.root.id = 'nc-ui'; document.body.appendChild(this.root);
    this.root.innerHTML = `<div class="hud-speed"><div class="v">0</div><div class="u">KM/H</div><div class="hud-boost"></div><div class="hud-drift"></div></div>
      <div class="hud-hint"></div><div class="hud-toast"></div><div class="hud-cred" style="position:absolute;right:36px;bottom:150px;font-size:15px;letter-spacing:3px;color:var(--nc-amb);text-shadow:0 0 6px #000"></div>`;
    this.speedV = this.root.querySelector('.hud-speed .v')!;
    this.boostBar = this.root.querySelector('.hud-boost')!;
    for (let i = 0; i < 12; i++) this.boostBar.appendChild(document.createElement('i'));
    this.driftBar = this.root.querySelector('.hud-drift')!;
    this.hint = this.root.querySelector('.hud-hint')!;
    this.hint.innerHTML = [['throttle', 'drive'], ['steer', 'steer'], ['boost', 'boost'], ['drift', 'drift (builds boost)'], ['hopLeft', '/ ' + glyph('hopRight') + ' hop'], ['interact', 'talk to fixers (rings)'], ['lights', 'lights (stealth)'], ['map', 'map'], ['pause', 'menu']]
      .map(([a, t]) => `<div><b>${glyph(a as any)}</b>${t}</div>`).join('');
    this.toastEl = this.root.querySelector('.hud-toast')!;
  }

  setCredits(c: number) { (this.root.querySelector('.hud-cred') as HTMLElement).textContent = '¤ ' + c; }
  hud(speed: number, boost: number, boosting: boolean, drift: number, dt: number, t: number) {
    this.speedV.textContent = String(Math.round(speed * 3.6));
    const on = Math.round(boost * 12);
    this.boostBar.classList.toggle('active', boosting);
    Array.from(this.boostBar.children).forEach((el, i) => el.classList.toggle('on', i < on));
    this.driftBar.style.transform = `scaleX(${Math.min(1, drift)})`;
    if (t > 14) this.hint.style.opacity = '0';
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.toastEl.style.opacity = '0'; }
  }
  toast(msg: string, sec = 1.6) { this.toastEl.textContent = msg; this.toastEl.style.opacity = '1'; this.toastT = sec; }
  setHudVisible(v: boolean) { this.root.classList.toggle('nohud', !v); }

  handle(a: ActionState) { if (this.menuOpen && this.focus) this.focus.handle(a); if (this.menuOpen && a.pressed.menuBack && this.stack.length > 1) { this.stack.pop(); this.stack[this.stack.length - 1](); } }

  // ---- menus ---------------------------------------------------------------------
  private renderMenu(title: string, sub: string, items: MenuItem[], extraHTML = '') {
    this.menuEl?.remove();
    const el = document.createElement('div'); el.className = 'panel menu';
    el.innerHTML = `<h1>${title}</h1><div class="sub">${sub}</div>${extraHTML}`;
    const rows: HTMLElement[] = [];
    for (const it of items) {
      const row = document.createElement('div'); row.className = 'item';
      if (it.kind === 'button') { const b = document.createElement('button'); b.textContent = it.label; b.onclick = it.on; row.appendChild(b); row.onclick = (e) => { if (e.target === row) it.on(); }; }
      else if (it.kind === 'toggle') {
        row.innerHTML = `<span>${it.label}</span><span class="val">${it.get() ? 'ON' : 'OFF'}</span>`;
        row.onclick = () => { it.set(!it.get()); (row.querySelector('.val') as HTMLElement).textContent = it.get() ? 'ON' : 'OFF'; };
      } else if (it.kind === 'choice') {
        row.innerHTML = `<span>${it.label}</span><span class="val">${it.get().toUpperCase()}</span>`;
        row.onclick = () => { const i = it.options.indexOf(it.get()); it.set(it.options[(i + 1) % it.options.length]); (row.querySelector('.val') as HTMLElement).textContent = it.get().toUpperCase(); };
      } else {
        const id = 'nc-' + it.label.replace(/\W/g, '');
        row.innerHTML = `<label for="${id}">${it.label}</label><input id="${id}" type="range" min="${it.min}" max="${it.max}" step="${it.step}" value="${it.get()}"><span class="val"></span>`;
        const inp = row.querySelector('input')!, val = row.querySelector('.val')!;
        const upd = () => { val.textContent = it.fmt ? it.fmt(+inp.value) : inp.value; };
        inp.oninput = () => { it.set(+inp.value); upd(); }; upd();
      }
      el.appendChild(row); rows.push(row);
    }
    this.root.appendChild(el); this.menuEl = el;
    this.focus = new FocusGroup(rows);
  }

  openPause() {
    this.menuOpen = true; this.stack = [() => this.pauseMain()]; this.pauseMain();
  }
  private pauseMain() {
    this.renderMenu('NIGHT <span>COURIER</span>', 'PAUSED', [
      { label: 'Resume', kind: 'button', on: () => this.closeMenu() },
      { label: 'Settings', kind: 'button', on: () => { this.stack.push(() => this.settingsMenu()); this.settingsMenu(); } },
      ...(this.hooks.garage ? [{ label: 'Garage (upgrades)', kind: 'button' as const, on: () => { this.stack.push(() => this.garageMenu()); this.garageMenu(); } }] : []),
      { label: 'Vehicle tuning', kind: 'button', on: () => { this.closeMenu(); this.toggleTuning(true); } },
      { label: 'Controls', kind: 'button', on: () => { this.stack.push(() => this.controlsMenu()); this.controlsMenu(); } },
      { label: 'Save reference shots', kind: 'button', on: () => { this.closeMenu(); this.hooks.onShots(); } },
      { label: 'Credits', kind: 'button', on: () => { this.stack.push(() => this.creditsMenu()); this.creditsMenu(); } },
    ]);
  }
  private garageMenu() {
    const items = this.hooks.garage!().map((it) => it.kind === 'button' ? { ...it, on: () => { it.on(); this.garageMenu(); } } : it);
    this.renderMenu('GARAGE', `CREDITS ¤ ${this.hooks.wallet?.() ?? 0}`, [...items, { label: 'Back', kind: 'button', on: () => { this.stack.pop(); this.stack[this.stack.length - 1](); } }]);
  }
  private settingsMenu() {
    const s = this.settings, ch = () => { saveSettings(s); this.hooks.onSettings(s); };
    this.renderMenu('SETTINGS', 'QUALITY + COMFORT', [
      { label: 'Quality', kind: 'choice', options: ['low', 'medium', 'high'], get: () => s.tier, set: (v) => { s.tier = v as Settings['tier']; ch(); } },
      { label: 'Field of view', kind: 'slider', min: -15, max: 20, step: 1, get: () => s.fovOffset, set: (v) => { s.fovOffset = v; ch(); }, fmt: (v) => (v > 0 ? '+' : '') + v + '°' },
      { label: 'Motion blur', kind: 'toggle', get: () => s.motionBlur, set: (v) => { s.motionBlur = v; ch(); } },
      { label: 'Camera shake', kind: 'toggle', get: () => s.shake, set: (v) => { s.shake = v; ch(); } },
      { label: 'Reduce flicker + flashing', kind: 'toggle', get: () => s.reduceFlicker, set: (v) => { s.reduceFlicker = v; ch(); } },
      { label: 'Music', kind: 'toggle', get: () => s.music, set: (v) => { s.music = v; ch(); } },
      { label: 'Volume', kind: 'slider', min: 0, max: 1, step: 0.05, get: () => s.volume, set: (v) => { s.volume = v; ch(); }, fmt: (v) => Math.round(v * 100) + '%' },
      { label: 'Back', kind: 'button', on: () => { this.stack.pop(); this.stack[this.stack.length - 1](); } },
    ]);
  }
  private controlsMenu() {
    const rows = [['throttle', 'Throttle / brake'], ['steer', 'Steer'], ['boost', 'Boost'], ['drift', 'Handbrake / drift'], ['hopLeft', 'Hop left'], ['hopRight', 'Hop right'],
      ['lights', 'Bike lights'], ['map', 'Map'], ['photo', 'Photo mode'], ['tuning', 'Tuning panel'], ['pause', 'Pause']];
    this.renderMenu('CONTROLS', 'KEYBOARD + MOUSE', [{ label: 'Back', kind: 'button', on: () => { this.stack.pop(); this.stack[this.stack.length - 1](); } }],
      `<p>${rows.map(([a, t]) => `<b style="color:var(--nc-cyan);display:inline-block;min-width:90px">${glyph(a as any)}</b>${t}`).join('<br>')}<br><b style="color:var(--nc-cyan);display:inline-block;min-width:90px">MOUSE</b>Free-look (click to capture)</p>`);
  }
  private creditsMenu() {
    this.renderMenu('CREDITS', 'NIGHT COURIER', [{ label: 'Back', kind: 'button', on: () => { this.stack.pop(); this.stack[this.stack.length - 1](); } }], `<p>${this.hooks.credits}</p>`);
  }
  closeMenu() { this.menuEl?.remove(); this.menuEl = null; this.menuOpen = false; this.focus = null; this.hooks.onResume(); }

  // ---- tuning panel ----------------------------------------------------------------
  toggleTuning(force?: boolean) {
    this.tuningOpen = force ?? !this.tuningOpen;
    this.tuneEl?.remove(); this.tuneEl = null;
    if (!this.tuningOpen) return;
    const el = document.createElement('div'); el.className = 'panel tune';
    el.innerHTML = `<h2>TUNING <span style="color:var(--nc-dim);font-size:11px">${glyph('tuning')} to close</span></h2><div class="presets"></div><div class="rows"></div>
      <div class="presets"><button class="copy">Copy my settings</button><button class="close">Close</button></div><textarea readonly hidden></textarea>`;
    const pr = el.querySelector('.presets')!;
    for (const name of Object.keys(PRESETS)) {
      const b = document.createElement('button'); b.textContent = name; if (name === this.settings.preset) b.classList.add('sel');
      b.onclick = () => { Object.assign(this.tuning, cloneTuning(PRESETS[name])); this.settings.preset = name; saveSettings(this.settings); this.hooks.onTuning(this.tuning); this.toggleTuning(true); };
      pr.appendChild(b);
    }
    const rows = el.querySelector('.rows')!;
    for (const k of Object.keys(RANGES) as (keyof Tuning)[]) {
      const [mn, mx, st] = RANGES[k];
      const r = document.createElement('div'); r.className = 'row';
      r.innerHTML = `<label for="t-${k}">${k}</label><input id="t-${k}" type="range" min="${mn}" max="${mx}" step="${st}" value="${this.tuning[k]}"><span class="val">${this.tuning[k]}</span>`;
      const inp = r.querySelector('input')!;
      inp.oninput = () => { this.tuning[k] = +inp.value; r.querySelector('.val')!.textContent = inp.value; this.settings.preset = 'Custom'; this.hooks.onTuning(this.tuning); };
      rows.appendChild(r);
    }
    const ta = el.querySelector('textarea')!;
    (el.querySelector('.copy') as HTMLButtonElement).onclick = () => {
      const txt = JSON.stringify({ basePreset: this.settings.preset, tuning: this.tuning }, null, 1);
      ta.hidden = false; ta.value = txt; ta.select();
      navigator.clipboard?.writeText(txt).then(() => this.toast('SETTINGS COPIED'), () => this.toast('SELECT + COPY THE TEXT'));
    };
    (el.querySelector('.close') as HTMLButtonElement).onclick = () => this.toggleTuning(false);
    this.root.appendChild(el); this.tuneEl = el;
  }
}

export function loadingScreen() {
  const el = document.createElement('div'); el.className = 'loading';
  el.innerHTML = `<div class="t">NIGHT <span>COURIER</span></div><div class="s">LOADING THE DISTRICT</div>`;
  document.body.appendChild(el);
  return {
    ready(onGo: () => void, auto: boolean) {
      (el.querySelector('.s') as HTMLElement).textContent = 'RAIN-SOAKED. NEON-LIT. ON TIME.';
      const go = document.createElement('div'); go.className = 'go'; go.textContent = 'CLICK OR PRESS ANY KEY TO RIDE'; el.appendChild(go);
      const start = () => { window.removeEventListener('keydown', start); el.removeEventListener('click', start); el.style.opacity = '0'; setTimeout(() => el.remove(), 900); onGo(); };
      if (auto) { el.remove(); onGo(); return; }
      window.addEventListener('keydown', start); el.addEventListener('click', start);
    },
    error(msg: string) { (el.querySelector('.s') as HTMLElement).textContent = msg; },
  };
}
