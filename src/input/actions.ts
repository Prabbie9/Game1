// Input layer. Game code reads ACTIONS only (never keys). Devices write into ActionState.
// See INPUT.md for how to add a gamepad device.

export type AxisAction = 'throttle' | 'steer';
export type ButtonAction =
  | 'boost' | 'drift' | 'hopLeft' | 'hopRight' | 'map' | 'pause' | 'photo' | 'lights' | 'tuning' | 'interact'
  | 'menuUp' | 'menuDown' | 'menuLeft' | 'menuRight' | 'menuConfirm' | 'menuBack';

export interface ActionState {
  axes: Record<AxisAction, number>;          // -1..1
  down: Record<ButtonAction, boolean>;       // held
  pressed: Record<ButtonAction, boolean>;    // went down this frame
}

/** One interface for camera look input (mouse now, right stick later). Radians this frame. */
export interface LookSource { consume(): { dx: number; dy: number } }

export interface InputDevice { name: string; poll(state: ActionState): void; endFrame?(): void }

const BUTTONS: ButtonAction[] = ['boost', 'drift', 'hopLeft', 'hopRight', 'map', 'pause', 'photo', 'lights', 'tuning', 'interact',
  'menuUp', 'menuDown', 'menuLeft', 'menuRight', 'menuConfirm', 'menuBack'];

export function createActionState(): ActionState {
  const down = {} as Record<ButtonAction, boolean>, pressed = {} as Record<ButtonAction, boolean>;
  for (const b of BUTTONS) { down[b] = false; pressed[b] = false; }
  return { axes: { throttle: 0, steer: 0 }, down, pressed };
}

/** Keyboard bindings: action → key codes (KeyboardEvent.code). Axes use [negative, positive]. */
export const KEY_BINDINGS = {
  axes: {
    throttle: { neg: ['KeyS', 'ArrowDown'], pos: ['KeyW', 'ArrowUp'] },
    steer: { neg: ['KeyA', 'ArrowLeft'], pos: ['KeyD', 'ArrowRight'] },
  } as Record<AxisAction, { neg: string[]; pos: string[] }>,
  buttons: {
    boost: ['ShiftLeft', 'ShiftRight'], drift: ['Space'], hopLeft: ['KeyQ'], hopRight: ['KeyE'],
    map: ['Tab'], pause: ['Escape'], photo: ['KeyP'], lights: ['KeyL'], tuning: ['F2', 'Backquote'], interact: ['KeyF', 'Enter'],
    menuUp: ['ArrowUp', 'KeyW'], menuDown: ['ArrowDown', 'KeyS'], menuLeft: ['ArrowLeft', 'KeyA'], menuRight: ['ArrowRight', 'KeyD'],
    menuConfirm: ['Enter', 'Space'], menuBack: ['Escape', 'Backspace'],
  } as Record<ButtonAction, string[]>,
};

/** Prompt glyphs per device. HUD/menus ask `glyph('boost')` and never hard-code keys. */
export const GLYPHS: Record<string, Partial<Record<ButtonAction | AxisAction, string>>> = {
  keyboard: { throttle: 'W/S', steer: 'A/D', boost: 'SHIFT', drift: 'SPACE', hopLeft: 'Q', hopRight: 'E', map: 'TAB', pause: 'ESC', photo: 'P', lights: 'L', tuning: 'F2', interact: 'F',
    menuConfirm: 'ENTER', menuBack: 'ESC' },
  gamepad: { throttle: 'RT/LT', steer: 'LS', boost: 'A', drift: 'RB', hopLeft: 'LB', hopRight: 'X', map: 'VIEW', pause: 'MENU', photo: 'R3', lights: 'Y', tuning: 'L3', interact: 'B',
    menuConfirm: 'A', menuBack: 'B' },
};
let activeDevice = 'keyboard';
export function setActiveGlyphs(device: string) { if (GLYPHS[device]) activeDevice = device; }
export function glyph(a: ButtonAction | AxisAction) { return GLYPHS[activeDevice][a] ?? GLYPHS.keyboard[a] ?? a; }

export class KeyboardMouse implements InputDevice, LookSource {
  name = 'keyboard';
  private keys = new Set<string>();
  private lookDx = 0; private lookDy = 0;
  sensitivity = 0.0025;
  constructor(private el: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      this.keys.add(e.code);
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'F2'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    el.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === el || (e.buttons & 1)) { this.lookDx += e.movementX * this.sensitivity; this.lookDy += e.movementY * this.sensitivity; }
    });
  }
  poll(st: ActionState) {
    for (const a of Object.keys(KEY_BINDINGS.axes) as AxisAction[]) {
      const b = KEY_BINDINGS.axes[a];
      const v = (b.pos.some((k) => this.keys.has(k)) ? 1 : 0) - (b.neg.some((k) => this.keys.has(k)) ? 1 : 0);
      if (Math.abs(v) > Math.abs(st.axes[a])) st.axes[a] = v;
    }
    for (const a of Object.keys(KEY_BINDINGS.buttons) as ButtonAction[]) {
      if (KEY_BINDINGS.buttons[a].some((k) => this.keys.has(k))) st.down[a] = true;
    }
  }
  consume() { const r = { dx: this.lookDx, dy: this.lookDy }; this.lookDx = 0; this.lookDy = 0; return r; }
}

/** Polls all devices once per frame; computes edge-triggered `pressed`. Bots can override via `override`. */
export class InputSystem {
  state = createActionState();
  private prev = createActionState().down;
  devices: InputDevice[] = [];
  look: LookSource[] = [];
  override: ((s: ActionState) => void) | null = null;
  update() {
    const st = this.state;
    st.axes.throttle = 0; st.axes.steer = 0;
    for (const k in st.down) st.down[k as ButtonAction] = false;
    for (const d of this.devices) d.poll(st);
    if (this.override) this.override(st);
    for (const k in st.down) { const a = k as ButtonAction; st.pressed[a] = st.down[a] && !this.prev[a]; this.prev[a] = st.down[a]; }
  }
  consumeLook() { let dx = 0, dy = 0; for (const l of this.look) { const r = l.consume(); dx += r.dx; dy += r.dy; } return { dx, dy }; }
}
