// Heat fairness (M4 FUN gate): warning time before detection, effect of darkness/lights/stealth coils,
// cover blocking sight, and losing pursuers. Pure Node (three scene objects without a renderer).
import * as THREE from 'three/webgpu';
import { buildStacks } from '../src/world/stacks';
import { Occlusion } from '../src/heat/occlusion';
import { HeatSystem, type PlayerView } from '../src/heat/heat';

const W = buildStacks(); const occ = new Occlusion(W);
const out: any = {};
function trial(name: string, player: Partial<PlayerView>, opts: { dark?: boolean } = {}) {
  const scene = new THREE.Scene(); const heat = new HeatSystem(scene, occ);
  const P: PlayerView = { x: -130, y: 0.9, z: 100, vx: 0, vz: 0, speed: 0, lightsOn: true, stealthMul: 1, ...player };
  const s = heat.add('sweeper', new THREE.Vector3(P.x + 6, 16, P.z), [new THREE.Vector3(P.x + 6, 16, P.z)]);
  s.aim.set(-6, -15.1, 0).normalize(); (s as any).update = function (dt: number) { this.t += dt; }; // hold the beam on the player
  let t = 0, firstSeen = -1, spotted = -1;
  while (t < 8) { heat.update(1 / 60, P); t += 1 / 60; if (heat.seen && firstSeen < 0) firstSeen = t; if (heat.spotted && spotted < 0) { spotted = t; break; } }
  out[name] = { exposure: +heat.exposure.toFixed(2), covered: heat.covered, firstSeen: +firstSeen.toFixed(2), spotted: +spotted.toFixed(2), graceSec: spotted > 0 ? +(spotted - firstSeen).toFixed(2) : null };
  return heat;
}
trial('lit street, lights on', {});
trial('lit street, stealth coils', { stealthMul: 1.5 });
trial('lights off', { lightsOn: false });
// darkest sidewalk spot we can find near x=-130
let best = { e: 9, z: 0 }; for (let z = -300; z < 300; z += 4) { const e = occ.exposure(-130, 0.9, z); if (e < best.e) best = { e, z }; }
trial('dark spot, lights off', { lightsOn: false, z: best.z });
// cover: under the Ring deck
trial('under the Ring deck', { x: -100, z: -230, lightsOn: true });
// losing them: spotted, then out of sight → time until no longer spotted, heat after 30 s
{
  const scene = new THREE.Scene(); const heat = new HeatSystem(scene, occ);
  heat.setHeat(2);
  const P: PlayerView = { x: -100, y: 0.9, z: -230, vx: 0, vz: 0, speed: 0, lightsOn: false, stealthMul: 1 };
  let t = 0, lost = -1;
  while (t < 40) { heat.update(1 / 30, P); t += 1 / 30; if (!heat.spotted && lost < 0) lost = t; }
  out['escape under cover'] = { lostAfterSec: +lost.toFixed(1), heatAfter40s: +heat.heat.toFixed(2), pursuers: heat.pursuers.length };
}
console.log(JSON.stringify(out, null, 1));
