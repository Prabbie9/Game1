// Hoshi Noodle Bar interior: a small warm room (hidden below the city; the door teleports you in and out).
// Counter, stools, shelves, lanterns, steaming bowls, a rain-streaked window and Mama Kiso behind the counter.
import type { BoxDef } from './defs';
import type { StacksWorld } from './stacks';

export const BAR = { x: 0, y: -60, z: 0, door: [0, -59.1, 3.0] as [number, number, number], kiso: [0, -59.1, -2.6] as [number, number, number] };

export function addNoodleBar(W: StacksWorld) {
  const { x, y, z } = BAR;
  const b = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mat: BoxDef['mat'], extra: Partial<BoxDef> = {}): BoxDef =>
    ({ c: [x + (x0 + x1) / 2, y + (y0 + y1) / 2, z + (z0 + z1) / 2], h: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], mat, ...extra });
  W.boxes.push(
    b(-6.5, -0.4, -4.5, 6.5, 0, 4.5, 'deck', { surface: 'concrete', collide: 'ground' }),   // floor
    b(-6.5, 3.4, -4.5, 6.5, 3.8, 4.5, 'greyDark'),                                           // ceiling
    b(-6.9, 0, -4.5, -6.5, 3.4, 4.5, 'tunnel'), b(6.5, 0, -4.5, 6.9, 3.4, 4.5, 'tunnel'),
    b(-6.5, 0, -4.9, 6.5, 3.4, -4.5, 'tunnel'), b(-6.5, 0, 4.5, 6.5, 3.4, 4.9, 'tunnel'),
    b(-4.5, 0, -1.8, 4.5, 1.05, -1.2, 'metal', { surface: 'metal' }),                         // counter
    b(-4.6, 1.05, -1.9, 4.6, 1.12, -1.1, 'concrete', { surface: 'concrete' }),
    b(-5.5, 1.6, -4.4, 5.5, 1.7, -4.0, 'metal', { collide: 'none' }), b(-5.5, 2.4, -4.4, 5.5, 2.5, -4.0, 'metal', { collide: 'none' }), // shelves
  );
  for (let i = -3; i <= 3; i += 1.5) W.boxes.push(b(i - 0.22, 0, -0.75, i + 0.22, 0.75, -0.3, 'metal', { collide: 'none' }));
  for (const lx of [-4, -1.3, 1.3, 4]) { W.dressing.props.push({ kind: 'lantern', pos: [x + lx, y + 2.9, z - 0.6], yaw: 0, size: [0.26, 0, 0] }); }
  W.lights.push({ pos: [x - 2.5, y + 2.6, z - 0.5], color: '#ffa04a', intensity: 22, range: 9 }, { pos: [x + 2.5, y + 2.6, z - 0.5], color: '#ff8a3a', intensity: 22, range: 9 }, { pos: [x, y + 2.2, z + 3.2], color: '#ffb36b', intensity: 10, range: 6 });
  W.dressing.props.push({ kind: 'warmwin', pos: [x, y + 1.7, z + 4.45], yaw: Math.PI, size: [7, 2.2, 0] }); // the window, from inside
  for (const sx of [-2.2, 0.6, 2.8]) W.dressing.steam.push({ pos: [x + sx, y + 1.15, z - 1.5], radius: 0.15, height: 1.5, tint: '#ffcfa0' });
  W.neons.push({ pos: [x, y + 2.9, z - 4.4], size: [3.2, 0.8], yaw: 0, color: '#ffb05a', text: 'HOSHI', light: 0 });
}
