// Fixers, authored jobs and dialogue, the job state machine, ratings (time / style / heat), credits,
// upgrades and the localStorage save. No runtime AI: every line is written here.
import * as THREE from 'three/webgpu';

export type JobType = 'delivery' | 'chase' | 'dark' | 'trial';
export interface Fixer { id: string; name: string; pos: [number, number, number]; color: string; pitch: number; greet: string[] }
export interface JobDef {
  id: string; fixer: string; type: JobType; title: string; brief: string[];
  drop: [number, number, number]; dropName: string; time: number; reward: number;
  success: string; fail: string;
  sweepers?: [number, number, number][][]; // dark run patrol paths
  checkpoints?: 'marketRun';                // time trial: checkpoint list provided by the world
}

export const FIXERS: Fixer[] = [
  { id: 'kiso', name: 'Mama Kiso', pos: [0, 0, 0], color: '#ffa142', pitch: 0.8, greet: ['Rain\'s good for business, courier. Hungry people tip.'] },
  { id: 'dex', name: 'Dex', pos: [290, 0, -50], color: '#19e6ff', pitch: 1.25, greet: ['You again. Good. I hate new faces near the water.'] },
  { id: 'volt', name: 'Volt', pos: [-130, 0, -172], color: '#ff2aa8', pitch: 1.05, greet: ['Lights off, mouth shut. That\'s the whole job description.'] },
  { id: 'ume', name: 'Granny Ume', pos: [-354, 0, 70], color: '#ffd28a', pitch: 0.7, greet: ['The market lanterns go dark at midnight. Before that, they race.'] },
];

export const JOBS: JobDef[] = [
  { id: 'kiso_tram', fixer: 'kiso', type: 'delivery', title: 'Two Bowls for the Tram Crew',
    brief: ['Tram crew at the west yard ordered tonkotsu. Two bowls.', 'Broth cools in thirty-five seconds in this weather. You know what cold ramen does to my reputation?', 'Go.'],
    drop: [-210, 0, 236], dropName: 'Tram yard, west', time: 34, reward: 180,
    success: 'Still steaming. They say you drive like a lunatic. I say that\'s a compliment.', fail: 'Cold noodles. I\'m docking that from your tip. Try again when you\'re faster.' },
  { id: 'kiso_ring', fixer: 'kiso', type: 'delivery', title: 'Soup on the Ring',
    brief: ['A regular is stuck in traffic up on the Ring. East ramp, by the canal. He\'s waiting on the deck.', 'Elevated lane, twelve metres up. Don\'t spill.'],
    drop: [200, 12, -230], dropName: 'The Ring deck, east', time: 60, reward: 240,
    success: 'He says the soup survived and so did you. Good night for both.', fail: 'He gave up and ate a vending-machine pie. Shameful.' },
  { id: 'dex_hound', fixer: 'dex', type: 'chase', title: 'Shake the Hound',
    brief: ['Shard\'s hot. A corp Hound drone already has your scent. It\'s faster than you on a straight.', 'Break its line of sight. Tunnels, under the Skyway, alleys. Six seconds clean and it loses you.', 'Then bring the shard to Kiso\'s. She owes me.'],
    drop: [0, 0, 104], dropName: 'Hoshi plaza', time: 170, reward: 320,
    success: 'Hound\'s sniffing a dumpster two districts over. Beautiful.', fail: 'The Hound followed you all the way. Now they know Kiso\'s. Great.' },
  { id: 'volt_dark', fixer: 'volt', type: 'dark', title: 'Lights Out',
    brief: ['Package for the tram yard. Three sweeper drones patrol the west blocks tonight.', 'Kill your lights, stay out of the cones, use the dark. If one locks on, the deal is off.', 'You\'ll see the cones warm up before they see you. Respect the warning.'],
    drop: [-300, 0, 236], dropName: 'Tram yard, far west', time: 150, reward: 360,
    sweepers: [[[-210, 16, -120], [-210, 16, 120], [-210, 16, -120]], [[-300, 16, 120], [-300, 16, -60], [-250, 16, 60]], [[-260, 16, 220], [-140, 16, 220], [-200, 16, 160]]],
    success: 'Clean. Not a single camera blinked. I might even remember your name.', fail: 'Every sweeper in the west saw your face. Go cool off and try again.' },
  { id: 'ume_lanterns', fixer: 'ume', type: 'trial', title: 'Lantern Run', checkpoints: 'marketRun',
    brief: ['Old courier tradition. Touch every lantern gate through the market, end back on the Ring ramp.', 'Your best run rides with you as a ghost. Beat yourself.'],
    drop: [0, 0, 0], dropName: 'Lantern gates', time: 75, reward: 220,
    success: 'Ha! The lanterns approve. Come back and beat that ghost.', fail: 'Too slow, the lanterns are out. Try again, child.' },
];

export interface SaveData { credits: number; upgrades: Record<string, number>; done: Record<string, { stars: number; best: number }> }
export const UPGRADES = [
  { id: 'thrusters', name: 'Thruster tune', desc: '+2 m/s top and boost speed, punchier launch', cost: 300 },
  { id: 'tank', name: 'Boost tank', desc: 'Boost lasts 30% longer', cost: 350 },
  { id: 'coils', name: 'Stealth coils', desc: 'Searchlights take 50% longer to lock on', cost: 400 },
];

export function loadSave(): SaveData {
  try { const s = JSON.parse(localStorage.getItem('nc.save') || 'null'); if (s) return { credits: 0, upgrades: {}, done: {}, ...s }; } catch { /* no storage */ }
  return { credits: 0, upgrades: {}, done: {} };
}
export function writeSave(s: SaveData) { try { localStorage.setItem('nc.save', JSON.stringify(s)); } catch { /* storage unavailable: progress lasts this session */ } }

export interface Rating { time: number; style: number; heat: number; stars: number; reward: number; timeStars: number; styleStars: number; heatStars: number }

export function rate(job: JobDef, elapsed: number, style: number, maxHeat: number): Rating {
  const tf = Math.max(0, (job.time - elapsed) / job.time);
  const timeStars = tf > 0.4 ? 3 : tf > 0.15 ? 2 : 1;
  const styleStars = style >= 400 ? 3 : style >= 180 ? 2 : 1;
  const heatStars = maxHeat < 0.5 ? 3 : maxHeat < 2.5 ? 2 : 1;
  const stars = Math.max(1, Math.round((timeStars * 1.2 + styleStars + heatStars * (job.type === 'chase' ? 0.5 : 1)) / (job.type === 'chase' ? 2.7 : 3.2)));
  return { time: elapsed, style, heat: maxHeat, stars, timeStars, styleStars, heatStars, reward: Math.round(job.reward * (0.7 + stars * 0.15)) };
}

/** Runtime state of the current job. */
export class JobRunner {
  job: JobDef | null = null;
  phase: 'idle' | 'active' | 'done' | 'failed' = 'idle';
  t = 0; style = 0; maxHeat = 0; shakeT = 0; shaken = false; cp = 0;
  start(job: JobDef) { this.job = job; this.phase = 'active'; this.t = 0; this.style = 0; this.maxHeat = 0; this.shakeT = 0; this.shaken = job.type !== 'chase'; this.cp = 0; }
  get objective(): THREE.Vector3 | null { return this.job && this.phase === 'active' ? new THREE.Vector3(...this.job.drop) : null; }
}
