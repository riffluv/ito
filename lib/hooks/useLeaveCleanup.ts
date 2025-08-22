"use client"
import { useEffect } from "react"
import { leaveRoom as leaveRoomAction } from "@/lib/firebase/rooms"
import { forceDetachAll } from "@/lib/firebase/presence"

export function useLeaveCleanup({
  enabled,
  roomId,
  uid,
  displayName,
  detachNow,
  leavingRef,
}: {
  enabled: boolean
  roomId: string
  uid: string | null
  displayName: string | null | undefined
  detachNow: () => Promise<void> | void
  leavingRef: React.MutableRefObject<boolean>
}) {
  // beforeunload: ブラウザタブ/ウィンドウ閉じ時の最小限クリーンアップ
  useEffect(() => {
    if (!enabled) return
    const handler = () => {
      if (!uid) return
      if (leavingRef.current) return
      leavingRef.current = true
      try {
        // presence は onDisconnect で削除されるため、ここでは明示デタッチのみ
        Promise.resolve(detachNow()).catch(() => {})
        // 念のための残骸掃除（失敗しても無視）
        forceDetachAll(roomId, uid).catch(() => {})
      } catch {}
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [enabled, roomId, uid, displayName, detachNow, leavingRef])
}
