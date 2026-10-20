import fs from 'node:fs';
const buf = fs.readFileSync('src/assets/gen/humans.bin'); const hl = buf.readUInt32LE(0); const H = JSON.parse(buf.subarray(4, 4 + hl).toString());
const base = 4 + hl;
for (const c of H.clips) { const p = new Float32Array(buf.buffer.slice(buf.byteOffset + base + c.p[0], buf.byteOffset + base + c.p[0] + c.p[1])); console.log(c.name.padEnd(20), c.frames, 'root', [...p.slice(0, 3)].map((x) => x.toFixed(2)).join(','), 'hips', [...p.slice(3, 6)].map((x) => x.toFixed(2)).join(',')); }
console.log('hips rest', H.bones[1].p, 'root rest', H.bones[0].p, H.bones[0].q);
