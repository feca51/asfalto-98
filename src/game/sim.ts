import { LAPS, carById, type Racer } from "@/game/catalog";
import { TRACK, sampleAt, type Track } from "@/game/track";

export type DriveInput = {
  steer: number;
  throttle: number;
  brake: number;
};

export type SimCar = {
  id: string;
  alias: string;
  carId: string;
  carName: string;
  color: string;
  player: boolean;
  top: number;
  accel: number;
  grip: number;
  pace: number;
  mistakeRate: number;
  turn: number;
  vmax: number;
  wheel: number;
  remote: boolean;
  phase: number;
  s: number;
  laps: number;
  offset: number;
  speed: number;
  yaw: number;
  x: number;
  z: number;
  progress: number;
  finished: boolean;
  lapMark: number;
  lapStartS: number;
  bestLap: number;
  maxSpeed: number;
  displayMax: number;
  overtakes: number;
  rank: number;
  lastPass: number;
  mistakeT: number;
  lapRun: number;
};

export type Sim = {
  mode: "drive" | "watch";
  phase: "lights" | "racing" | "finished";
  lights: number;
  clock: number;
  raceTime: number;
  winnerId: string | null;
  cars: SimCar[];
  track: Track;
};

export type HudRow = {
  id: string;
  alias: string;
  carName: string;
  color: string;
  player: boolean;
  position: number;
  laps: number;
  speed: number;
  displaySpeed: number;
  maxSpeed: number;
  displayMax: number;
  bestLap: number;
  overtakes: number;
  gap: number;
  x: number;
  z: number;
};

export type HudSnapshot = {
  phase: Sim["phase"];
  lights: number;
  raceTime: number;
  focusId: string;
  winnerId: string | null;
  alert: string | null;
  rows: HudRow[];
};

const ASPHALT = 6.7;
const WALL = 11.4;

function wrapAngle(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function paceOf(car: SimCar) {
  return car.top > 0 ? (car.speed / car.top) * car.vmax : 0;
}

function place(car: SimCar, track: Track) {
  const here = sampleAt(car.s, track);
  car.x = here.x + here.lx * car.offset;
  car.z = here.z + here.lz * car.offset;
  car.progress = car.laps * track.length + car.s;
}

export function createSim(racers: Racer[], mode: "drive" | "watch", track: Track = TRACK): Sim {
  const count = racers.length;
  const cars: SimCar[] = racers.map((racer, index) => {
    const spec = carById(racer.carId);
    const s = 12 + (count - 1 - index) * 6.6;
    const pose = sampleAt(s, track);
    const jitter = 0.97 + Math.random() * 0.06;
    return {
      id: racer.id,
      alias: racer.alias,
      carId: spec.id,
      carName: spec.name,
      color: racer.color,
      player: mode === "drive" && racer.player,
      top: spec.top * jitter,
      accel: spec.accel,
      grip: spec.grip,
      pace: 0.95 + Math.random() * 0.07,
      mistakeRate: 0.035 + (1 - spec.grip) * 0.05 + Math.random() * 0.02,
      turn: spec.turn,
      vmax: spec.vmax,
      wheel: 0,
      remote: false,
      phase: Math.random() * Math.PI * 2,
      s,
      laps: 0,
      offset: index % 2 === 0 ? 1.7 : -1.7,
      speed: 0,
      yaw: pose.yaw,
      x: 0,
      z: 0,
      progress: 0,
      finished: false,
      lapMark: 0,
      lapStartS: s,
      bestLap: Number.POSITIVE_INFINITY,
      maxSpeed: 0,
      displayMax: 0,
      overtakes: 0,
      rank: -1,
      lastPass: -10,
      mistakeT: 0,
      lapRun: 0,
    };
  });

  const sim: Sim = {
    mode,
    phase: "lights",
    lights: 1,
    clock: 0,
    raceTime: 0,
    winnerId: null,
    cars,
    track,
  };
  for (const car of cars) place(car, track);
  return sim;
}

export function applyRemote(
  sim: Sim,
  pose: { id: string; s: number; offset: number; speed: number; laps: number; yaw: number },
) {
  const car = sim.cars.find((item) => item.id === pose.id);
  if (!car || car.player) return;
  car.s = ((pose.s % sim.track.length) + sim.track.length) % sim.track.length;
  car.offset = Math.max(-WALL, Math.min(WALL, pose.offset));
  car.speed = Math.max(0, pose.speed);
  car.laps = pose.laps;
  car.yaw = pose.yaw;
  car.remote = true;
  if (car.laps >= LAPS) car.finished = true;
  car.maxSpeed = Math.max(car.maxSpeed, car.speed);
  car.displayMax = Math.max(car.displayMax, paceOf(car));
  place(car, sim.track);
}

function modDist(dist: number, length: number) {
  return ((dist % length) + length) % length;
}

function projectCar(car: SimCar, track: Track) {
  const samples = track.samples;
  const length = track.length;
  let bestI = 0;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i];
    let along = sample.dist - car.s;
    if (along > length * 0.5) along -= length;
    if (along < -length * 0.5) along += length;
    if (along < -16 || along > 64) continue;
    const dx = sample.x - car.x;
    const dz = sample.z - car.z;
    const d = dx * dx + dz * dz;
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  const sample = samples[bestI];
  const pose = sampleAt(sample.dist, track);
  const ox = car.x - pose.x;
  const oz = car.z - pose.z;
  return {
    s: modDist(sample.dist + ox * pose.tx + oz * pose.tz, length),
    offset: ox * pose.lx + oz * pose.lz,
    pose,
  };
}

