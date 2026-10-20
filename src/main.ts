// Night Courier — boot + game loop. Wires renderer, world, physics worker, vehicle, camera, fx, audio, UI.
import * as THREE from 'three/webgpu';
import { createRenderer, Atmosphere, TIERS } from './renderer/renderer';
import { Post, POST } from './renderer/post';
import { U } from './materials/materials';
import { buildTestArea } from './world/testarea';
import { buildSlice, type SliceWorld } from './world/slice';
import { buildProps, buildCables, buildSteam, buildHolos } from './world/kit';
import { buildWorld, makeMaterials, LightPool } from './world/build';
import { PhysicsClient } from './physics/client';
import { InputSystem, KeyboardMouse } from './input/actions';
import { BALANCED, PRESETS, cloneTuning, type Tuning } from './vehicle/tuning';
import { createState, type VehicleInput, type VehicleState } from './vehicle/sim';
import { BikeModel } from './vehicle/bikeModel';
import { createChase, updateChase } from './camera/chase';
import { Rain } from './fx/rain';
import { GameAudio } from './audio/audio';
import { UI, loadSettings, loadingScreen, type Settings } from './ui/ui';
import { Bot } from './bot/bot';
import { SHOTS, setupShot, saveReferenceShots } from './debug/shots';
import type { WorldDef } from './world/defs';

const params = new URLSearchParams(location.search);
const CREDITS_HTML = `Design, code, procedural art, synth audio and music: generated for this project.<br><br>
three.js (MIT) — mrdoob &amp; contributors<br>Rapier physics (Apache-2.0) — Dimforge<br>Vite, TypeScript (MIT / Apache-2.0)<br><br>
No third-party textures, models or recordings are used in this build. See CREDITS.md.`;

export interface Game {
  renderer: THREE.WebGPURenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; post: Post; world: WorldDef;
  physics: PhysicsClient; tuning: Tuning; settings: Settings; state: () => VehicleState; bot: Bot | null; setBot: (b: Bot | null) => void;
  setTime: (h: number) => void; setRain: (r: number) => void; freezeCam: (pos: number[], look: number[], fov?: number) => void; releaseCam: () => void;
  stats: () => any; backend: string; frameCount: () => number; renderFrame: () => void; hud: (v: boolean) => void;
}

