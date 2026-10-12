export type CarDef = {
  id: string;
  name: string;
  klass: string;
  top: number;
  accel: number;
  grip: number;
  blurb: string;
};

export type Racer = {
  id: string;
  alias: string;
  carId: string;
  color: string;
  player: boolean;
};

export const LAPS = 3;
export const MAX_RACERS = 10;

export const CARS: CarDef[] = [
  {
    id: "velonce",
    name: "Velonce",
    klass: "Cuña",
    top: 64,
    accel: 18,
    grip: 0.7,
    blurb: "Punta en las rectas. Se abre en la curva.",
  },
  {
    id: "nite",
    name: "Nite RX",
    klass: "Coupé",
    top: 56,
    accel: 23,
    grip: 0.84,
    blurb: "Sale rápido y no se asusta del ápice.",
  },
  {
    id: "kuro",
    name: "Kuro",
    klass: "Rally",
    top: 51,
    accel: 21,
    grip: 0.96,
    blurb: "El que frena más tarde y sale pegado.",
  },
  {
    id: "alba",
    name: "Alba",
    klass: "Proto",
    top: 66,
    accel: 16,
    grip: 0.76,
    blurb: "Ala grande, mucha punta, poco torque.",
  },
  {
    id: "thunder",
    name: "Thunder 8",
    klass: "Muscle",
    top: 58,
    accel: 26,
    grip: 0.62,
    blurb: "Empuja como un camión. Odia el curvón.",
  },
  {
    id: "lumen",
    name: "Lumen S",
    klass: "Super",
    top: 61,
    accel: 20,
    grip: 0.88,
    blurb: "Equilibrado. Gana si nadie se equivoca.",
  },
];

export const LIVERIES: { id: string; name: string; hex: string }[] = [
  { id: "rojo", name: "Rojo", hex: "#e23d3d" },
  { id: "ambar", name: "Ámbar", hex: "#ffb703" },
  { id: "crema", name: "Crema", hex: "#efe6d2" },
  { id: "cian", name: "Cian", hex: "#3ec6d6" },
  { id: "verde", name: "Verde", hex: "#3ddc7a" },
];

const byId = new Map(CARS.map((car) => [car.id, car]));

export function carById(id: string): CarDef {
  return byId.get(id) ?? CARS[0];
}

export function statBars(car: CarDef) {
  return {
    vel: car.top / 66,
    acel: car.accel / 26,
    agarre: car.grip,
  };
}

export const DEFAULT_RACERS: Racer[] = [
  { id: "r1", alias: "VOS", carId: "velonce", color: "#e23d3d", player: true },
  { id: "r2", alias: "NITO", carId: "nite", color: "#3ec6d6", player: false },
  { id: "r3", alias: "LILA", carId: "kuro", color: "#efe6d2", player: false },
  { id: "r4", alias: "KENZO", carId: "alba", color: "#ffb703", player: false },
];

export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0 || sec > 600) return "—";
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  const whole = Math.floor(s);
  const cs = Math.floor((s - whole) * 100);
  const tail = `${whole}.${String(cs).padStart(2, "0")}`;
  return m > 0 ? `${m}:${String(whole).padStart(2, "0")}.${String(cs).padStart(2, "0")}` : tail;
}

export function kmh(speed: number): number {
  return Math.max(0, Math.round(speed * 3.6));
}
