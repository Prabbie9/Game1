// Night Courier — boot + game loop. Wires renderer, world, physics worker, vehicle, camera, fx, audio, UI.
import * as THREE from 'three/webgpu';
import { createRenderer, Atmosphere, TIERS } from './renderer/renderer';
import { Post, POST } from './renderer/post';
import { U } from './materials/materials';
import { buildTestArea } from './world/testarea';
import { buildSlice, type SliceWorld } from './world/slice';
import { buildHolos } from './world/kit';
import { makeMaterials, LightPool } from './world/build';
import { buildStacks, type StacksWorld } from './world/stacks';
import { ChunkStreamer } from './streaming/chunks';
import { Crowds } from './crowds/crowds';
import { Traffic, Tram } from './world/traffic';
import { PhysicsClient } from './physics/client';
import { InputSystem, KeyboardMouse, glyph } from './input/actions';
import { BALANCED, PRESETS, cloneTuning, type Tuning } from './vehicle/tuning';
import { createState, type VehicleInput, type VehicleState } from './vehicle/sim';
import { BikeModel } from './vehicle/bikeModel';
import { createChase, updateChase } from './camera/chase';
import { Rain } from './fx/rain';
import { GameAudio } from './audio/audio';
import { UI, loadSettings, saveSettings, loadingScreen, type Settings } from './ui/ui';
import { Bot } from './bot/bot';
import { Occlusion } from './heat/occlusion';
import { buildCraft } from './heat/craft';
import { propWarmGroup } from './world/kit';
import { loadOverrides } from './assets/overrides';
import { HeatSystem, Pursuer } from './heat/heat';
import { NavUI } from './ui/nav';
import { Career } from './jobs/career';
import { JOBS } from './jobs/jobs';
import { SHOTS, setupShot, saveReferenceShots, captureCanvas, saveBlob } from './debug/shots';
import { PhotoMode } from './ui/photo';
import { Person } from './vehicle/person';
import { loadHumans } from './characters/humans';
import { Cast } from './characters/cast';
import { HumanCrowd } from './characters/crowd';
import { BAR } from './world/noodlebar';
import type { WorldDef } from './world/defs';

const params = new URLSearchParams(location.search);
const CREDITS_HTML = `Design, code, procedural art, synth audio and music: generated for this project.<br><br>
three.js (MIT) — mrdoob &amp; contributors<br>Rapier physics (Apache-2.0) — Dimforge<br>Vite, TypeScript (MIT / Apache-2.0)<br>meshoptimizer (MIT) — Arseny Kapoulkine (offline mesh simplification)<br><br>
Human body, skeleton and animations: Universal Animation Library (Standard) — Quaternius, CC0 1.0<br>
HUD font: Rajdhani — Indian Type Foundry, SIL Open Font License 1.1<br><br>
Clothing, faces, vehicles, props, textures, music and sound: procedural, made for this project. See CREDITS.md.`;

export interface Game {
  renderer: THREE.WebGPURenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; post: Post; world: WorldDef;
  physics: PhysicsClient; tuning: Tuning; settings: Settings; state: () => VehicleState; bot: Bot | null; setBot: (b: Bot | null) => void;
  setTime: (h: number) => void; setRain: (r: number) => void; freezeCam: (pos: number[], look: number[], fov?: number) => void; releaseCam: () => void;
  stats: () => any; backend: string; frameCount: () => number; renderFrame: () => void; hud: (v: boolean) => void;
}

// let the browser paint (and stay responsive) between the heavy synchronous boot steps
const tick = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

