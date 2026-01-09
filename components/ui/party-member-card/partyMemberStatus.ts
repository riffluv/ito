import type { PartyMember, PartyStatusTone } from "@/components/ui/PartyMemberCard";

export const getPlayerStatus = (
  player: PartyMember,
  roomStatus: string,
  submitted: boolean
): { icon: string; status: string; tone: PartyStatusTone } => {
  if (roomStatus === "clue") {
    if (submitted) {
      return { icon: "✅", status: "提出済み", tone: "submitted" };
    }
    if (player.clue1 && player.clue1.trim() !== "") {
      return { icon: "📝", status: "連想OK", tone: "clue-entered" };
    }
    return { icon: "💡", status: "考え中", tone: "clue-pending" };
  }

  if (roomStatus === "waiting") {
    return { icon: "🛡️", status: "待機中", tone: "waiting" };
  }

  if (roomStatus === "reveal") {
    return { icon: "🎲", status: "判定中", tone: "reveal" };
  }

  if (roomStatus === "finished") {
    return { icon: "🏆", status: "結果発表", tone: "finished" };
  }

  return { icon: "🎲", status: "参加中", tone: "default" };
};

