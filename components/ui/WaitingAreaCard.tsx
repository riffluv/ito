"use client";
import type { PlayerDoc } from "@/lib/types";
import { GameCard } from "@/components/ui/GameCard";

export default function WaitingAreaCard({
  player,
}: {
  player: PlayerDoc & { id: string };
}) {
  const ready = !!(player?.clue1 && player.clue1.trim() !== "");
  
  return (
    <GameCard
      index={0}
      name={player.name || ""}
      clue={ready ? (player.clue1 || "Ready") : "Waiting"}
      number={null}
      state={ready ? "success" : "default"}
      waitingInCentral={true}
    />
  );
}