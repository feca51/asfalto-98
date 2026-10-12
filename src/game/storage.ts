import { CARS, DEFAULT_RACERS, LIVERIES, MAX_RACERS, type Racer } from "@/game/catalog";
import { trackById } from "@/game/track";

const KEY = "asfalto98-grid-v1";
const TRACK_KEY = "asfalto98-track-v1";

function isRacer(value: unknown): value is Racer {
  if (!value || typeof value !== "object") return false;
  const row = value as Racer;
  return (
    typeof row.id === "string" &&
    typeof row.alias === "string" &&
    typeof row.carId === "string" &&
    CARS.some((car) => car.id === row.carId) &&
    typeof row.color === "string" &&
    typeof row.player === "boolean"
  );
}

export function loadGrid(): Racer[] | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: number; racers?: unknown };
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.racers)) return null;
    const racers = parsed.racers.filter(isRacer).slice(0, MAX_RACERS);
    if (racers.length < 2) return null;
    let playerSeen = false;
    return racers.map((racer) => {
      const player = racer.player && !playerSeen;
      if (player) playerSeen = true;
      return {
        ...racer,
        alias: racer.alias.trim().slice(0, 14) || "PILOTO",
        player,
      };
    });
  } catch {
    return null;
  }
}

export function saveGrid(racers: Racer[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, racers }));
  } catch {
    /* ignore quota */
  }
}

export function loadTrackId(): string {
  try {
    const id = localStorage.getItem(TRACK_KEY);
    if (id && trackById(id).id === id) return id;
  } catch {
    /* ignore */
  }
  return trackById("").id;
}

export function saveTrackId(id: string) {
  try {
    localStorage.setItem(TRACK_KEY, trackById(id).id);
  } catch {
    /* ignore quota */
  }
}

export function freshAlias(racers: Racer[]): string {
  const used = new Set(racers.map((racer) => racer.alias.toUpperCase()));
  for (let n = racers.length + 1; n < 40; n += 1) {
    const name = `PILOTO ${n}`;
    if (!used.has(name)) return name;
  }
  return "PILOTO";
}

export function freshColor(racers: Racer[]): string {
  const used = new Set(racers.map((racer) => racer.color.toLowerCase()));
  const free = LIVERIES.find((paint) => !used.has(paint.hex.toLowerCase()));
  return free?.hex ?? LIVERIES[racers.length % LIVERIES.length].hex;
}

export function freshCar(racers: Racer[]): string {
  const used = new Set(racers.map((racer) => racer.carId));
  return CARS.find((car) => !used.has(car.id))?.id ?? CARS[racers.length % CARS.length].id;
}

export { DEFAULT_RACERS };
