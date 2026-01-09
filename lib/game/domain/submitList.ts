export type SubmitListValidationResult =
  | { ok: true; expected: number }
  | { ok: false; error: string };

/**
 * 並び替え提出リストの妥当性をチェックする純粋関数。
 */
export function validateSubmitList(
  list: string[],
  roundPlayers: string[] | null,
  expectedCount: number
): SubmitListValidationResult {
  if (new Set(list).size !== list.length) {
    return { ok: false, error: "提出リストに重複があります" };
  }

  const expected = expectedCount >= 0 ? expectedCount : list.length;
  if (expected >= 2 && list.length !== expected) {
    return {
      ok: false,
      error: `提出数が有効人数(${expected})と一致しません`,
    };
  }

  if (roundPlayers) {
    const allMember = list.every((pid) => roundPlayers.includes(pid));
    if (!allMember) {
      return {
        ok: false,
        error: "提出リストに対象外のプレイヤーが含まれています",
      };
    }
  }

  return { ok: true, expected };
}

