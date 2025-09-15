// サーバ側の二重保存を回避するための純粋関数
// 既に current に result が存在すれば、そのまま返す
// 無ければ next を採用
export type RoomResult = {
  success: boolean;
  failedAt: number | null;
  lastNumber: number | null;
  revealedAt?: any;
} | null;

export function mergeFinalizeResult(current: RoomResult, next: RoomResult): RoomResult {
  if (current && typeof current === "object") return current;
  return next ?? null;
}

