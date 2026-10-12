import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Garage } from "@/components/garage";
import { Lobby, type Seat } from "@/components/lobby";
import { RaceScreen } from "@/components/race-screen";
import { TitleScreen } from "@/components/title-screen";
import { unlockAudio } from "@/game/audio";
import { CARS, LIVERIES, type Racer } from "@/game/catalog";
import { P2PRoom, type PeerInfo } from "@/lib/multiplayer";

export const Route = createFileRoute("/")({ component: Home });

type Screen = "menu" | "garage" | "lobby" | "race";

type NetPose = {
  id: string;
  s: number;
  offset: number;
  speed: number;
  laps: number;
  yaw: number;
  at: number;
};

type Wire =
  | { t: "seat"; alias: string; carId: string; color: string }
  | { t: "track"; trackId: string }
  | { t: "start"; trackId: string; grid: { id: string; alias: string; carId: string; color: string }[] }
  | { t: "state"; s: number; offset: number; speed: number; laps: number; yaw: number };

const ALIAS_KEY = "asfalto98-alias";

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

function Home() {
  const selfId = useRef(crypto.randomUUID().replace(/-/g, "").slice(0, 16)).current;
  const roomRef = useRef<P2PRoom | null>(null);
  const remotes = useRef(new Map<string, NetPose>());
  const [screen, setScreen] = useState<Screen>("menu");
  const [mode, setMode] = useState<"drive" | "watch">("drive");
  const [grid, setGrid] = useState<Racer[]>([]);
  const [trackId, setTrackId] = useState("monza");
  const [nonce, setNonce] = useState(0);
  const [code, setCode] = useState<string | null>(null);
  const [host, setHost] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [alias, setAlias] = useState("VOS");
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [seats, setSeats] = useState<Record<string, Seat>>({});
  const [lobbyTrack, setLobbyTrack] = useState("monza");
  const seatRef = useRef<Seat>({ alias: "VOS", carId: CARS[0].id, color: LIVERIES[0].hex });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ALIAS_KEY);
      if (saved) {
        const next = saved.slice(0, 14);
        setAlias(next);
        seatRef.current = { ...seatRef.current, alias: next };
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    return () => {
      roomRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!code) return;
    const room = roomRef.current;
    if (!room) return;
    room.send({ t: "seat", ...seatRef.current });
    if (host) room.send({ t: "track", trackId: lobbyTrack });
  }, [peers, code, host, lobbyTrack]);

  function publishSeat(next: Seat) {
    seatRef.current = next;
    setSeats((current) => ({ ...current, [selfId]: next }));
    roomRef.current?.send({ t: "seat", ...next });
  }

  function openRoom(nextCode: string, asHost: boolean, name: string) {
    unlockAudio();
    roomRef.current?.close();
    remotes.current.clear();
    const room = new P2PRoom({
      room: `asf-${nextCode}`,
      selfId,
      name,
      onPeersChanged: (next) => setPeers(next),
      onMessage: (from, data) => {
        const msg = data as Wire;
        if (!msg || typeof msg !== "object" || !("t" in msg)) return;
        if (msg.t === "seat") {
          setSeats((current) => ({ ...current, [from]: { alias: msg.alias, carId: msg.carId, color: msg.color } }));
        } else if (msg.t === "track") {
          setLobbyTrack(msg.trackId);
        } else if (msg.t === "start") {
          setGrid(msg.grid.map((racer) => ({ ...racer, player: racer.id === selfId })));
          setTrackId(msg.trackId);
          setMode("drive");
          setNonce((value) => value + 1);
          setScreen("race");
        } else if (msg.t === "state") {
          remotes.current.set(from, { id: from, ...msg, at: performance.now() });
        }
      },
    });
    roomRef.current = room;
    setCode(nextCode);
    setHost(asHost);
    setPeers([]);
    setSeats({ [selfId]: seatRef.current });
    setScreen("lobby");
    void room.join().then(() => {
      room.send({ t: "seat", ...seatRef.current });
      if (asHost) room.send({ t: "track", trackId: "monza" });
    });
  }

  function leaveRoom() {
    roomRef.current?.close();
    roomRef.current = null;
    setCode(null);
    setPeers([]);
    setScreen("menu");
  }

  const net =
    code == null
      ? null
      : {
          pull: () => [...remotes.current.values()],
          push: (pose: { s: number; offset: number; speed: number; laps: number; yaw: number }) => {
            roomRef.current?.broadcast({ t: "state", ...pose });
          },
        };

  if (screen === "menu") {
    return (
      <div>
        <TitleScreen
          onSolo={() => {
            unlockAudio();
            setScreen("garage");
          }}
          onLobby={() => setScreen("lobby")}
        />
      </div>
    );
  }

  if (screen === "lobby" && !code) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-6">
        <p className="font-mono text-xs tracking-widest text-gold">GRUPO</p>
        <h1 className="mt-2 font-display text-4xl font-bold text-cream">LOBBY</h1>
        <p className="mt-3 text-sm text-mist">Creá una sala y pasá el código. Cada uno elige su vehículo y maneja el propio.</p>
        <label className="mt-5 block text-xs text-mist" htmlFor="alias-gate">
          Alias
        </label>
        <input
          id="alias-gate"
          value={alias}
          maxLength={14}
          autoComplete="off"
          onChange={(event) => {
            const next = event.target.value.toUpperCase();
            setAlias(next);
            seatRef.current = { ...seatRef.current, alias: next || "VOS" };
            try {
              localStorage.setItem(ALIAS_KEY, next);
            } catch {
              /* ignore */
            }
          }}
          className="mt-1 h-12 w-full border border-line bg-panel px-3 font-display text-lg text-cream outline-none focus:border-gold"
        />
        <button
          type="button"
          onClick={() => openRoom(makeCode(), true, alias || "VOS")}
          className="mt-4 h-14 bg-gold font-display text-lg font-bold text-asphalt"
        >
          CREAR SALA
        </button>
        <div className="mt-3 flex gap-2">
          <input
            value={joinCode}
            maxLength={4}
            autoComplete="off"
            placeholder="CÓDIGO"
            onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
            className="h-14 w-28 border border-line bg-panel px-3 text-center font-display text-lg text-cream outline-none focus:border-gold"
          />
          <button
            type="button"
            disabled={joinCode.length < 4}
            onClick={() => openRoom(joinCode, false, alias || "VOS")}
            className="h-14 flex-1 border border-gold font-display text-lg font-bold text-gold"
          >
            UNIRSE
          </button>
        </div>
        <button type="button" onClick={() => setScreen("menu")} className="mt-6 h-11 text-xs text-mist">
          Volver
        </button>
      </main>
    );
  }

  if (screen === "lobby" && code) {
    return (
      <Lobby
        code={code}
        selfId={selfId}
        host={host}
        alias={alias}
        peers={peers}
        seats={seats}
        trackId={lobbyTrack}
        onAlias={(next) => {
          const name = next || "VOS";
          setAlias(next);
          publishSeat({ ...seatRef.current, alias: name });
          try {
            localStorage.setItem(ALIAS_KEY, next);
          } catch {
            /* ignore */
          }
        }}
        onSeat={(seat) => {
          setAlias(seat.alias);
          publishSeat(seat);
        }}
        onTrack={(id) => {
          setLobbyTrack(id);
          roomRef.current?.send({ t: "track", trackId: id });
        }}
        onStart={(racers) => {
          const ordered = [...racers].sort((a, b) => a.id.localeCompare(b.id));
          roomRef.current?.send({
            t: "start",
            trackId: lobbyTrack,
            grid: ordered.map(({ id, alias: name, carId, color }) => ({ id, alias: name, carId, color })),
          });
          setGrid(ordered.map((racer) => ({ ...racer, player: racer.id === selfId })));
          setTrackId(lobbyTrack);
          setMode("drive");
          setNonce((value) => value + 1);
          setScreen("race");
        }}
        onLeave={leaveRoom}
      />
    );
  }

  if (screen === "race") {
    return (
      <RaceScreen
        key={nonce}
        racers={grid}
        mode={mode}
        trackId={trackId}
        net={code ? net : null}
        onExit={() => setScreen(code ? "lobby" : "garage")}
        onAgain={() => {
          unlockAudio();
          setNonce((value) => value + 1);
        }}
      />
    );
  }

  return (
    <Garage
      onBack={() => setScreen("menu")}
      onDrive={(racers, nextTrack) => {
        unlockAudio();
        const hasPlayer = racers.some((racer) => racer.player);
        const next = hasPlayer ? racers : racers.map((racer, index) => ({ ...racer, player: index === 0 }));
        setGrid(next);
        setTrackId(nextTrack);
        setMode("drive");
        setNonce((value) => value + 1);
        setScreen("race");
      }}
      onWatch={(racers, nextTrack) => {
        unlockAudio();
        setGrid(racers.map((racer) => ({ ...racer, player: false })));
        setTrackId(nextTrack);
        setMode("watch");
        setNonce((value) => value + 1);
        setScreen("race");
      }}
    />
  );
}
