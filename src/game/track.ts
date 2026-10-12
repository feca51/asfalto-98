export type TrackSample = {
  x: number;
  z: number;
  dist: number;
  tx: number;
  tz: number;
};

export type Track = {
  length: number;
  samples: TrackSample[];
};

export type Pose = {
  x: number;
  z: number;
  tx: number;
  tz: number;
  lx: number;
  lz: number;
  yaw: number;
};

export type Circuit = {
  id: string;
  name: string;
  blurb: string;
  level: "fácil" | "media" | "técnica";
  track: Track;
};

type Pt = { x: number; z: number };
type Corner = Pt & { r?: number };

const STEP = 2;

function pushPt(pts: Pt[], point: Pt) {
  const last = pts[pts.length - 1];
  if (last && Math.hypot(point.x - last.x, point.z - last.z) < 0.35) return;
  pts.push(point);
}

function pushLine(pts: Pt[], x0: number, z0: number, x1: number, z1: number) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < 0.05) return;
  const n = Math.max(1, Math.round(len / STEP));
  for (let i = 0; i < n; i += 1) {
    const t = i / n;
    pushPt(pts, { x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t });
  }
}

type Turn = {
  p0: Pt;
  p1: Pt;
  cx: number;
  cz: number;
  a0: number;
  sweep: number;
  r: number;
};

function compileCircuit(corners: Corner[], fallbackR: number): Track {
  const n = corners.length;
  const turns: Turn[] = [];
  for (let i = 0; i < n; i += 1) {
    const prev = corners[(i - 1 + n) % n];
    const curr = corners[i];
    const next = corners[(i + 1) % n];
    let ax = curr.x - prev.x;
    let az = curr.z - prev.z;
    const aLen = Math.hypot(ax, az) || 1;
    ax /= aLen;
    az /= aLen;
    let bx = next.x - curr.x;
    let bz = next.z - curr.z;
    const bLen = Math.hypot(bx, bz) || 1;
    bx /= bLen;
    bz /= bLen;
    const cross = ax * bz - az * bx;
    const dot = Math.max(-1, Math.min(1, ax * bx + az * bz));
    const delta = Math.atan2(cross, dot);
    const abs = Math.abs(delta);
    const want = curr.r ?? fallbackR;
    if (abs < 0.05 || want < 1) {
      turns.push({
        p0: { x: curr.x, z: curr.z },
        p1: { x: curr.x, z: curr.z },
        cx: curr.x,
        cz: curr.z,
        a0: 0,
        sweep: 0,
        r: 0,
      });
      continue;
    }
    const maxT = Math.min(aLen, bLen) * 0.46;
    let t = want * Math.tan(abs / 2);
    let r = want;
    if (!(t > 0) || t > maxT) {
      t = Math.max(0.5, maxT);
      r = t / Math.tan(abs / 2);
    }
    const p0 = { x: curr.x - ax * t, z: curr.z - az * t };
    const p1 = { x: curr.x + bx * t, z: curr.z + bz * t };
    const side = delta > 0 ? 1 : -1;
    const nx = -az * side;
    const nz = ax * side;
    const pack = (cx: number, cz: number, dir: number): Turn => {
      const a0 = Math.atan2(p0.z - cz, p0.x - cx);
      const a1 = Math.atan2(p1.z - cz, p1.x - cx);
      let sweep = a1 - a0;
      if (dir > 0) while (sweep <= 0) sweep += Math.PI * 2;
      else while (sweep >= 0) sweep -= Math.PI * 2;
      return { p0, p1, cx, cz, a0, sweep, r };
    };
    const primary = pack(p0.x + nx * r, p0.z + nz * r, side);
    const flipped = pack(p0.x - nx * r, p0.z - nz * r, -side);
    const err = (turn: Turn) => Math.abs(Math.abs(turn.sweep) - abs);
    turns.push(err(flipped) + 0.05 < err(primary) ? flipped : primary);
  }

  let best = 0;
  let bestLen = -1;
  for (let i = 0; i < n; i += 1) {
    const a = turns[i].p1;
    const b = turns[(i + 1) % n].p0;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len > bestLen) {
      bestLen = len;
      best = i;
    }
  }

  const pts: Pt[] = [];
  for (let k = 0; k < n; k += 1) {
    const i = (best + k) % n;
    const next = (i + 1) % n;
    const turn = turns[next];
    pushLine(pts, turns[i].p1.x, turns[i].p1.z, turn.p0.x, turn.p0.z);
    if (turn.r < 0.5 || Math.abs(turn.sweep) < 0.02) {
      pushPt(pts, turn.p0);
      continue;
    }
    const arcLen = Math.abs(turn.sweep) * turn.r;
    const steps = Math.max(2, Math.round(arcLen / STEP));
    for (let s = 0; s < steps; s += 1) {
      const u = turn.a0 + turn.sweep * (s / steps);
      pushPt(pts, { x: turn.cx + Math.cos(u) * turn.r, z: turn.cz + Math.sin(u) * turn.r });
    }
  }
  if (pts.length > 2) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (Math.hypot(first.x - last.x, first.z - last.z) < 0.35) pts.pop();
  }
  return samplesFrom(pts);
}