function adoptTrack(sim: Sim, car: SimCar, nextS: number) {
  const length = sim.track.length;
  let ds = nextS - car.s;
  if (ds > length * 0.5) ds -= length;
  if (ds < -length * 0.5) ds += length;
  if (Math.abs(ds) > 48) return;
  if (ds > 0 && ds < 40 && car.s > length * 0.55 && nextS < length * 0.25) {
    const lapT = sim.raceTime - car.lapMark;
    if (car.lapRun > length * 0.72 && lapT > 4 && lapT < car.bestLap) car.bestLap = lapT;
    car.laps += 1;
    car.lapMark = sim.raceTime;
    car.lapRun = 0;
    if (car.laps >= LAPS) car.finished = true;
  }
  car.lapRun += Math.max(0, ds);
  car.s = nextS;
  car.progress = car.laps * length + car.s;
}

function pushBody(car: SimCar, steer: number, dt: number, gripScale: number) {
  const follow = 16 + car.turn * 10;
  car.wheel += (steer - car.wheel) * Math.min(1, follow * dt);
  const crawl = car.speed < 1.4 ? 0.75 : 1;
  const stability = 1 / (1 + Math.max(0, car.speed - 16) * 0.018);
  let yawRate = car.wheel * (0.72 + car.turn * 0.38) * crawl * stability;
  const maxLat = (18 + car.grip * 28) * gripScale;
  const lat = Math.abs(car.speed * yawRate);
  if (car.speed > 6 && lat > maxLat) {
    const scale = maxLat / lat;
    yawRate *= 0.4 + 0.6 * scale;
    car.speed -= (lat - maxLat) * 0.5 * dt;
  }
  car.yaw = wrapAngle(car.yaw + yawRate * dt);
  car.x += -Math.sin(car.yaw) * car.speed * dt;
  car.z += -Math.cos(car.yaw) * car.speed * dt;
}

