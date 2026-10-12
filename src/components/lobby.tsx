import { useState } from "react";
import {
  CARS,
  KLASS_LABEL,
  KLASS_ORDER,
  LIVERIES,
  carById,
  carsIn,
  ficha,
  type Klass,
  type Racer,
} from "@/game/catalog";
import { CIRCUITS, trackById } from "@/game/track";
import type { PeerInfo } from "@/lib/multiplayer";

export type Seat = { alias: string; carId: string; color: string };

type Props = {
  code: string;
  selfId: string;
  host: boolean;
  alias: string;
  peers: PeerInfo[];
  seats: Record<string, Seat>;
  trackId: string;
  onAlias: (alias: string) => void;
  onSeat: (seat: Seat) => void;
  onTrack: (id: string) => void;
  onStart: (racers: Racer[]) => void;
  onLeave: () => void;
};

export function Lobby({
  code,
  selfId,
  host,
  alias,
  peers,
  seats,
  trackId,
  onAlias,
  onSeat,
  onTrack,
  onStart,
  onLeave,
}: Props) {
  const [klass, setKlass] = useState<Klass>(carById(CARS[0].id).klass);
  const mine = seats[selfId] ?? { alias, carId: CARS[0].id, color: LIVERIES[0].hex };
  const car = carById(mine.carId);
  const circuit = trackById(trackId);
  const roster = [
    { id: selfId, name: mine.alias || "VOS", state: "vos" },
    ...peers.map((peer) => ({
      id: peer.id,
      name: seats[peer.id]?.alias || peer.name || "PILOTO",
      state: peer.connectionState,
    })),
  ];

  function start() {
    const racers: Racer[] = roster.map((peer) => {
      const seat = peer.id === selfId ? mine : (seats[peer.id] ?? { alias: peer.name, carId: CARS[0].id, color: LIVERIES[1].hex });
      return {
        id: peer.id,
        alias: (seat.alias || "PILOTO").slice(0, 14),
        carId: carById(seat.carId).id,
        color: seat.color,
        player: false,
      };
    });
    onStart(racers);
  }

  return (
    <main className="mx-auto flex h-dvh w-full max-w-lg flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-5">
        <header className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs tracking-widest text-gold">SALA {code}</p>
            <h1 className="font-display text-3xl font-bold leading-none text-cream">LOBBY</h1>
          </div>
          <button type="button" onClick={onLeave} className="h-11 px-3 text-xs text-mist">
            Menú
          </button>
        </header>
        <p className="text-xs text-mist">
          {host ? "Vos largás. Pasale el código a los demás." : "Esperá a que el anfitrión largue. Cada uno maneja el suyo."}
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          {roster.map((peer) => {
            const seat = peer.id === selfId ? mine : seats[peer.id];
            const spec = carById(seat?.carId ?? CARS[0].id);
            return (
              <li key={peer.id} className="flex items-center gap-3 border border-line px-3 py-2">
                <span className="h-8 w-3 shrink-0" style={{ background: seat?.color ?? LIVERIES[0].hex }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-base text-cream">{peer.name}</span>
                  <span className="block truncate text-xs text-mist">
                    {spec.name}
                    {peer.id === selfId ? " · VOS" : peer.state === "connected" ? "" : ` · ${peer.state}`}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <label className="mt-4 block text-xs text-mist" htmlFor="lobby-alias">
          Tu alias
        </label>
        <input
          id="lobby-alias"
          value={alias}
          maxLength={14}
          autoComplete="off"
          onChange={(event) => onAlias(event.target.value.toUpperCase())}
          className="mt-1 h-12 w-full border border-line bg-panel px-3 font-display text-lg text-cream outline-none focus:border-gold"
        />
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {KLASS_ORDER.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setKlass(option)}
              className={
                "h-11 shrink-0 border px-3 font-display text-sm " +
                (option === klass ? "border-gold bg-gold text-asphalt" : "border-line bg-panel text-cream")
              }
            >
              {KLASS_LABEL[option]}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {carsIn(klass).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onSeat({ ...mine, alias, carId: option.id })}
              className={
                "h-11 shrink-0 border px-3 font-display text-sm " +
                (option.id === mine.carId ? "border-gold bg-gold text-asphalt" : "border-line bg-panel text-cream")
              }
            >
              {option.name}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          {LIVERIES.map((paint) => (
            <button
              key={paint.id}
              type="button"
              aria-label={paint.name}
              onClick={() => onSeat({ ...mine, alias, color: paint.hex })}
              className={"h-11 w-11 border-2 " + (paint.hex === mine.color ? "border-cream" : "border-transparent")}
              style={{ background: paint.hex }}
            />
          ))}
        </div>
        <p className="mt-2 font-mono text-xs text-gold">{ficha(car)}</p>
        {host ? (
          <>
            <p className="mt-4 font-mono text-xs tracking-widest text-gold">PISTA</p>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {CIRCUITS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onTrack(option.id)}
                  className={
                    "h-11 shrink-0 border px-3 font-display text-sm " +
                    (option.id === circuit.id ? "border-gold bg-gold text-asphalt" : "border-line bg-panel text-cream")
                  }
                >
                  {option.name}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-mist">{circuit.blurb}</p>
          </>
        ) : (
          <p className="mt-4 text-sm text-cream">Pista: {circuit.name}</p>
        )}
      </div>
      <div className="safe-b border-t border-line bg-asphalt px-4 pt-3">
        {host ? (
          <button type="button" onClick={start} className="h-14 w-full bg-gold font-display text-base font-bold text-asphalt">
            LARGAR
          </button>
        ) : (
          <p className="pb-2 text-center text-xs text-mist">Cuando largue, corrés con el vehículo que elegiste.</p>
        )}
      </div>
    </main>
  );
}