async function boot() {
  const load = loadingScreen();
  await tick();
  const settings = loadSettings();
  // software rasteriser (no GPU acceleration): this renderer cannot run on it, start on Low and say why
  const softwareGL = (() => { try { const g = document.createElement('canvas').getContext('webgl2'); const e = g?.getExtension('WEBGL_debug_renderer_info');
    return !g || /swiftshader|llvmpipe|software|basic render/i.test(String(e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : '')); } catch { return false; } })();
  if (softwareGL && !params.has('quality')) settings.tier = 'low';
  const tierParam = params.get('quality') as Settings['tier'] | null;
  if (tierParam && TIERS[tierParam]) settings.tier = tierParam;
  const q = { ...TIERS[settings.tier], post: { ...TIERS[settings.tier].post } };
  // ?post=ssr,ao,... overrides the tier's post stages (debug / capture)
  if (params.has('post')) { const on = params.get('post')!.split(','); for (const k of Object.keys(q.post)) (q.post as any)[k] = on.includes(k); }
  // WebGL2 is the tested default; WebGPU is opt-in (Settings → Renderer, or ?backend=webgpu) and falls back on failure
  const wantGPU = (params.get('backend') === 'webgpu' || (settings.renderer === 'webgpu' && params.get('backend') !== 'webgl')) && !!(navigator as any).gpu;
  let made;
  try { made = await createRenderer(document.body, !wantGPU); }
  catch (e) { console.warn('WebGPU init failed, using WebGL2', e); document.querySelector('canvas')?.remove(); made = await createRenderer(document.body, true); }
  const { renderer, backend } = made;
  load.status('BUILDING THE DISTRICT'); await tick();
  const humansP = loadHumans().catch((e) => { console.warn('character data failed to load, using fallback figures', e); return null; });
  const W = params.get('w') ? +params.get('w')! : innerWidth, H = params.get('h') ? +params.get('h')! : innerHeight;
  renderer.setSize(W, H, !params.get('w'));
  renderer.setPixelRatio(q.renderScale * Math.min(1.5, devicePixelRatio || 1));
  renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(68, W / H, 0.1, 900);
  const worldName = params.get('world') ?? 'stacks';
  const world: WorldDef = worldName === 'test' ? buildTestArea() : worldName === 'slice' ? buildSlice() : buildStacks();
  (window as any).__NC_WORLD = worldName;
  await tick();
  const atmo = new Atmosphere(scene, renderer, q.shadows);
  const tuning: Tuning = cloneTuning(PRESETS[settings.preset] ?? BALANCED);
  const physics = new PhysicsClient();
  physics.onError = (m) => console.error(m);
  const streamer = new ChunkStreamer(scene, world as SliceWorld, makeMaterials(), physics);
  await physics.init(streamer.initialPhysics(world.spawn.pos[0], world.spawn.pos[2]), world.spawn.pos, world.spawn.yaw, tuning);
  streamer.update(new THREE.Vector3(...world.spawn.pos), new THREE.Vector3(...world.spawn.pos), true);
  load.status('POPULATING THE STREETS'); await tick();
  const dressing = (world as SliceWorld).dressing;
  if (dressing) scene.add(buildHolos(dressing.holos));
  const SW = world as StacksWorld;
  // crowds: skinned humans (pooled heroes → VAT instancing → silhouettes); old blob crowd only if the data failed
  let crowd: HumanCrowd | null = null;
  if (SW.walk) {
    const hum = await humansP;
    const dens = q.tier === 'low' ? 0.03 : q.tier === 'medium' ? 0.05 : 0.07;
    if (hum) {
      crowd = new HumanCrowd(hum, SW.walk, dens, q.tier === 'low' ? 3 : q.tier === 'medium' ? 6 : 10, q.tier === 'low' ? 10 : 15);
      if (q.tier === 'low') { crowd.midR = 60; crowd.nearR = 15; crowd.farR = 220; }
      load.status('DRESSING THE CROWDS'); await tick();
      await crowd.bake(tick);
      scene.add(crowd.group);
    } else scene.add(new Crowds(SW.walk, dens).group);
  }
  if (SW.lanes) scene.add(new Traffic(SW.lanes).group);
  const tram = SW.tram ? new Tram(scene, new THREE.Vector3(...SW.tram.a), new THREE.Vector3(...SW.tram.b)) : null;
  const pool = new LightPool(scene, q.lightPool, world.lights, world.neons);
  const rain = new Rain(scene, q.rain);
  await loadOverrides((m) => load.status(m), tick); // assets/**/*.glb drop-ins (none bundled → no-op)
  load.status('DRESSING THE CAST'); const humans = await humansP; await tick();
  const bike = new BikeModel(scene, q.tier === 'high', !humans);
  const post = new Post(renderer, scene, camera, q.post);


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
    garage: () => career?.garageMenu() ?? [], wallet: () => career?.save.credits ?? 0,
  });
  // ---- core loop systems (jobs, heat, navigation) ----
  const occ = new Occlusion(world);
  const heat = new HeatSystem(scene, occ);
  heat.onRoadblocks = (rb) => { if (rb) physics.addChunk('roadblock', rb.map((r) => ({ c: [r.x, 0.55, r.z] as [number, number, number], h: [1.8, 0.55, 0.3] as [number, number, number], yaw: r.yaw, mat: 'hazard' as const }))); else physics.removeChunk('roadblock'); };
  const nav = new NavUI(ui.root, world, worldName === 'stacks' ? 690 : 260, worldName === 'stacks' ? -320 : 0, 0);
  const career: Career | null = worldName === 'test' ? null : new Career(scene, world, nav, ui, heat, audio, tuning);
  if (career) { career.onTuning = (t) => physics.setTuning(t); career.applyUpgrades(); ui.setCredits(career.save.credits); }
  heat.onSpotted = () => { ui.toast('SPOTTED', 1.5); audio.blip(0.5); };
  const photo = new PhotoMode({ setTime: (h) => setTime(h), setRain: (r) => setRain(r), bike: bike.root,
    capture: async () => { const png = await captureCanvas(game); await saveBlob(new Blob([png as BlobPart], { type: 'image/png' }), `night-courier-${Date.now()}.png`); },
    onExit: () => { physics.freeze(false); ui.setHudVisible(true); if (career) career.showMarkers = true; } });
  const applySettings = (s: Settings) => {
    U.flicker.value = s.reduceFlicker ? 0 : 1; Pursuer.steadyStrobes = s.reduceFlicker;
    audio.musicOn = s.music; audio.volume = s.volume; if (audio.master) audio.master.gain.value = s.volume;
    if (s.tier !== q.tier || (s.renderer === 'webgpu') !== (backend === 'WebGPU')) ui.toast('APPLIES ON RELOAD', 2.5);
    if (!params.has('shot') && !params.has('time')) { setTime({ dusk: 19.8, night: 23.5, late: 3.0 }[s.tod] ?? 23.5); setRain({ storm: 1, rain: 0.75, drizzle: 0.35, clear: 0 }[s.weather] ?? 0.75); }
  };
  // ---- state ----
  let simState: VehicleState = physics.cur ?? createState(0, 1, 0, 0);
  const cam = createChase(simState);
  let bot: Bot | null = null;
  const botName = params.get('bot');
  if (botName && world.routes[botName]) bot = new Bot({ pts: world.routes[botName].pts, hops: worldName === 'test' ? [[17, -90]] : [] });
  let frozenCam: { pos: THREE.Vector3; look: THREE.Vector3; fov: number } | null = null;
  let shake = 0, timeOfDay = 23.5, rainAmt = 1, t = 0, frames = 0;
  const camVel = new THREE.Vector3(), lastCam = new THREE.Vector3();
  // on foot (M5): parked bike pose, the courier figure, the cook inside Hoshi
  let onFoot = false; let inside = false; let fade = 0;
  const parked = { x: 0, y: 0, z: 0, yaw: 0 };
  // skinned cast (fallback: the old box figures if the character data could not load)
  const cast = humans ? new Cast(scene, humans, bike.body) : null;
  if (cast) { const [gl, gr] = cast.grips(bike.body); bike.hull.setGrips(gl, gr); }
  const courier = cast ? null : new Person(scene); if (courier) courier.root.visible = false;
  if (!cast && worldName === 'stacks') new Person(scene, 0x3a2418, 0xffa142).update(BAR.kiso[0], BAR.kiso[1] + 0.9, BAR.kiso[2], Math.PI, 0, true, 0);
  if (cast && career) {
    const faceYaw: Record<string, number> = { dex: -Math.PI / 2, volt: Math.PI / 2, ume: Math.PI / 2 };
    const hh = world.anchors.hoshi;
    for (const f of career.fixers) {
      const yaw = f.id === 'kiso' && hh ? hh.yaw : faceYaw[f.id] ?? 0;
      const back = 1.6; // stand just behind the ring, facing the street
      cast.addFixer(f.id, [f.pos[0] - Math.sin(yaw) * back, f.pos[1], f.pos[2] - Math.cos(yaw) * back], yaw);
    }
    if (worldName === 'stacks') cast.addKiso([BAR.kiso[0], BAR.kiso[1] - 0.9, BAR.kiso[2]], 0);
  }
  const fadeEl = document.createElement('div'); fadeEl.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .35s;z-index:6'; document.body.appendChild(fadeEl);
  const doFade = (then: () => void) => { fadeEl.style.opacity = '1'; setTimeout(() => { then(); setTimeout(() => { fadeEl.style.opacity = '0'; }, 250); }, 380); };
  const FOOT_CAM = { camDistance: 3.4, camHeight: 1.9, camPullBack: 0, camLookAhead: 0, camStiffness: 7, fovBase: 60, fovBoost: 0 };
  const ft: number[] = [];

  const setTime = (h: number) => {
    timeOfDay = h;
    const night = h >= 21 || h < 5 ? 1 : h >= 19 ? (h - 19) / 2 : 0.0;
    U.night.value = night;
    atmo.fogDensity.value = 0.012 + (1 - night) * 0.003;
    atmo.fogColor.value.setRGB(0.018 + (1 - night) * 0.09, 0.022 + (1 - night) * 0.05, 0.05 + (1 - night) * 0.12);
    atmo.hazeColor.value.setRGB(0.16 + (1 - night) * 0.32, 0.045 + (1 - night) * 0.14, 0.16 + (1 - night) * 0.05);
    atmo.moon.intensity = 0.25 + (1 - night) * 0.9;
    atmo.hemi.intensity = 0.1 + (1 - night) * 0.5;
    scene.environmentIntensity = 0.3 + (1 - night) * 0.4;
  };
  const setRain = (r: number) => { rainAmt = r; U.rain.value = r; U.wet.value = Math.min(1, 0.35 + r); };
  setTime(+(params.get('time') ?? 23.5)); setRain(+(params.get('rain') ?? 1));
  applySettings(settings);

  const game: Game = {
    renderer, scene, camera, post, world, physics, tuning, settings, backend, state: () => simState, bot,
    setBot: (b) => { bot = b; }, setTime, setRain,
    freezeCam: (pos, look, fov = 50) => { frozenCam = { pos: new THREE.Vector3(...pos), look: new THREE.Vector3(...look), fov }; },
    releaseCam: () => { frozenCam = null; },
    stats: () => {
      const s = [...ft].sort((a, b) => a - b);
      const info = renderer.info as any;
      return { backend, frames, drawCalls: info.render?.drawCalls ?? info.render?.calls, triangles: info.render?.triangles, geometries: info.memory?.geometries, textures: info.memory?.textures,
        streaming: streamer.stats(), crowd: crowd?.stats, frameMsP50: s[Math.floor(s.length * 0.5)] ?? 0, frameMsP99: s[Math.floor(s.length * 0.99)] ?? 0, heapMB: (performance as any).memory ? Math.round((performance as any).memory.usedJSHeapSize / 1048576) : null,
        speed: simState.speed, pos: [simState.x, simState.y, simState.z] };
    },
    frameCount: () => frames, renderFrame: () => post.render(), hud: (v) => { ui.setHudVisible(v); if (career) career.showMarkers = v; },
  };
  (window as any).NRC_DEBUG = {
    game,
    teleport: (x: number, y: number, z: number, yaw = 0, speed = 0) => physics.teleport(x, y, z, yaw, speed),
    setTime, setRain,
    startJob: (id: string) => { const j = JOBS.find((x) => x.id === id); if (!j || !career) return 'unknown job: ' + JOBS.map((x) => x.id).join(', '); career.startJob(j); return 'started ' + id; },
    setHeat: (h: number) => { heat.setHeat(h); return heat.heat; },
    heat: () => ({ heat: heat.heat, meter: heat.meter, spotted: heat.spotted, exposure: heat.exposure, covered: heat.covered, pursuers: heat.pursuers.map((p) => p.kind) }),
    stats: () => game.stats(),
    tuning: () => JSON.stringify(tuning),
    foot: () => ({ onFoot, inside }),
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
    const careerOwns = career ? (nav.dialogOpen || nav.cardOpen) : false;
    if (a.pressed.pause && !ui.tuningOpen && !careerOwns) { if (ui.menuOpen) ui.closeMenu(); else { ui.openPause(); paused = true; physics.freeze(true); document.exitPointerLock?.(); } }
    else if (a.pressed.pause && ui.tuningOpen) ui.toggleTuning(false);
    if (a.pressed.tuning) ui.toggleTuning();
    if (a.pressed.map && !ui.menuOpen) nav.toggleMap();
    if (a.pressed.photo && !ui.menuOpen && !careerOwns) {
      if (photo.active) photo.exit();
      else { photo.enter(camera, timeOfDay, rainAmt); physics.freeze(true); ui.setHudVisible(false); if (career) career.showMarkers = false; document.exitPointerLock?.(); }
    }
    if (a.pressed.lights) { bike.lightsOn = !bike.lightsOn; ui.toast(bike.lightsOn ? 'LIGHTS ON' : 'LIGHTS OFF'); }
    ui.handle(a);

    let vin: VehicleInput = paused ? { throttle: 0, steer: 0, boost: false, drift: false, hopLeft: false, hopRight: false }
      : { throttle: a.axes.throttle, steer: a.axes.steer, boost: a.down.boost, drift: a.down.drift, hopLeft: a.pressed.hopLeft, hopRight: a.pressed.hopRight };
    if (bot && !paused) vin = bot.drive(simState, tuning);
    const ev = physics.takeEvents();
    if (photo.active) vin = { throttle: 0, steer: 0, boost: false, drift: false, hopLeft: false, hopRight: false };
    if (career && !paused && !photo.active) {
      const owns = career.update(dt, simState, a, ev, Math.atan2(-(cam.tx - cam.x), -(cam.tz - cam.z)), bike.lightsOn);
      if (owns) vin = { throttle: 0, steer: 0, boost: false, drift: false, hopLeft: false, hopRight: false };
      ui.setCredits(career.save.credits);
    }
    // on-foot / doors: F near Hoshi's door enters, F by the bike mounts, F when stopped (and no fixer) dismounts
    if (!paused && !photo.active && career && !careerOwns && !nav.dialogOpen && !nav.cardOpen && worldName === 'stacks') {
      const h = world.anchors.hoshi;
      const nearDoor = onFoot && !inside && h && Math.hypot(h.pos[0] + Math.sin(h.yaw) * 1.2 - simState.x, h.pos[2] + Math.cos(h.yaw) * 1.2 - simState.z) < 3;
      const nearExit = inside && Math.hypot(BAR.door[0] - simState.x, BAR.door[2] - simState.z) < 1.8;
      const nearBike = onFoot && !inside && Math.hypot(parked.x - simState.x, parked.z - simState.z) < 3;
      if (nearDoor) nav.showPrompt(`<b>${glyph('interact')}</b>Enter Hoshi Noodle Bar`);
      else if (nearExit) nav.showPrompt(`<b>${glyph('interact')}</b>Back out into the rain`);
      else if (nearBike) nav.showPrompt(`<b>${glyph('interact')}</b>Ride`);
      if (a.pressed.interact && !(career.nearFixer)) {
        if (nearDoor && h) { doFade(() => { inside = true; physics.teleport(BAR.door[0], BAR.door[1] + 0.3, BAR.door[2] - 0.6, 0); }); }
        else if (nearExit && h) { doFade(() => { inside = false; physics.teleport(h.pos[0] + Math.sin(h.yaw) * 2.5, 1, h.pos[2] + Math.cos(h.yaw) * 2.5, h.yaw); }); }
        else if (nearBike) { onFoot = false; physics.setMode('bike'); physics.teleport(parked.x, parked.y + 0.2, parked.z, parked.yaw); if (courier) courier.root.visible = false; cast?.setOnFoot(false); }
        else if (!onFoot && simState.speed < 2 && simState.grounded) {
          onFoot = true; Object.assign(parked, { x: simState.x, y: simState.y, z: simState.z, yaw: simState.yaw });
          physics.setMode('foot'); physics.teleport(simState.x + Math.cos(simState.yaw) * 1.4, simState.y + 0.1, simState.z - Math.sin(simState.yaw) * 1.4, simState.yaw);
          if (courier) courier.root.visible = true; cast?.setOnFoot(true);
        }
      }
    }
    if (onFoot) (vin as any).camYaw = Math.atan2(-(cam.tx - cam.x), -(cam.tz - cam.z));
    physics.frame(dt, vin, { pivot: cam.pivot, dir: cam.dir, len: cam.want, bike: [simState.x, simState.y, simState.z] });
    if (physics.cur) simState = physics.cur;
    const pose = physics.pose();
    if (ev.boostStarted) { audio.boost(); shake = Math.max(shake, 0.25); }
    if (ev.impact > 2) { audio.impact(ev.impact); shake = Math.max(shake, Math.min(1, ev.impact / 12)); }
    if (ev.hopped) audio.hop();
    if (ev.landed > 3) audio.land(ev.landed);
    if (ev.driftReleased > 0) { audio.driftKick(); ui.toast('DRIFT BOOST', 0.8); }

    nav.update({ x: simState.x, z: simState.z, yaw: simState.yaw }, Math.atan2(-(cam.tx - cam.x), -(cam.tz - cam.z)), career?.objective ?? null, career?.markers2D() ?? [], heat.heat, heat.meter, heat.seen);
    if (onFoot) {
      bike.update(parked, { ...simState, speed: 0, yawRate: 0, slip: 0, boosting: false, grounded: true, nx: 0, ny: 1, nz: 0 } as VehicleState, dt);
      courier?.update(pose.x, pose.y, pose.z, pose.yaw, simState.speed, simState.grounded, dt);
      cast?.updateWalker(dt, pose.x, pose.y, pose.z, pose.yaw, simState.speed, simState.grounded);
    } else { bike.update(pose, simState, dt); cast?.updateRider(dt, simState); }
    cast?.updateNPCs(dt, camera.position);
    crowd?.update(t, dt, camera);
    const look = input.consumeLook();
    const renderState = { ...simState, x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw };
    updateChase(cam, renderState, { ...tuning, ...(onFoot ? FOOT_CAM : {}), fovBase: (onFoot ? FOOT_CAM.fovBase : tuning.fovBase) + settings.fovOffset }, dt, look, () => physics.camFree);
    if (photo.active) photo.update(dt, a, look, camera);
    else if (frozenCam) {
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

    rain.update(camera.position, camVel, simState.grounded ? simState.y - simState.groundDist : 0, inside ? 0 : rainAmt);
    pool.update(camera.position);
    streamer.update(camera.position, new THREE.Vector3(simState.x, simState.y, simState.z));
    tram?.update(t);
    atmo.follow(new THREE.Vector3(simState.x, simState.y, simState.z));
    // covered = under the tunnel roof or the deck (cheap analytic test for audio)
    const covered = worldName === 'test'
      ? (Math.abs(simState.z - 90) < 10 && Math.abs(simState.x) < 80 && simState.y < 6) || (Math.abs(simState.z + 90) < 7 && Math.abs(simState.x) < 100 && simState.y < 8)
      : inside || (Math.abs(simState.x - 35) < 6 && simState.z < 62 && simState.z > -96 && simState.y < 8);
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
    audio.update({ speed: onFoot ? 0 : simState.speed, boosting: simState.boosting, drifting: simState.drifting, slip: simState.slip, grounded: simState.grounded,
      onWater: simState.surface === 'water', rain: rainAmt, covered, cam: { x: camera.position.x, y: camera.position.y, z: camera.position.z, fx: fwd.x, fz: fwd.z },
      tramAt: tram ? tram.pos : null,
      buzzAt: pool.lights[0] ? { x: pool.lights[0].position.x, y: pool.lights[0].position.y, z: pool.lights[0].position.z } : null });
    ui.hud(simState.speed, simState.boost, simState.boosting, simState.drifting ? simState.driftCharge : 0, dt, t);
    // speed-adaptive post: blur, DoF and CA ramp with speed so the frame stays readable when slow
    const sp01 = Math.min(1, Math.max(0, (simState.speed - 12) / 23));
    POST.bloomStrength.value = 0.5 + (simState.boosting ? 0.08 : 0);
    if (!photo.active) {
    // velocity buffer is per-frame: normalise to a 60 fps reference so low frame rates don't over-blur
    POST.blurAmount.value = settings.motionBlur && !frozenCam ? (0.05 + sp01 * 0.2) * Math.min(1, (1 / 60) / Math.max(dt, 1e-3)) : 0;
    POST.focusDist.value = frozenCam ? frozenCam.pos.distanceTo(frozenCam.look) : cam.armLen + 1;
    POST.focalLen.value = frozenCam ? 40 : 120;
    POST.bokeh.value = frozenCam ? 1.0 : sp01 * 0.35; // gameplay: only a hint of far blur at speed
    POST.ca.value = (settings.reduceFlicker ? 0.3 : 1) * (0.05 + sp01 * 0.12 + (simState.boosting ? 0.08 : 0));
    POST.lensWet.value = rainAmt * (covered ? 0 : 1) * Math.max(0, 1 - simState.speed / 30);
    }
    post.render();
    if (!(window as any).__NC_MANUAL) requestAnimationFrame(frame);
  };

  // compile shaders in parallel in the background (progress shown), then warm the first frame behind the loading screen
  load.status('COMPILING SHADERS'); await tick();
  // pursuit craft spawn mid-chase: compile their shared materials now (parked in front of the camera during compile only)
  const craftWarm = new THREE.Group(); for (const k of ['drone', 'patrol', 'hound', 'sweeper'] as const) craftWarm.add(buildCraft(k));
  craftWarm.add(propWarmGroup());
  craftWarm.position.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(6)); scene.add(craftWarm);
  try { await post.compile(renderer, scene, camera, (d, n) => load.status(`COMPILING SHADERS ${d}/${n}`)); } catch (e) { console.warn('shader precompile failed', e); }
  scene.remove(craftWarm);
  load.status('WARMING UP'); await tick();
  const T1 = performance.now(); post.render(); await tick(); post.render(); await tick();
  const warmMs = performance.now() - T1;
  // a machine that needs seconds for two frames cannot run this tier: fall back to Low once and reload (guarded against loops)
  let slowNote = '';
  if (warmMs > 6000 && settings.tier !== 'low' && !params.has('quality')) {
    let tried = false; try { tried = sessionStorage.getItem('nc.autolow') === '1'; sessionStorage.setItem('nc.autolow', '1'); } catch { /* ignore */ }
    if (!tried) { settings.tier = 'low'; saveSettings(settings); load.status('SLOW GRAPHICS DETECTED — SWITCHING TO LOW QUALITY'); setTimeout(() => location.reload(), 600); return; }
  }
  if (softwareGL || warmMs > 6000) slowNote = 'NO GPU ACCELERATION DETECTED — turn on "Use graphics acceleration" in your browser settings, then reload';
  const shot = params.get('shot');
  const auto = !!shot || params.has('nosplash') || !!botName;
  if (slowNote) { load.status(slowNote); await tick(); }
  load.ready(() => { audio.start(); applySettings(settings); }, auto);
  requestAnimationFrame(frame);
  (window as any).__NC_READY = true;
  if (shot && SHOTS[shot]) await setupShot(game, shot);
  // debug: ?job=<id> starts a job at load, ?map=1 opens the full map (captures / testing)
  if (params.get('job')) (window as any).NRC_DEBUG.startJob(params.get('job'));
  if (params.get('map')) nav.toggleMap(true);
}

boot().catch((e) => { console.error('boot failed', e); const el = document.querySelector('.loading .s'); if (el) el.textContent = 'FAILED TO START: ' + (e?.message ?? e); });