function samplesFrom(pts: Pt[]): Track {
  const samples: TrackSample[] = pts.map((point, index) => {
    const prev = pts[(index - 1 + pts.length) % pts.length];
    const next = pts[(index + 1) % pts.length];
    let tx = next.x - prev.x;
    let tz = next.z - prev.z;
    const mag = Math.hypot(tx, tz) || 1;
    tx /= mag;
    tz /= mag;
    return { x: point.x, z: point.z, dist: 0, tx, tz };
  });
  let acc = 0;
  for (let i = 1; i < samples.length; i += 1) {
    acc += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].z - samples[i - 1].z);
    samples[i].dist = acc;
  }
  const close = Math.hypot(
    samples[0].x - samples[samples.length - 1].x,
    samples[0].z - samples[samples.length - 1].z,
  );
  return { length: acc + close, samples };
}

function regular(sides: number, radius: number, corner: number): Corner[] {
  return Array.from({ length: sides }, (_, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / sides;
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, r: corner };
  });
}

function box(halfW: number, halfH: number, radius: number): Corner[] {
  return [
    { x: -halfW, z: -halfH, r: radius },
    { x: halfW, z: -halfH, r: radius },
    { x: halfW, z: halfH, r: radius },
    { x: -halfW, z: halfH, r: radius },
  ];
}

function define(id: string, name: string, level: Circuit["level"], blurb: string, corners: Corner[], radius = 24): Circuit {
  return { id, name, blurb, level, track: compileCircuit(corners, radius) };
}

export const CIRCUITS: Circuit[] = [
  define("monza", "Monza", "fácil", "Rettifilo, Lesmo y Parabólica. Real: 5,79 km.", [
    { x: -200, z: -52, r: 24 },
    { x: 190, z: -52, r: 16 },
    { x: 246, z: -12, r: 14 },
    { x: 200, z: 28, r: 14 },
    { x: 248, z: 82, r: 28 },
    { x: 50, z: 118, r: 22 },
    { x: -8, z: 74, r: 16 },
    { x: -36, z: 122, r: 16 },
    { x: -120, z: 90, r: 18 },
    { x: -210, z: 108, r: 20 },
    { x: -258, z: 36, r: 22 },
    { x: -220, z: -8, r: 20 },
  ]),
  define("spa", "Spa", "técnica", "Eau Rouge, Kemmel y Pouhon. Real: 7,00 km.", [
    { x: -40, z: -150, r: 18 },
    { x: 30, z: -120, r: 14 },
    { x: 8, z: -70, r: 16 },
    { x: 36, z: 40, r: 22 },
    { x: 10, z: 150, r: 20 },
    { x: -70, z: 120, r: 18 },
    { x: -130, z: 40, r: 22 },
    { x: -150, z: -40, r: 18 },
    { x: -90, z: -120, r: 16 },
    { x: -70, z: -150, r: 14 },
  ]),
  define("interlagos", "Interlagos", "media", "S de Senna y Curva do Sol. Real: 4,31 km.", [
    { x: -180, z: -48, r: 18 },
    { x: 150, z: -48, r: 14 },
    { x: 188, z: -16, r: 12 },
    { x: 150, z: 12, r: 12 },
    { x: 196, z: 52, r: 24 },
    { x: 20, z: 96, r: 22 },
    { x: -90, z: 48, r: 16 },
    { x: -40, z: 96, r: 16 },
    { x: -150, z: 78, r: 18 },
    { x: -200, z: 16, r: 20 },
  ]),
  define("imola", "Imola", "técnica", "Tosa, Piratella y Rivazza. Real: 4,91 km.", [
    { x: -200, z: -20, r: 22 },
    { x: 160, z: -28, r: 16 },
    { x: 210, z: 10, r: 14 },
    { x: 150, z: 48, r: 16 },
    { x: 40, z: 20, r: 14 },
    { x: 70, z: 78, r: 16 },
    { x: -40, z: 96, r: 18 },
    { x: -120, z: 55, r: 16 },
    { x: -80, z: 110, r: 14 },
    { x: -190, z: 70, r: 20 },
    { x: -220, z: 16, r: 18 },
  ]),
  define("catalunya", "Catalunya", "media", "Recta principal y la Repsol. Real: 4,66 km.", [
    { x: -210, z: -40, r: 20 },
    { x: 190, z: -40, r: 16 },
    { x: 220, z: -8, r: 14 },
    { x: 188, z: 28, r: 14 },
    { x: 230, z: 72, r: 22 },
    { x: 80, z: 100, r: 18 },
    { x: 20, z: 62, r: 16 },
    { x: -70, z: 96, r: 18 },
    { x: -180, z: 58, r: 20 },
    { x: -230, z: 8, r: 22 },
  ]),
  define("silverstone", "Silverstone", "media", "Maggotts, Becketts y la Vale. Real: 5,89 km.", [
    { x: -190, z: -70, r: 22 },
    { x: 120, z: -78, r: 16 },
    { x: 190, z: -30, r: 14 },
    { x: 150, z: 20, r: 14 },
    { x: 200, z: 70, r: 18 },
    { x: 60, z: 108, r: 20 },
    { x: -40, z: 70, r: 16 },
    { x: 10, z: 112, r: 14 },
    { x: -100, z: 90, r: 16 },
    { x: -180, z: 40, r: 22 },
    { x: -220, z: -20, r: 20 },
  ]),
  define("galvez", "Gálvez", "fácil", "El Oscar y Juan de Buenos Aires. Real: 4,26 km.", [
    { x: -200, z: -50, r: 24 },
    { x: 180, z: -50, r: 22 },
    { x: 220, z: 10, r: 20 },
    { x: 160, z: 70, r: 18 },
    { x: 40, z: 40, r: 16 },
    { x: -20, z: 90, r: 18 },
    { x: -140, z: 70, r: 20 },
    { x: -220, z: 10, r: 22 },
  ]),
  define("termas", "Termas", "media", "La recta de Río Hondo. Real: 4,81 km.", [
    { x: -230, z: -28, r: 20 },
    { x: 200, z: -28, r: 16 },
    { x: 236, z: 16, r: 14 },
    { x: 180, z: 58, r: 16 },
    { x: 80, z: 28, r: 14 },
    { x: 40, z: 78, r: 16 },
    { x: -60, z: 48, r: 14 },
    { x: -30, z: 96, r: 16 },
    { x: -160, z: 72, r: 18 },
    { x: -230, z: 20, r: 20 },
  ]),
  define("spielberg", "Spielberg", "fácil", "Red Bull Ring. Corta y de frenada. Real: 4,32 km.", [
    { x: -180, z: -36, r: 22 },
    { x: 160, z: -36, r: 18 },
    { x: 200, z: 16, r: 16 },
    { x: 70, z: 64, r: 16 },
    { x: 10, z: 20, r: 14 },
    { x: -30, z: 72, r: 16 },
    { x: -180, z: 40, r: 20 },
  ]),
  define("monaco", "Mónaco", "técnica", "Loews, el túnel y la Rascasse. Real: 3,34 km.", [
    { x: -70, z: -90, r: 12 },
    { x: 80, z: -90, r: 12 },
    { x: 110, z: -50, r: 12 },
    { x: 70, z: -10, r: 12 },
    { x: 110, z: 40, r: 12 },
    { x: 40, z: 80, r: 14 },
    { x: -40, z: 50, r: 12 },
    { x: -20, z: 96, r: 12 },
    { x: -100, z: 60, r: 12 },
    { x: -120, z: -20, r: 12 },
    { x: -90, z: -70, r: 12 },
  ]),
];

