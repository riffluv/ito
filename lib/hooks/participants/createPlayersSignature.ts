import type { PlayerDoc } from "@/lib/types";

export function createPlayersSignature(
  list: readonly (PlayerDoc & { id: string })[]
): string {
  if (!list.length) return "";
  return list
    .map((player) => {
      const ready = player.ready ? "1" : "0";
      const number = typeof player.number === "number" ? player.number : "_";
      const order =
        typeof player.orderIndex === "number" ? player.orderIndex : "_";
      const clue = typeof player.clue1 === "string" ? player.clue1 : "";
      return `${player.id}|${ready}|${number}|${order}|${clue}`;
    })
    .join(";");
}
