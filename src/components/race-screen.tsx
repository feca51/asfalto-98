import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LAPS, formatTime, kmh, type Racer } from "@/game/catalog";
import { isMuted, playFanfare, setMuted, unlockAudio } from "@/game/audio";
import type { TouchPad } from "@/game/input";
import type { HudSnapshot } from "@/game/sim";
import { outlineOf, trackById } from "@/game/track";

type Props = {
  racers: Racer[];
  mode: "drive" | "watch";
  trackId: string;
  onExit: () => void;
  onAgain: () => void;
};

const emptyTouch = (): TouchPad => ({ left: false, right: false, gas: false, brake: false });

export function RaceScreen({ racers, mode, trackId, onExit, onAgain }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const touch = useRef<TouchPad>(emptyTouch());
  const watchId = useRef<string | null>(null);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [muted, setMutedUi] = useState(isMuted());
  const circuit = trackById(trackId);
  const outline = outlineOf(circuit.track);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dead = false;
    let destroy = () => {};
    void import("@/game/engine").then((mod) => {
      if (dead || !canvasRef.current) return;
      const handle = mod.mountRace(canvasRef.current, {
        racers,
        mode,
        trackId,
        touch,
        watchId,
        onHud: (next) => {
          if (!dead) setHud(next);
        },
      });
      destroy = () => handle.destroy();
    });
    const onHide = () => {
      if (document.visibilityState === "visible") {
        void import("@/game/audio").then((audio) => audio.resumeAudio());
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      dead = true;
      destroy();
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [racers, mode, trackId]);

  const focus = hud?.rows.find((row) => row.id === hud.focusId) ?? hud?.rows[0];
  const winner = hud?.rows.find((row) => row.id === hud.winnerId) ?? null;
  const you = hud?.rows.find((row) => row.player);
  const showLap = focus ? Math.min(LAPS, focus.laps + (hud?.phase === "finished" && focus.laps >= LAPS ? 0 : 1)) : 1;

  function hold(key: keyof TouchPad, down: boolean) {
    touch.current = { ...touch.current, [key]: down };
  }

  function toggleMute() {
    unlockAudio();
    const next = !isMuted();
    setMuted(next);
    setMutedUi(next);
  }

  return (
    <main className="race-root relative h-dvh w-full overflow-hidden bg-asphalt text-cream">
      <canvas ref={canvasRef} className="ps1 absolute inset-0 h-full w-full" />
      <div className="crt pointer-events-none absolute inset-0" />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3">
        <div className="bg-asphalt/80 px-3 py-2">
          <p className="font-display text-4xl font-bold leading-none text-gold">{focus ? `${focus.position}º` : "—"}</p>
          <p className="mt-1 font-mono text-xs text-mist">
            VUELTA {showLap}/{LAPS}
          </p>
          <p className="font-mono text-xs text-gold">{circuit.name}</p>
        </div>
        <div className="bg-asphalt/80 px-3 py-2 text-right">
          <p className="font-display text-4xl font-bold leading-none">{focus ? kmh(focus.speed) : 0}</p>
          <p className="font-mono text-xs text-mist">KM/H</p>
        </div>
      </header>

      <div className="absolute top-28 left-3 z-10 w-40">
        <ul className="max-h-56 overflow-y-auto bg-asphalt/75">
          {hud?.rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => {
                  if (mode === "watch") watchId.current = row.id;
                }}
                className={
                  "flex h-11 w-full items-center gap-2 px-2 text-left text-xs " +
                  (row.id === hud.focusId ? "text-gold" : "text-cream")
                }
              >
                <span className="w-4 text-mist">{row.position}</span>
                <span className="h-3 w-1.5 shrink-0" style={{ background: row.color }} />
                <span className="truncate">{row.alias}</span>
                <span className="ml-auto text-mist">{row.position === 1 ? "" : `+${row.gap.toFixed(1)}`}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="pointer-events-none absolute top-28 right-3 z-10 bg-asphalt/75 p-1 text-cream">
        <MiniMap outline={outline} rows={hud?.rows ?? []} focusId={hud?.focusId ?? ""} />
      </div>

      {hud?.phase === "lights" ? (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 z-10 flex flex-col items-center gap-3">
          <div className="flex gap-3">
            {[1, 2, 3].map((lamp) => (
              <span
                key={lamp}
                className={
                  "h-8 w-8 rounded-full " +
                  (hud.lights >= 4 ? "bg-gold" : hud.lights >= lamp ? "bg-signal" : "bg-line")
                }
              />
            ))}
          </div>
          <p className="bg-asphalt/80 px-3 py-1 font-display text-2xl font-bold">
            {hud.lights >= 4 ? "YA" : hud.lights === 1 ? "EN SUS MARCAS" : "LISTOS"}
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Activar sonido" : "Silenciar"}
        className="absolute top-3 left-1/2 z-20 grid h-11 w-11 -translate-x-12 place-items-center border border-line bg-asphalt/80 text-cream"
      >
        {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
      </button>

      {mode === "drive" && hud?.phase !== "finished" ? (
        <div className="safe-b absolute inset-x-0 bottom-0 z-20 grid grid-cols-4 gap-2 p-3">
          <Hold label="IZQ" onHold={(down) => hold("left", down)} />
          <Hold label="FRENO" onHold={(down) => hold("brake", down)} />
          <Hold label="GAS" accent onHold={(down) => hold("gas", down)} />
          <Hold label="DER" onHold={(down) => hold("right", down)} />
        </div>
      ) : null}

      {mode === "watch" && hud?.phase !== "finished" ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-4 z-10 text-center text-xs text-mist">
          Tocá un nombre para seguirlo
        </p>
      ) : null}

      {hud?.phase === "finished" && winner ? (
        <section className="absolute inset-0 z-30 flex flex-col items-center overflow-y-auto bg-asphalt/92 px-5 pt-16 pb-8 text-center">
          <p className="font-mono text-xs tracking-widest text-gold">GANADOR</p>
          <h2 className="mt-2 max-w-full font-display text-5xl font-bold text-cream uppercase">{winner.alias}</h2>
          <p className="mt-2 text-sm text-mist">
            {winner.carName} · {circuit.name} · {formatTime(hud.raceTime)}
          </p>
          {you && mode === "drive" ? (
            <p className="mt-2 font-display text-lg text-gold">
              {you.id === winner.id ? "Llegaste primero." : `Terminaste ${you.position}º.`}
            </p>
          ) : null}

          <table className="mt-6 w-full max-w-md text-left text-xs">
            <thead className="text-mist">
              <tr>
                <th className="py-2 font-normal">P</th>
                <th className="py-2 font-normal">Piloto</th>
                <th className="py-2 font-normal">Vuelta</th>
                <th className="py-2 text-right font-normal">Vmáx</th>
                <th className="py-2 text-right font-normal">Pas.</th>
              </tr>
            </thead>
            <tbody>
              {hud.rows.map((row) => (
                <tr key={row.id} className={row.id === winner.id ? "text-gold" : "text-cream"}>
                  <td className="border-t border-line py-2">{row.position}</td>
                  <td className="border-t border-line py-2">
                    <span className="mr-2 inline-block h-3 w-1.5 align-middle" style={{ background: row.color }} />
                    {row.alias}
                  </td>
                  <td className="border-t border-line py-2">{formatTime(row.bestLap)}</td>
                  <td className="border-t border-line py-2 text-right">{kmh(row.maxSpeed)}</td>
                  <td className="border-t border-line py-2 text-right">{row.overtakes}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            type="button"
            onClick={() => {
              unlockAudio();
              if (isMuted()) {
                setMuted(false);
                setMutedUi(false);
              }
              playFanfare();
            }}
            className="mt-4 font-mono text-xs text-gold"
          >
            Repetir musiquita
          </button>
          <div className="mt-6 grid w-full max-w-md grid-cols-2 gap-2">
            <button type="button" onClick={onAgain} className="h-14 bg-gold font-display text-base font-bold text-asphalt">
              OTRA CARRERA
            </button>
            <button type="button" onClick={onExit} className="h-14 border border-gold font-display text-base text-gold">
              GRILLA
            </button>
          </div>
        </section>
      ) : (
        <button type="button" onClick={onExit} className="absolute top-3 left-1/2 z-20 h-11 translate-x-2 px-3 text-xs text-mist">
          Salir
        </button>
      )}
    </main>
  );
}

function Hold({ label, onHold, accent = false }: { label: string; onHold: (down: boolean) => void; accent?: boolean }) {
  return (
    <button
      type="button"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onLostPointerCapture={() => onHold(false)}
      className={
        "h-16 font-display text-sm font-bold " +
        (accent ? "bg-gold text-asphalt" : "border border-line bg-asphalt/80 text-cream")
      }
    >
      {label}
    </button>
  );
}

function MiniMap({
  outline,
  rows,
  focusId,
}: {
  outline: { x: number; z: number }[];
  rows: HudSnapshot["rows"];
  focusId: string;
}) {
  const xs = outline.map((point) => point.x);
  const zs = outline.map((point) => point.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const W = 92;
  const H = 64;
  const pad = 6;
  const sx = (x: number) => pad + ((x - minX) / Math.max(1, maxX - minX)) * (W - pad * 2);
  const sy = (z: number) => pad + (1 - (z - minZ) / Math.max(1, maxZ - minZ)) * (H - pad * 2);
  const d =
    outline.map((point, index) => `${index === 0 ? "M" : "L"}${sx(point.x).toFixed(1)} ${sy(point.z).toFixed(1)}`).join(
      " ",
    ) + " Z";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-24">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
      {rows.map((row) => (
        <circle
          key={row.id}
          cx={sx(row.x)}
          cy={sy(row.z)}
          r={row.id === focusId ? 2.6 : 1.7}
          fill={row.color}
          stroke={row.id === focusId ? "#efe6d2" : "none"}
          strokeWidth="0.6"
        />
      ))}
    </svg>
  );
}