export const TRACK = CIRCUITS[0].track;

const byId = new Map(CIRCUITS.map((circuit) => [circuit.id, circuit]));

export function trackById(id: string): Circuit {
  return byId.get(id) ?? CIRCUITS[0];
}

export function outlineOf(track: Track, every = 3): { x: number; z: number }[] {
  return track.samples.filter((_, index) => index % every === 0).map((sample) => ({
    x: sample.x,
    z: sample.z,
  }));
}

export function sampleAt(dist: number, track: Track = TRACK): Pose {
  const length = track.length;
  const d = ((dist % length) + length) % length;
  const samples = track.samples;
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (samples[mid].dist <= d) lo = mid;
    else hi = mid - 1;
  }
  const i0 = lo;
  const i1 = (i0 + 1) % samples.length;
  const a = samples[i0];
  const b = samples[i1];
  const bDist = i1 === 0 ? length : b.dist;
  const t = Math.min(1, Math.max(0, (d - a.dist) / Math.max(0.0001, bDist - a.dist)));
  const x = a.x + (b.x - a.x) * t;
  const z = a.z + (b.z - a.z) * t;
  let tx = a.tx + (b.tx - a.tx) * t;
  let tz = a.tz + (b.tz - a.tz) * t;
  const mag = Math.hypot(tx, tz) || 1;
  tx /= mag;
  tz /= mag;
  const yaw = Math.atan2(-tx, -tz);
  return {
    x,
    z,
    tx,
    tz,
    lx: -Math.cos(yaw),
    lz: Math.sin(yaw),
    yaw,
  };
}

export function circuitAudit(track: Track): { minGap: number; straight: number; length: number } {
  const samples = track.samples;
  const length = track.length;
  let minGap = Number.POSITIVE_INFINITY;
  for (let i = 0; i < samples.length; i += 2) {
    for (let j = i + 10; j < samples.length; j += 2) {
      const along = samples[j].dist - samples[i].dist;
      const wrapped = Math.min(along, length - along);
      if (wrapped < 40) continue;
      const gap = Math.hypot(samples[j].x - samples[i].x, samples[j].z - samples[i].z);
      if (gap < minGap) minGap = gap;
    }
  }
  let straight = 0;
  for (let s = 0; s < Math.min(length * 0.45, 220); s += 2) {
    const a = sampleAt(s, track);
    const b = sampleAt(s + 8, track);
    const dyaw = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
    if (Math.abs(dyaw) > 0.09) break;
    straight = s;
  }
  return { minGap, straight, length };
}
