/**
 * Vercel環境でのPresence問題を解決するための追加対策
 */

// Vercel環境での強制クリーンアップ間隔（短めに設定）
export const VERCEL_CLEANUP_INTERVAL = 15000; // 15秒

/**
 * Vercel環境でのゴーストユーザー対策
 * 定期的にlastSeenをチェックして古いユーザーを強制削除
 */
export function startVercelPresenceCleanup(roomId: string, uid: string) {
  if (typeof window === 'undefined') return () => {};

  // 定期的にheartbeatを送信（Vercel環境では短縮）
  const heartbeatInterval = setInterval(async () => {
    try {
      await fetch(`/api/rooms/${roomId}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, timestamp: Date.now() }),
      });
    } catch (error) {
      console.warn('Heartbeat failed:', error);
    }
  }, VERCEL_CLEANUP_INTERVAL);

  // visibilitychange の強化監視
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      // 即座にleave APIを叩く（Vercel環境では確実性重視）
      navigator.sendBeacon(
        `/api/rooms/${roomId}/leave`,
        JSON.stringify({ uid, timestamp: Date.now() })
      );
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  // クリーンアップ関数
  return () => {
    clearInterval(heartbeatInterval);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}

/**
 * サーバーサイドでの古いユーザー検出・削除API用ヘルパー
 */
export function isUserStale(lastSeen: number, nowMs: number = Date.now()): boolean {
  const STALE_THRESHOLD = 60000; // 1分でstale判定（Vercel環境では厳しめ）
  return nowMs - lastSeen > STALE_THRESHOLD;
}