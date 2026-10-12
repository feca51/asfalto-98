export type Klass = "auto" | "util" | "moto" | "ev" | "tito" | "mono" | "tuk";

export type CarDef = {
  id: string;
  name: string;
  klass: Klass;
  klassLabel: string;
  vmax: number;
  zero: number;
  peso: number;
  top: number;
  accel: number;
  grip: number;
  turn: number;
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
export const MAX_RACERS = 8;

export const KLASS_ORDER: Klass[] = ["auto", "util", "moto", "ev", "tito", "mono", "tuk"];

export const KLASS_LABEL: Record<Klass, string> = {
  auto: "Autos",
  util: "Utilitarios",
  moto: "Motos",
  ev: "Eléctricos",
  tito: "Titos",
  mono: "Monopatines",
  tuk: "Tuk-tuk",
};

const TURN: Record<Klass, number> = {
  auto: 1,
  util: 0.68,
  moto: 1.42,
  ev: 1.08,
  tito: 1.28,
  mono: 1.62,
  tuk: 0.6,
};

const GRIP: Record<Klass, number> = {
  auto: 0.8,
  util: 0.56,
  moto: 0.93,
  ev: 0.86,
  tito: 0.72,
  mono: 0.5,
  tuk: 0.52,
};

function ride(klass: Klass, vmax: number, zero: number) {
  const top = 14 + (vmax / 270) * 50;
  const accel = klass === "ev" ? 30 : klass === "moto" ? 27 : Math.max(9, 34 - zero * 1.4);
  return { top, accel, grip: GRIP[klass], turn: TURN[klass] };
}

function spec(
  id: string,
  name: string,
  klass: Klass,
  vmax: number,
  zero: number,
  peso: number,
  blurb: string,
): CarDef {
  return {
    id,
    name,
    klass,
    klassLabel: KLASS_LABEL[klass],
    vmax,
    zero,
    peso,
    blurb,
    ...ride(klass, vmax, zero),
  };
}

export const CARS: CarDef[] = [
  spec("calle", "Calle 1.6", "auto", 185, 9.6, 1140, "Sedán de calle. Frená y doblá, no lo tires."),
  spec("cupe", "Cupé 3.0", "auto", 262, 4.8, 1520, "Punta de verdad. Se abre si entrás pasado."),
  spec("furgon", "Furgón", "util", 148, 14.8, 1980, "Alto y pesado. La curva hay que pedirla antes."),
  spec("pickup", "Pickup", "util", 172, 11.4, 2140, "Trocha ancha. Aguanta, pero no gira."),
  spec("naked", "Naked", "moto", 228, 3.3, 189, "Sale como un tiro y se acuesta en el ápice."),
  spec("scooter", "Scooter", "moto", 105, 9.8, 132, "Liviana. Enrosca, no alcanza en la recta."),
  spec("sedan-ev", "Sedán EV", "ev", 201, 4.4, 1890, "Torque desde cero. Pesa, pero pega."),
  spec("city-ev", "City EV", "ev", 150, 7.2, 1420, "Ciudad. Empuja ya y se queda sin punta."),
  spec("tito", "Tito", "tito", 45, 18, 380, "El micro de vereda. 45 km/h y a rezar."),
  spec("tito-plus", "Tito Plus", "tito", 65, 14, 450, "Un poco más de batería. Sigue siendo un Tito."),
  spec("mono", "Monopatín", "mono", 25, 22, 12, "25 km/h reales. En Monza es una declaración."),
  spec("mono-pro", "Monopatín Pro", "mono", 35, 16, 16, "Rueda grande. Igual no es un auto."),
  spec("tuk", "Tuk-tuk", "tuk", 70, 16, 420, "Tres ruedas. Se abre y no perdona."),
  spec("tuk-d", "Tuk diésel", "tuk", 85, 13.5, 560, "El de motor. Un poco más, igual baila."),
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

export function carsIn(klass: Klass): CarDef[] {
  return CARS.filter((car) => car.klass === klass);
}

export function statBars(car: CarDef) {
  return {
    vel: car.vmax / 270,
    acel: Math.min(1, car.accel / 32),
    agarre: car.grip,
  };
}

export function ficha(car: CarDef): string {
  const sprint = car.zero >= 16 ? "no llega a 100" : `0-100 ${car.zero.toFixed(1)} s`;
  return `${car.vmax} km/h · ${sprint} · ${car.peso} kg`;
}

export const DEFAULT_RACERS: Racer[] = [
  { id: "r1", alias: "VOS", carId: "calle", color: "#e23d3d", player: true },
  { id: "r2", alias: "NITO", carId: "naked", color: "#3ec6d6", player: false },
  { id: "r3", alias: "LILA", carId: "sedan-ev", color: "#efe6d2", player: false },
  { id: "r4", alias: "KENZO", carId: "furgon", color: "#ffb703", player: false },
];

export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0 || sec > 900) return "—";
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  const whole = Math.floor(s);
  const cs = Math.floor((s - whole) * 100);
  const tail = `${whole}.${String(cs).padStart(2, "0")}`;
  return m > 0 ? `${m}:${String(whole).padStart(2, "0")}.${String(cs).padStart(2, "0")}` : tail;
}

export function paceKmh(speed: number, top: number, vmax: number): number {
  if (top <= 0) return 0;
  return Math.max(0, Math.round((speed / top) * vmax));
}