export function stepSim(sim: Sim, dt: number, input: DriveInput) {
  if (sim.phase === "finished") return;

  if (sim.phase === "lights") {
    sim.clock += dt;
    if (sim.clock < 0.48) sim.lights = 1;
    else if (sim.clock < 0.96) sim.lights = 2;
    else if (sim.clock < 1.44) sim.lights = 3;
    else if (sim.clock < 1.82) sim.lights = 4;
    else sim.phase = "racing";
    return;
  }

  sim.raceTime += dt;

  for (const car of sim.cars) {
    if (car.finished || car.remote) continue;
    const here = sampleAt(car.s, sim.track);
    const ahead = sampleAt(car.s + 22, sim.track);
    const dYaw = wrapAngle(ahead.yaw - here.yaw);
    const curv = Math.abs(dYaw) / 22;
    let cap = car.top / (1 + curv * 70 * (1.28 - car.grip));
    const inside = Math.max(-3.2, Math.min(3.2, dYaw * 9));
    if (Math.abs(car.offset) > ASPHALT) cap *= 0.62;

    const human = car.player;
    let steer = 0;
    if (human) {
      steer = Math.max(-1, Math.min(1, input.steer));
      const brakePower = 34 + car.grip * 18;
      if (input.brake > 0) car.speed -= brakePower * input.brake * dt;
      else if (input.throttle > 0) {
        const pull = 1 - Math.min(0.82, car.speed / Math.max(1, car.top));
        car.speed += car.accel * input.throttle * (0.28 + pull) * dt;
      } else car.speed -= (3.2 + (1 - car.grip) * 2) * dt;
    } else {
      if (car.mistakeT > 0) car.mistakeT -= dt;
      else if (Math.random() < car.mistakeRate * dt) car.mistakeT = 0.32 + Math.random() * 0.45;
      const look = 11 + Math.min(18, car.speed * 0.42);
      const aim = sampleAt(car.s + look, sim.track);
      const tx = aim.x + aim.lx * inside * 0.55 - car.x;
      const tz = aim.z + aim.lz * inside * 0.55 - car.z;
      let desiredYaw = Math.atan2(-tx, -tz);
      if (car.mistakeT > 0) desiredYaw += 0.4 * Math.sign(Math.sin(car.phase) || 1);
      steer = Math.max(-1, Math.min(1, wrapAngle(desiredYaw - car.yaw) / 0.5));
      let desired = cap * car.pace;
      if (car.mistakeT > 0) desired *= 0.7;
      if (Math.abs(car.offset) > ASPHALT) desired *= 0.5;
      if (car.speed < desired) car.speed += car.accel * dt;
      else car.speed += (desired - car.speed) * Math.min(1, 3.2 * dt);
    }

    if (car.speed > car.top * 1.04) car.speed = car.top * 1.04;
    const gripScale = Math.abs(car.offset) > ASPHALT ? 0.42 : 1;
    pushBody(car, steer, dt, human ? gripScale : Math.max(1.25, gripScale));
    const hit = projectCar(car, sim.track);
    adoptTrack(sim, car, hit.s);
    car.offset = hit.offset;
    const off = Math.abs(car.offset) - ASPHALT;
    if (off > 0) {
      const grassCap = Math.max(9, 22 - off * 2.2);
      if (car.speed > grassCap) car.speed -= (car.speed - grassCap) * Math.min(1, 8 * dt);
      car.speed -= off * 5 * dt;
    }
    if (Math.abs(car.offset) > WALL) {
      const sign = Math.sign(car.offset) || 1;
      const shove = Math.abs(car.offset) - (WALL - 0.4);
      car.x -= hit.pose.lx * sign * shove;
      car.z -= hit.pose.lz * sign * shove;
      car.speed *= 0.72;
      const back = projectCar(car, sim.track);
      adoptTrack(sim, car, back.s);
      car.offset = back.offset;
    }
    if (car.speed < 0) car.speed = 0;
    car.maxSpeed = Math.max(car.maxSpeed, car.speed);
    car.displayMax = Math.max(car.displayMax, paceOf(car));
  }

  for (let i = 0; i < sim.cars.length; i += 1) {
    for (let j = i + 1; j < sim.cars.length; j += 1) {
      const a = sim.cars[i];
      const b = sim.cars[j];
      let dx = a.x - b.x;
      let dz = a.z - b.z;
      let dist = Math.hypot(dx, dz);
      const minDist = 2.05;
      if (dist >= minDist) continue;
      if (dist < 0.001) {
        dx = 1;
        dz = 0;
        dist = 1;
      }
      const push = (minDist - dist) * 0.55;
      const nx = dx / dist;
      const nz = dz / dist;
      if (!a.remote) {
        a.x += nx * push;
        a.z += nz * push;
      }
      if (!b.remote) {
        b.x -= nx * push;
        b.z -= nz * push;
      }
      const behind = a.progress >= b.progress ? b : a;
      if (!behind.remote) behind.speed = Math.max(0, behind.speed - 22 * dt);
    }
  }

  for (const car of sim.cars) {
    if (car.finished || car.remote) continue;
    const hit = projectCar(car, sim.track);
    adoptTrack(sim, car, hit.s);
    car.offset = hit.offset;
    for (const other of sim.cars) {
      if (other === car || other.finished) continue;
      const ahead = other.progress - car.progress;
      const close = Math.hypot(other.x - car.x, other.z - car.z);
      if (ahead > 1.4 && ahead < 10 && close < 3.4) {
        car.speed = Math.min(car.top * 1.04, car.speed + 3.2 * dt);
        break;
      }
    }
    car.maxSpeed = Math.max(car.maxSpeed, car.speed);
    car.displayMax = Math.max(car.displayMax, paceOf(car));
  }

  const order = [...sim.cars].sort((a, b) => b.progress - a.progress);
  for (let i = 0; i < order.length; i += 1) {
    const car = order[i];
    if (car.rank >= 0 && i < car.rank && sim.raceTime - car.lastPass > 0.75) {
      car.overtakes += car.rank - i;
      car.lastPass = sim.raceTime;
    }
    car.rank = i;
  }

  if (order[0] && order[0].laps >= LAPS) {
    sim.phase = "finished";
    sim.winnerId = order[0].id;
  }
}

