// Menu focus system: menus register focusable elements; menu actions move focus and activate.
// Works with keyboard now and gamepad later (both drive the same menu actions).
import type { ActionState } from './actions';

export class FocusGroup {
  idx = 0;
  constructor(public items: HTMLElement[]) { this.apply(); }
  set(items: HTMLElement[]) { this.items = items; this.idx = Math.min(this.idx, items.length - 1); this.apply(); }
  apply() { this.items.forEach((el, i) => el.classList.toggle('focus', i === this.idx)); this.items[this.idx]?.scrollIntoView?.({ block: 'nearest' }); }
  handle(a: ActionState) {
    if (!this.items.length) return;
    if (a.pressed.menuDown) { this.idx = (this.idx + 1) % this.items.length; this.apply(); }
    if (a.pressed.menuUp) { this.idx = (this.idx - 1 + this.items.length) % this.items.length; this.apply(); }
    const el = this.items[this.idx];
    const slider = el.querySelector('input[type=range]') as HTMLInputElement | null;
    if (slider && (a.pressed.menuLeft || a.pressed.menuRight)) {
      const step = parseFloat(slider.step || '1') * (a.pressed.menuRight ? 1 : -1);
      slider.value = String(parseFloat(slider.value) + step); slider.dispatchEvent(new Event('input'));
    }
    if (a.pressed.menuConfirm) (el.querySelector('button,input[type=checkbox]') as HTMLElement | null ?? el).click();
  }
}