async function boot() {
  const load = loadingScreen();
  const settings = loadSettings();
  const tierParam = params.get('quality') as Settings['tier'] | null;
  if (tierParam && TIERS[tierParam]) settings.tier = tierParam;
  const q = { ...TIERS[settings.tier], post: { ...TIERS[settings.tier].post } };
  // ?post=ssr,ao,... overrides the tier's post stages (debug / capture)
  if (params.has('post')) { const on = params.get('post')!.split(','); for (const k of Object.keys(q.post)) (q.post as any)[k] = on.includes(k); }
  const forceWebGL = params.get('backend') === 'webgl' || !(navigator as any).gpu;
  const { renderer, backend } = await createRenderer(document.body, forceWebGL);
  const W = params.get('w') ? +params.get('w')! : innerWidth, H = params.get('h') ? +params.get('h')! : innerHeight;
  renderer.setSize(W, H, !params.get('w'));
  renderer.setPixelRatio(q.renderScale * Math.min(1.5, devicePixelRatio || 1));
  renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(68, W / H, 0.1, 900);
  const worldName = params.get('world') ?? 'slice';
  const world: WorldDef = worldName === 'test' ? buildTestArea() : buildSlice();
  (window as any).__NC_WORLD = worldName;
  const atmo = new Atmosphere(scene, renderer, q.shadows);
  scene.add(buildWorld(world, makeMaterials()));
  const dressing = (world as SliceWorld).dressing;
  if (dressing) {
    scene.add(buildProps(dressing.props)); scene.add(buildCables(dressing.cables));
    scene.add(buildSteam(dressing.steam)); scene.add(buildHolos(dressing.holos));
  }
  const pool = new LightPool(scene, q.lightPool, world.lights, world.neons);
  const rain = new Rain(scene, q.rain);
  const bike = new BikeModel(scene, q.tier === 'high');
  const post = new Post(renderer, scene, camera, q.post);

  const tuning: Tuning = cloneTuning(PRESETS[settings.preset] ?? BALANCED);
  const physics = new PhysicsClient();
  physics.onError = (m) => console.error(m);
  await physics.init({ world: world.boxes }, world.spawn.pos, world.spawn.yaw, tuning);

  const input = new InputSystem();
  const km = new KeyboardMouse(renderer.domElement);
  input.devices.push(km); input.look.push(km);
  renderer.domElement.addEventListener('click', () => { if (!ui.menuOpen) renderer.domElement.requestPointerLock?.()?.catch?.(() => {}); });

  const audio = new GameAudio();
  let paused = false;
  const ui = new UI(settings, tuning, {
    onSettings: (s) => applySettings(s), onTuning: (t) => physics.setTuning(t), credits: CREDITS_HTML,
    onResume: () => { paused = false; physics.freeze(false); },
    onShots: () => saveReferenceShots(game),
  });
  const applySettings = (s: Settings) => {
    U.flicker.value = s.reduceFlicker ? 0 : 1;
    audio.musicOn = s.music; audio.volume = s.volume; if (audio.master) audio.master.gain.value = s.volume;
    if (s.tier !== q.tier) ui.toast('QUALITY APPLIES ON RELOAD', 2.5);
  };
  applySettings(settings);

  // ---- state ----
  let simState: VehicleState = physics.cur ?? createState(0, 1, 0, 0);
  const cam = createChase(simState);
  let bot: Bot | null = null;
  const botName = params.get('bot');
  if (botName && world.routes[botName]) bot = new Bot({ pts: world.routes[botName].pts, hops: worldName === 'test' ? [[17, -90]] : [] });
  let frozenCam: { pos: THREE.Vector3; look: THREE.Vector3; fov: number } | null = null;
  let shake = 0, timeOfDay = 23.5, rainAmt = 1, t = 0, frames = 0;
  const camVel = new THREE.Vector3(), lastCam = new THREE.Vector3();
  const ft: number[] = [];

  const setTime = (h: number) => {
    timeOfDay = h;
    const night = h >= 21 || h < 5 ? 1 : h >= 19 ? (h - 19) / 2 : 0.0;
    U.night.value = night;
    atmo.fogColor.value.setRGB(0.018 + (1 - night) * 0.09, 0.022 + (1 - night) * 0.05, 0.05 + (1 - night) * 0.12);
    atmo.hazeColor.value.setRGB(0.16 + (1 - night) * 0.5, 0.045 + (1 - night) * 0.18, 0.16 + (1 - night) * 0.15);
    atmo.moon.intensity = 0.25 + (1 - night) * 0.9;
    atmo.hemi.intensity = 0.1 + (1 - night) * 0.5;
    scene.environmentIntensity = 0.3 + (1 - night) * 0.4;
  };
  const setRain = (r: number) => { rainAmt = r; U.rain.value = r; U.wet.value = Math.min(1, 0.35 + r); };
  setTime(+(params.get('time') ?? 23.5)); setRain(+(params.get('rain') ?? 1));

  const game: Game = {
    renderer, scene, camera, post, world, physics, tuning, settings, backend, state: () => simState, bot,
    setBot: (b) => { bot = b; }, setTime, setRain,
    freezeCam: (pos, look, fov = 50) => { frozenCam = { pos: new THREE.Vector3(...pos), look: new THREE.Vector3(...look), fov }; },
    releaseCam: () => { frozenCam = null; },
    stats: () => {
      const s = [...ft].sort((a, b) => a - b);
      const info = renderer.info as any;
      return { backend, frames, drawCalls: info.render?.drawCalls ?? info.render?.calls, triangles: info.render?.triangles, geometries: info.memory?.geometries, textures: info.memory?.textures,
        frameMsP50: s[Math.floor(s.length * 0.5)] ?? 0, frameMsP99: s[Math.floor(s.length * 0.99)] ?? 0, heapMB: (performance as any).memory ? Math.round((performance as any).memory.usedJSHeapSize / 1048576) : null,
        speed: simState.speed, pos: [simState.x, simState.y, simState.z] };
    },
    frameCount: () => frames, renderFrame: () => post.render(), hud: (v) => ui.setHudVisible(v),
  };
  (window as any).NRC_DEBUG = {
    game,
    teleport: (x: number, y: number, z: number, yaw = 0, speed = 0) => physics.teleport(x, y, z, yaw, speed),
    setTime, setRain,
    startJob: () => 'jobs arrive in M4',
    setHeat: () => 'heat arrives in M4',
    stats: () => game.stats(),
    tuning: () => JSON.stringify(tuning),
  };

  // ---- loop ----
  let last = performance.now();
  const frame = () => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    ft.push(dt * 1000); if (ft.length > 600) ft.shift();
    t += dt; frames++;
    input.update();
    const a = input.state;
    if (a.pressed.pause && !ui.tuningOpen) { if (ui.menuOpen) ui.closeMenu(); else { ui.openPause(); paused = true; physics.freeze(true); document.exitPointerLock?.(); } }
    else if (a.pressed.pause && ui.tuningOpen) ui.toggleTuning(false);
    if (a.pressed.tuning) ui.toggleTuning();
    if (a.pressed.lights) { bike.lightsOn = !bike.lightsOn; ui.toast(bike.lightsOn ? 'LIGHTS ON' : 'LIGHTS OFF'); }
    ui.handle(a);

    let vin: VehicleInput = paused ? { throttle: 0, steer: 0, boost: false, drift: false, hopLeft: false, hopRight: false }
      : { throttle: a.axes.throttle, steer: a.axes.steer, boost: a.down.boost, drift: a.down.drift, hopLeft: a.pressed.hopLeft, hopRight: a.pressed.hopRight };
    if (bot && !paused) vin = bot.drive(simState, tuning);
    physics.frame(dt, vin, { pivot: cam.pivot, dir: cam.dir, len: cam.want, bike: [simState.x, simState.y, simState.z] });
    if (physics.cur) simState = physics.cur;
    const pose = physics.pose();
    const ev = physics.takeEvents();
    if (ev.boostStarted) { audio.boost(); shake = Math.max(shake, 0.25); }
    if (ev.impact > 2) { audio.impact(ev.impact); shake = Math.max(shake, Math.min(1, ev.impact / 12)); }
    if (ev.hopped) audio.hop();
    if (ev.landed > 3) audio.land(ev.landed);
    if (ev.driftReleased > 0) { audio.driftKick(); ui.toast('DRIFT BOOST', 0.8); }

    bike.update(pose, simState, dt);
    const look = input.consumeLook();
    const renderState = { ...simState, x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw };
    updateChase(cam, renderState, { ...tuning, fovBase: tuning.fovBase + settings.fovOffset }, dt, look, () => physics.camFree);
    if (frozenCam) {
      camera.position.copy(frozenCam.pos); camera.lookAt(frozenCam.look); camera.fov = frozenCam.fov;
    } else {
      camera.position.set(cam.x, cam.y, cam.z);
      if (settings.shake && shake > 0.001) {
        const k = shake * shake * 0.18;
        camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k; camera.position.z += (Math.random() - 0.5) * k;
      }
      // high-speed micro shake (comfort toggle)
      if (settings.shake && simState.speed > 26) camera.position.y += Math.sin(t * 47) * 0.008 * (simState.speed - 26);
      camera.up.set(Math.sin(cam.roll), Math.cos(cam.roll), 0);
      camera.lookAt(cam.tx, cam.ty, cam.tz);
      camera.fov = cam.fov;
    }
    shake *= Math.exp(-5 * dt);
    camera.updateProjectionMatrix();
    camVel.copy(camera.position).sub(lastCam).divideScalar(Math.max(dt, 1e-3)); lastCam.copy(camera.position);
    if (camVel.length() > 80) camVel.set(0, 0, 0); // teleports

    rain.update(camera.position, camVel, simState.grounded ? simState.y - simState.groundDist : 0, rainAmt);
    pool.update(camera.position);
    atmo.follow(new THREE.Vector3(simState.x, simState.y, simState.z));
    // covered = under the tunnel roof or the deck (cheap analytic test for audio)
    const covered = worldName === 'test'
      ? (Math.abs(simState.z - 90) < 10 && Math.abs(simState.x) < 80 && simState.y < 6) || (Math.abs(simState.z + 90) < 7 && Math.abs(simState.x) < 100 && simState.y < 8)
      : Math.abs(simState.x - 35) < 6 && simState.z < 62 && simState.z > -96 && simState.y < 8;
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
    audio.update({ speed: simState.speed, boosting: simState.boosting, drifting: simState.drifting, slip: simState.slip, grounded: simState.grounded,
      onWater: simState.surface === 'water', rain: rainAmt, covered, cam: { x: camera.position.x, y: camera.position.y, z: camera.position.z, fx: fwd.x, fz: fwd.z },
      buzzAt: pool.lights[0] ? { x: pool.lights[0].position.x, y: pool.lights[0].position.y, z: pool.lights[0].position.z } : null });
    ui.hud(simState.speed, simState.boost, simState.boosting, simState.drifting ? simState.driftCharge : 0, dt, t);
    // speed-adaptive post: blur, DoF and CA ramp with speed so the frame stays readable when slow
    const sp01 = Math.min(1, Math.max(0, (simState.speed - 12) / 23));
    POST.bloomStrength.value = 0.5 + (simState.boosting ? 0.08 : 0);
    // velocity buffer is per-frame: normalise to a 60 fps reference so low frame rates don't over-blur
    POST.blurAmount.value = settings.motionBlur && !frozenCam ? (0.05 + sp01 * 0.2) * Math.min(1, (1 / 60) / Math.max(dt, 1e-3)) : 0;
    POST.focusDist.value = frozenCam ? frozenCam.pos.distanceTo(frozenCam.look) : cam.armLen + 1;
    POST.focalLen.value = frozenCam ? 40 : 120;
    POST.bokeh.value = frozenCam ? 1.0 : sp01 * 0.35; // gameplay: only a hint of far blur at speed
    POST.ca.value = (settings.reduceFlicker ? 0.3 : 1) * (0.05 + sp01 * 0.12 + (simState.boosting ? 0.08 : 0));
    POST.lensWet.value = rainAmt * (covered ? 0 : 1) * Math.max(0, 1 - simState.speed / 30);
    post.render();
    if (!(window as any).__NC_MANUAL) requestAnimationFrame(frame);
  };

  const shot = params.get('shot');
  const auto = !!shot || params.has('nosplash') || !!botName;
  load.ready(() => { audio.start(); applySettings(settings); }, auto);
  requestAnimationFrame(frame);
  (window as any).__NC_READY = true;
  if (shot && SHOTS[shot]) await setupShot(game, shot);
}

boot().catch((e) => { console.error('boot failed', e); const el = document.querySelector('.loading .s'); if (el) el.textContent = 'FAILED TO START: ' + (e?.message ?? e); });
