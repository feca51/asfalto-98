import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Garage } from "@/components/garage";
import { RaceScreen } from "@/components/race-screen";
import { TitleScreen } from "@/components/title-screen";
import { unlockAudio } from "@/game/audio";
import type { Racer } from "@/game/catalog";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [screen, setScreen] = useState<"title" | "garage" | "race">("title");
  const [mode, setMode] = useState<"drive" | "watch">("drive");
  const [grid, setGrid] = useState<Racer[]>([]);
  const [trackId, setTrackId] = useState("ovalo");
  const [nonce, setNonce] = useState(0);

  if (screen === "title") {
    return (
      <TitleScreen
        onEnter={() => {
          unlockAudio();
          setScreen("garage");
        }}
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
        onExit={() => setScreen("garage")}
        onAgain={() => {
          unlockAudio();
          setNonce((value) => value + 1);
        }}
      />
    );
  }

  return (
    <Garage
      onDrive={(racers, nextTrack) => {
        unlockAudio();
        const hasPlayer = racers.some((racer) => racer.player);
        const next = hasPlayer
          ? racers
          : racers.map((racer, index) => ({ ...racer, player: index === 0 }));
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
