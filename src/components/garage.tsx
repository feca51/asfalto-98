import { ChevronDown, ChevronUp, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { CarPreview } from "@/components/car-preview";
import { CARS, LIVERIES, MAX_RACERS, carById, statBars, type Racer } from "@/game/catalog";
import { DEFAULT_RACERS, freshAlias, freshCar, freshColor, loadGrid, loadTrackId, saveGrid, saveTrackId } from "@/game/storage";
import { CIRCUITS, outlineOf, trackById, type Track } from "@/game/track";

type Props = {
  onDrive: (racers: Racer[], trackId: string) => void;
  onWatch: (racers: Racer[], trackId: string) => void;
};

export function Garage({ onDrive, onWatch }: Props) {
  const [racers, setRacers] = useState<Racer[]>(DEFAULT_RACERS);
  const [selectedId, setSelectedId] = useState(DEFAULT_RACERS[0].id);
  const [trackId, setTrackId] = useState(CIRCUITS[0].id);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = loadGrid();
    if (saved) {
      setRacers(saved);
      setSelectedId(saved[0]?.id ?? DEFAULT_RACERS[0].id);
    }
    setTrackId(loadTrackId());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) saveGrid(racers);
  }, [racers, ready]);

  useEffect(() => {
    if (ready) saveTrackId(trackId);
  }, [trackId, ready]);

  const selected = racers.find((racer) => racer.id === selectedId) ?? racers[0];
  const car = selected ? carById(selected.carId) : CARS[0];
  const bars = statBars(car);

  function patch(id: string, partial: Partial<Racer>) {
    setRacers((current) => current.map((racer) => (racer.id === id ? { ...racer, ...partial } : racer)));
  }

  function addRacer() {
    if (racers.length >= MAX_RACERS) return;
    const racer: Racer = {
      id: crypto.randomUUID(),
      alias: freshAlias(racers),
      carId: freshCar(racers),
      color: freshColor(racers),
      player: false,
    };
    setRacers((current) => [...current, racer]);
    setSelectedId(racer.id);
  }

  function removeRacer(id: string) {
    setRacers((current) => {
      const next = current.filter((racer) => racer.id !== id);
      setSelectedId((prev) => (prev === id ? (next[0]?.id ?? "") : prev));
      return next;
    });
  }

  function move(id: string, dir: -1 | 1) {
    setRacers((current) => {
      const index = current.findIndex((racer) => racer.id === id);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = current.slice();
      const [row] = next.splice(index, 1);
      next.splice(target, 0, row);
      return next;
    });
  }

  function markPlayer(id: string) {
    setRacers((current) =>
      current.map((racer) => ({
        ...racer,
        player: racer.id === id ? !racer.player : false,
      })),
    );
  }

  const canStart = racers.length >= 2;
  const circuit = trackById(trackId);
  const startLine = (rows: Racer[]) => rows.map((racer) => ({ ...racer, alias: racer.alias.trim() || "PILOTO" }));

  return (
    <main className="mx-auto flex h-dvh w-full max-w-lg flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-5">
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-widest text-gold">GRILLA</p>
          <h1 className="font-display text-3xl font-bold leading-none text-cream">ASFALTO '98</h1>
        </div>
        <p className="font-mono text-xs text-mist">
          {racers.length}/{MAX_RACERS}
        </p>
      </header>

      {selected ? (
        <>
          <CarPreview carId={selected.carId} color={selected.color} />
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold text-cream">{car.name}</h2>
              <p className="text-xs text-mist">{car.klass}</p>
            </div>
            <p className="max-w-40 text-right text-xs leading-snug text-mist">{car.blurb}</p>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <Bar label="VEL" value={bars.vel} />
            <Bar label="ACEL" value={bars.acel} />
            <Bar label="AGARRE" value={bars.agarre} />
          </div>

          <label className="mt-4 block text-xs text-mist" htmlFor="alias">
            Alias
          </label>
          <input
            id="alias"
            value={selected.alias}
            maxLength={14}
            autoComplete="off"
            onChange={(event) => patch(selected.id, { alias: event.target.value.toUpperCase() })}
            className="mt-1 h-12 w-full border border-line bg-panel px-3 font-display text-lg text-cream outline-none focus:border-gold"
          />

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {CARS.map((option) => {
              const on = option.id === selected.carId;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => patch(selected.id, { carId: option.id })}
                  className={
                    "h-11 shrink-0 border px-3 font-display text-sm " +
                    (on ? "border-gold bg-gold text-asphalt" : "border-line bg-panel text-cream")
                  }
                >
                  {option.name}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex gap-2">
            {LIVERIES.map((paint) => {
              const on = paint.hex.toLowerCase() === selected.color.toLowerCase();
              return (
                <button
                  key={paint.id}
                  type="button"
                  aria-label={paint.name}
                  onClick={() => patch(selected.id, { color: paint.hex })}
                  className={"h-11 w-11 border-2 " + (on ? "border-cream" : "border-transparent")}
                  style={{ background: paint.hex }}
                />
              );
            })}
          </div>
        </>
      ) : (
        <p className="border border-line bg-panel px-4 py-8 text-center text-sm text-mist">
          La grilla está vacía. Sumá pilotos para largar.
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-2">
        {racers.map((racer, index) => {
          const spec = carById(racer.carId);
          const on = racer.id === selected?.id;
          return (
            <li key={racer.id} className={"border px-3 py-2 " + (on ? "border-gold bg-panel" : "border-line")}>
              <button type="button" onClick={() => setSelectedId(racer.id)} className="flex w-full items-center gap-3 text-left">
                <span className="w-5 font-mono text-xs text-mist">{index + 1}</span>
                <span className="h-8 w-3 shrink-0" style={{ background: racer.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-base text-cream">{racer.alias || "—"}</span>
                  <span className="block truncate text-xs text-mist">
                    {spec.name}
                    {racer.player ? " · YO" : ""}
                  </span>
                </span>
              </button>
              <div className="mt-2 flex gap-2">
                <button type="button" aria-label="Subir en la grilla" onClick={() => move(racer.id, -1)} className="grid h-11 w-11 place-items-center border border-line text-cream">
                  <ChevronUp className="size-5" />
                </button>
                <button type="button" aria-label="Bajar en la grilla" onClick={() => move(racer.id, 1)} className="grid h-11 w-11 place-items-center border border-line text-cream">
                  <ChevronDown className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => markPlayer(racer.id)}
                  className={"h-11 flex-1 font-display text-sm " + (racer.player ? "bg-gold text-asphalt" : "border border-line text-cream")}
                >
                  {racer.player ? "MANEJÁS VOS" : "MARCAR YO"}
                </button>
                <button type="button" aria-label={`Sacar a ${racer.alias}`} onClick={() => removeRacer(racer.id)} className="grid h-11 w-11 place-items-center border border-line text-signal">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={addRacer}
          disabled={racers.length >= MAX_RACERS}
          className="flex h-12 flex-1 items-center justify-center gap-2 border border-line bg-panel font-display text-cream"
        >
          <Plus className="size-4" />
          Corredor
        </button>
        <button
          type="button"
          onClick={() => {
            setRacers(DEFAULT_RACERS);
            setSelectedId(DEFAULT_RACERS[0].id);
          }}
          className="flex h-12 items-center gap-2 border border-line px-3 text-sm text-mist"
        >
          <RotateCcw className="size-4" />
          Demo
        </button>
      </div>

      </div>

      <div className="safe-b border-t border-line bg-asphalt px-4 pt-3">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="font-mono text-xs tracking-widest text-gold">PISTA</p>
          <p className="text-xs text-mist">
            {CIRCUITS.length} circuitos · {circuit.level}
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CIRCUITS.map((option) => {
            const on = option.id === circuit.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={on}
                onClick={() => setTrackId(option.id)}
                className={
                  "w-24 shrink-0 border px-1.5 py-1.5 " +
                  (on ? "border-gold bg-panel text-gold" : "border-line text-mist")
                }
              >
                <TrackGlyph track={option.track} />
                <span className="mt-1 block truncate text-center font-display text-xs text-cream">{option.name}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 truncate text-xs text-mist">
          {circuit.name} · {Math.round(circuit.track.length)} m · {circuit.blurb}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!canStart}
          onClick={() => onDrive(startLine(racers), circuit.id)}
          className="h-14 bg-gold font-display text-base font-bold text-asphalt"
        >
          MANEJAR
        </button>
        <button
          type="button"
          disabled={!canStart}
          onClick={() => onWatch(startLine(racers), circuit.id)}
          className="h-14 border border-gold font-display text-base font-bold text-gold"
        >
          VER COPA
        </button>
        {!canStart ? <p className="col-span-2 text-center text-xs text-mist">Sumá al menos dos pilotos.</p> : null}
        {canStart ? (
          <p className="col-span-2 text-center text-xs text-mist">
            Deslizá para ver todas las pistas. YO maneja. Ver copa corre sola.
          </p>
        ) : null}
        </div>
      </div>
    </main>
  );
}

function TrackGlyph({ track }: { track: Track }) {
  const pts = outlineOf(track, 4);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const point of pts) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }
  const width = 88;
  const height = 52;
  const pad = 4;
  const sx = (x: number) => pad + ((x - minX) / Math.max(1, maxX - minX)) * (width - pad * 2);
  const sy = (z: number) => pad + (1 - (z - minZ) / Math.max(1, maxZ - minZ)) * (height - pad * 2);
  const d =
    pts.map((point, index) => `${index === 0 ? "M" : "L"}${sx(point.x).toFixed(1)} ${sy(point.z).toFixed(1)}`).join(" ") +
    " Z";
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-full">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  const width = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-xs text-mist">{label}</span>
      <span className="h-2 flex-1 bg-line">
        <span className="block h-full bg-gold" style={{ width }} />
      </span>
    </div>
  );
}
