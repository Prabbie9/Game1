# INPUT

Game code never reads keys. It reads **actions** from `InputSystem.state` (`src/input/actions.ts`).

## Actions
| Action | Kind | Keyboard / mouse | Used by |
|---|---|---|---|
| `throttle` | axis −1..1 | W (+1) / S (−1), arrows | vehicle (−1 = brake, then reverse) |
| `steer` | axis −1..1 | D (+1) / A (−1), arrows | vehicle |
| `boost` | button (held) | Shift | vehicle |
| `drift` | button (held) | Space | vehicle (handbrake / drift) |
| `hopLeft` / `hopRight` | button (pressed) | Q / E | vehicle (both at once = straight hop) |
| `lights` | pressed | L | bike lights (stealth) |
| `map` | pressed | Tab | full map |
| `pause` | pressed | Esc | pause menu |
| `photo` | pressed | P | photo mode |
| `tuning` | pressed | F2 or ` | live tuning panel |
| `interact` | pressed | F / Enter | talk to fixers, enter doors |
| `menuUp/Down/Left/Right/Confirm/Back` | pressed | arrows/WASD, Enter/Space, Esc/Backspace | menus via `FocusGroup` |
| look | `LookSource` (radians/frame) | mouse (pointer lock, or drag) | chase camera free-look |

Axes are analog: keyboard writes full ±1, a stick writes any value. When several devices write the same axis, the largest magnitude wins. Buttons are OR-ed. `pressed` is computed once per frame from `down` (edge trigger), so devices only report what is held.

## Extension points
- **New device:** implement `InputDevice { name; poll(state) }` and push it into `input.devices` in `main.ts`. In `poll`, write `state.axes.*` (if larger magnitude) and set `state.down.*` true for held buttons.
- **Look:** implement `LookSource { consume(): {dx, dy} }` and push it into `input.look`. Return radians since last call (scale stick deflection × dt × sensitivity).
- **Glyphs:** `GLYPHS[deviceName]` maps actions to prompt labels; call `setActiveGlyphs(deviceName)` when the device is used. HUD/menus call `glyph(action)`.
- **Menus:** every menu is a `FocusGroup` over its rows; it only uses `menu*` actions, so a gamepad works once it writes those actions.
- **Bots / replays:** `InputSystem.override` can rewrite the state each frame; the test bot instead produces `VehicleInput` directly.

## Adding controller support (short follow-up)
1. Create `src/input/gamepad.ts` with `class Gamepad implements InputDevice, LookSource` that reads `navigator.getGamepads()[0]` in `poll`:
   - `steer` = left stick X (deadzone 0.12, rescaled); `throttle` = RT − LT (buttons 7 and 6 `.value`).
   - `boost` = A (0), `drift` = RB (5), `hopLeft` = LB (4), `hopRight` = X (2), `lights` = Y (3), `pause` = Start (9), `map` = Back (8), `photo` = R3 (11), `tuning` = L3 (10), `interact` = B (1).
   - menu: D-pad 12–15 → `menuUp/Down/Left/Right`, A → `menuConfirm`, B → `menuBack`; also map left stick with a repeat delay.
   - `consume()` returns right stick (axes 2, 3) × 2.5 rad/s × dt.
2. In `main.ts`: `const gp = new Gamepad(); input.devices.push(gp); input.look.push(gp);`
3. Call `setActiveGlyphs('gamepad')` when a gamepad button is pressed and `'keyboard'` on key press.
