import type { PlayerDoc } from "@/lib/types";

export type LedgerPlayer = PlayerDoc & { id: string };

export function buildSortedPlayers(
  players: LedgerPlayer[],
  orderList: string[]
): LedgerPlayer[] {
  const lookup = new Map(players.map((p) => [p.id, p]));
  const ordered = orderList
    .map((id) => lookup.get(id))
    .filter((p): p is LedgerPlayer => Boolean(p));
  const leftovers = players.filter((p) => !orderList.includes(p.id));
  return [...ordered, ...leftovers];
}

export type MvpTally = {
  voteCounts: Record<string, number>;
  totalVoters: number;
  totalPlayers: number;
  allVoted: boolean;
  mvpIds: string[];
  isTie: boolean;
  isAllTie: boolean;
  myVote: string | null;
};

export function buildMvpTally(params: {
  mvpVotes: Record<string, string> | null;
  sortedPlayers: LedgerPlayer[];
  myId: string;
}): MvpTally {
  const { mvpVotes, sortedPlayers, myId } = params;
  const votes = mvpVotes || {};
  const voteCounts: Record<string, number> = {};

  // オンライン中のプレイヤーIDのSet
  const onlinePlayerIds = new Set(sortedPlayers.map((p) => p.id));

  // 投票済み判定: オンラインで投票した人（投票先が落ちててもOK）
  const voters = Object.keys(votes).filter((voterId) =>
    onlinePlayerIds.has(voterId)
  );

  // 有効票の集計: 投票者も投票先もオンライン
  const validVotes = Object.entries(votes).filter(
    ([voterId, votedId]) =>
      onlinePlayerIds.has(voterId) && onlinePlayerIds.has(votedId)
  );

  // 有効な投票のみをカウント
  validVotes.forEach(([_, votedId]) => {
    voteCounts[votedId] = (voteCounts[votedId] || 0) + 1;
  });

  const allVoted =
    sortedPlayers.length > 0 && sortedPlayers.every((p) => voters.includes(p.id));

  let mvpIds: string[] = [];
  let isTie = false;
  let isAllTie = false;
  if (allVoted) {
    const maxVotes = Math.max(...Object.values(voteCounts), 0);

    if (maxVotes > 0) {
      // 最多得票者を全員取得
      mvpIds = sortedPlayers
        .filter((p) => (voteCounts[p.id] || 0) === maxVotes)
        .map((p) => p.id);

      // 2人以上いたら同点
      isTie = mvpIds.length > 1;

      // 全員が同点かチェック
      isAllTie = mvpIds.length === sortedPlayers.length;
    }
  }

  return {
    voteCounts,
    totalVoters: voters.length,
    totalPlayers: sortedPlayers.length,
    allVoted,
    mvpIds,
    isTie,
    isAllTie,
    myVote: onlinePlayerIds.has(myId) ? votes[myId] || null : null,
  };
}

export function computeVoteProgress(tally: MvpTally): {
  progress: number;
  percent: number;
} {
  const progress =
    tally.totalPlayers > 0
      ? Math.min(Math.max(tally.totalVoters / tally.totalPlayers, 0), 1)
      : 0;
  return { progress, percent: Math.round(progress * 100) };
}

