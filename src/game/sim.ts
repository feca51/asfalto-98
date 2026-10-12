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
  overtakes: number;
  rank: number;
  lastPass: number;
  mistakeT: number;
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
  maxSpeed: number;
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
  rows: HudRow[];
};

const ROAD_LIMIT = 6.55;

function wrapAngle(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function dampAngle(current: number, target: number, dt: number, lambda: number) {
  const diff = wrapAngle(target - current);
  return current + diff * (1 - Math.exp(-lambda * dt));
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
      overtakes: 0,
      rank: -1,
      lastPass: -10,
      mistakeT: 0,
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
  const length = sim.track.length;

  for (const car of sim.cars) {
    if (car.finished) continue;
    const here = sampleAt(car.s, sim.track);
    const ahead = sampleAt(car.s + 24, sim.track);
    const dYaw = wrapAngle(ahead.yaw - here.yaw);
    const curv = Math.abs(dYaw) / 24;
    let cap = car.top / (1 + curv * 62 * (1.25 - car.grip));
    const inside = Math.max(-3.3, Math.min(3.3, dYaw * 8));
    cap *= 1 - Math.min(0.2, Math.abs(car.offset - inside) * 0.045);
    if (Math.abs(car.offset) > 5.35) cap *= 0.55;

    const human = car.player;
    let steer = 0;
    if (human) {
      steer = Math.max(-1, Math.min(1, input.steer));
      const rate = 12 * Math.min(1, Math.max(0.22, car.speed / 18));
      car.offset += steer * rate * dt;
      if (input.brake > 0) car.speed -= 34 * dt;
      else if (input.throttle > 0) car.speed += car.accel * input.throttle * dt;
      else car.speed -= 8 * dt;
      if (car.speed > cap) car.speed -= (car.speed - cap) * Math.min(1, 3.4 * dt);
    } else {
      if (car.mistakeT > 0) car.mistakeT -= dt;
      else if (Math.random() < car.mistakeRate * dt) car.mistakeT = 0.28 + Math.random() * 0.4;
      const target =
        inside +
        Math.sin(sim.raceTime * 0.65 + car.phase) * 0.4 +
        (car.mistakeT > 0 ? 2.6 * Math.sign(Math.sin(car.phase) || 1) : 0);
      const err = target - car.offset;
      steer = Math.max(-1, Math.min(1, err * 0.5));
      car.offset += steer * 11 * dt;
      let desired = cap * car.pace;
      if (car.mistakeT > 0) desired *= 0.7;
      if (car.speed < desired) car.speed += car.accel * dt;
      else car.speed += (desired - car.speed) * Math.min(1, 3.5 * dt);
    }

    if (car.speed < 0) car.speed = 0;
    if (car.speed > car.top * 1.08) car.speed = car.top * 1.08;
    car.offset = Math.max(-ROAD_LIMIT, Math.min(ROAD_LIMIT, car.offset));

    const prevS = car.s;
    car.s += car.speed * dt;
    if (car.s >= length) {
      const traveled = length - car.lapStartS;
      const lapT = sim.raceTime - car.lapMark;
      car.s -= length;
      car.laps += 1;
      if (traveled > length * 0.9 && lapT > 4 && lapT < car.bestLap) car.bestLap = lapT;
      car.lapMark = sim.raceTime;
      car.lapStartS = 0;
      if (car.laps >= LAPS) car.finished = true;
    } else if (car.s < prevS) {
      car.s = prevS;
    }

    car.yaw = dampAngle(car.yaw, here.yaw + steer * 0.7, dt, 7);
    car.maxSpeed = Math.max(car.maxSpeed, car.speed);
  }

  for (const car of sim.cars) place(car, sim.track);

  for (const car of sim.cars) {
    if (car.finished) continue;
    for (const other of sim.cars) {
      if (other === car) continue;
      const ahead = other.progress - car.progress;
      if (ahead > 1.2 && ahead < 9 && Math.abs(other.offset - car.offset) < 2.1) {
        car.speed = Math.min(car.top * 1.08, car.speed + 4 * dt);
        break;
      }
    }
  }

  for (let i = 0; i < sim.cars.length; i += 1) {
    for (let j = i + 1; j < sim.cars.length; j += 1) {
      const a = sim.cars[i];
      const b = sim.cars[j];
      const dp = a.progress - b.progress;
      const side = a.offset - b.offset;
      if (Math.abs(dp) < 4.2 && Math.abs(side) < 1.8) {
        const overlap = 1.8 - Math.abs(side);
        const sign = side === 0 ? 1 : Math.sign(side);
        a.offset += sign * overlap * 0.22;
        b.offset -= sign * overlap * 0.22;
        const behind = dp >= 0 ? b : a;
        behind.speed = Math.max(0, behind.speed - 18 * dt);
      }
    }
  }

  for (const car of sim.cars) {
    car.offset = Math.max(-ROAD_LIMIT, Math.min(ROAD_LIMIT, car.offset));
    place(car, sim.track);
    car.maxSpeed = Math.max(car.maxSpeed, car.speed);
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
  return {
    phase: sim.phase,
    lights: sim.lights,
    raceTime: sim.raceTime,
    focusId: focus?.id ?? "",
    winnerId: sim.winnerId,
    rows: order.map((car, index) => ({
      id: car.id,
      alias: car.alias,
      carName: car.carName,
      color: car.color,
      player: car.player,
      position: index + 1,
      laps: car.laps,
      speed: car.speed,
      maxSpeed: car.maxSpeed,
      bestLap: car.bestLap,
      overtakes: car.overtakes,
      gap: leader ? (leader.progress - car.progress) / Math.max(10, car.speed) : 0,
      x: car.x,
      z: car.z,
    })),
  };
}