export function snapshot(sim: Sim, focusId: string | null): HudSnapshot {
  const order = [...sim.cars].sort((a, b) => b.progress - a.progress);
  const leader = order[0];
  const focus = sim.cars.find((car) => car.id === focusId) ?? leader;
  let alert: string | null = null;
  if (sim.phase === "racing" && focus?.player && !focus.finished) {
    const soon = sampleAt(focus.s + 28, sim.track);
    const turn = wrapAngle(soon.yaw - focus.yaw);
    const into = Math.sign(turn) === Math.sign(focus.wheel) && Math.abs(focus.wheel) > 0.4;
    if (Math.abs(focus.offset) > ASPHALT + 0.8) alert = "FUERA DE PISTA";
    else if (!into && focus.speed > 26 && Math.abs(turn) > 0.48) alert = "FRENÁ";
    else if (!into && focus.speed > 12 && Math.abs(turn) > 0.34 && Math.abs(focus.wheel) < 0.22) alert = "DOBLÁ";
  }
  return {
    phase: sim.phase,
    lights: sim.lights,
    raceTime: sim.raceTime,
    focusId: focus?.id ?? "",
    winnerId: sim.winnerId,
    alert,
    rows: order.map((car, index) => ({
      id: car.id,
      alias: car.alias,
      carName: car.carName,
      color: car.color,
      player: car.player,
      position: index + 1,
      laps: car.laps,
      speed: car.speed,
      displaySpeed: paceOf(car),
      maxSpeed: car.maxSpeed,
      displayMax: car.displayMax,
      bestLap: car.bestLap,
      overtakes: car.overtakes,
      gap: leader ? (leader.progress - car.progress) / Math.max(10, car.speed) : 0,
      x: car.x,
      z: car.z,
    })),
  };
}
