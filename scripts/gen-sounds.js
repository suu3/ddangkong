// Synthesize license-free SFX as 16-bit mono WAV files.
const fs = require('fs');

const SR = 22050;

function writeWav(path, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path, buf);
  console.log('wrote', path, (buf.length / 1024).toFixed(1) + 'KB');
}

function normalize(s, peak = 0.9) {
  const max = s.reduce((m, v) => Math.max(m, Math.abs(v)), 1e-9);
  return s.map(v => (v / max) * peak);
}

// --- boom: noise burst through decaying lowpass + sub-bass thump ---
function genBoom() {
  const dur = 1.5;
  const n = Math.floor(SR * dur);
  const out = new Array(n).fill(0);

  // brown-ish noise with sweeping one-pole lowpass
  let brown = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    brown += (Math.random() * 2 - 1) * 0.2;
    brown *= 0.98;
    const cutoff = 3500 * Math.exp(-t * 6) + 120; // 3500Hz -> 120Hz
    const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
    lp += alpha * (brown - lp);
    const env = Math.exp(-t * 4.2) * (t < 0.01 ? t / 0.01 : 1);
    out[i] += lp * env * 3.0;
  }

  // sub thump: 95Hz -> 32Hz sweep
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 32 + 63 * Math.exp(-t * 7);
    phase += (2 * Math.PI * f) / SR;
    out[i] += Math.sin(phase) * Math.exp(-t * 3.2) * 0.8;
  }

  // crackle tail
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    if (Math.random() < 0.004 * Math.exp(-t * 2)) {
      const len = Math.floor(SR * 0.004);
      for (let j = 0; j < len && i + j < n; j++) {
        out[i + j] += (Math.random() * 2 - 1) * 0.25 * (1 - j / len);
      }
    }
  }

  // soft clip
  return normalize(out.map(v => Math.tanh(v * 1.6)), 0.92);
}

// --- tick: short bright click for countdown ---
function genTick() {
  const dur = 0.09;
  const n = Math.floor(SR * dur);
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.exp(-t * 90);
    out[i] = (Math.sin(2 * Math.PI * 1750 * t) * 0.8 + Math.sin(2 * Math.PI * 3500 * t) * 0.3) * env;
    if (i < SR * 0.002) out[i] += (Math.random() * 2 - 1) * 0.3 * (1 - i / (SR * 0.002));
  }
  return normalize(out, 0.6);
}

const dir = process.argv[2] || '.';
writeWav(dir + '/boom.wav', genBoom());
writeWav(dir + '/tick.wav', genTick());
