// Shared world description: the same data builds render meshes (main thread)
// and Rapier colliders (physics worker / Node bot tests).

export type Surface = 'asphalt' | 'concrete' | 'metal' | 'water' | 'brick' | 'glass';
export type MatId =
  | 'asphalt' | 'sidewalk' | 'concrete' | 'brick' | 'metal' | 'facade' | 'facadeB' | 'glass'
  | 'deck' | 'water' | 'canalWall' | 'roof' | 'grey' | 'greyDark' | 'hazard' | 'tunnel';

/** Oriented box. Rotation is yaw (around Y) then pitch (around local X), radians. */
export interface BoxDef {
  c: [number, number, number];
  h: [number, number, number];   // half extents
  yaw?: number;
  pitch?: number;
  mat: MatId;
  surface?: Surface;
  collide?: 'solid' | 'ground' | 'water' | 'none'; // default solid
  /** facade lit-window density 0..1 (facade materials only) */
  lit?: number;
  seed?: number;
}

export interface NeonDef {
  pos: [number, number, number];
  size: [number, number];       // width, height
  yaw: number;                  // facing direction (normal) yaw
  color: string;                // css colour
  text: string;
  vertical?: boolean;
  flicker?: number;             // 0..1
  light?: number;               // point light intensity for the pool (0 = none)
}

export interface LightDef {
  pos: [number, number, number];
  color: string;
  intensity: number;
  range: number;
  cone?: { dirYaw: number; dirPitch: number; angle: number }; // fake volumetric shaft
}

export interface WorldDef {
  boxes: BoxDef[];
  neons: NeonDef[];
  lights: LightDef[];
  spawn: { pos: [number, number, number]; yaw: number };
  /** named camera / bot anchors */
  anchors: Record<string, { pos: [number, number, number]; yaw: number; pitch?: number }>;
  /** bot routes: polylines of [x, z] (y follows the ground) */
  routes: Record<string, { pts: [number, number][]; targetTime: [number, number] }>;
}

// Collision group bits (Rapier InteractionGroups = membership << 16 | filter)
export const G_GROUND = 0x1, G_SOLID = 0x2, G_WATER = 0x4;
export const groups = (member: number, filter: number) => ((member & 0xffff) << 16) | (filter & 0xffff);
