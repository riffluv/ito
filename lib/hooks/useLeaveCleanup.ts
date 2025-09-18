"use client"
import { useEffect } from "react"
import { forceDetachAll } from "@/lib/firebase/presence"

export function useLeaveCleanup({
  enabled,
  roomId,
  uid,
  detachNow,
  leavingRef,
}: {
  enabled: boolean
  roomId: string
  uid: string | null
  detachNow: () => Promise<void> | void
  leavingRef: React.MutableRefObject<boolean>
}) {
  useEffect(() => {
    if (!enabled) return

    const performCleanup = () => {
      if (!uid) return
      if (leavingRef.current) return
      leavingRef.current = true
      try {
        Promise.resolve(detachNow()).catch(() => {})
      } catch {}
      try {
        forceDetachAll(roomId, uid).catch(() => {})
      } catch {}
    }

    const handleBeforeUnload = () => {
      performCleanup()
    }

    const handlePageHide = (event: Event) => {
      if ("persisted" in event && (event as any).persisted) return
      performCleanup()
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    window.addEventListener("pagehide", handlePageHide)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      window.removeEventListener("pagehide", handlePageHide)
    }
  }, [enabled, roomId, uid, detachNow, leavingRef])
}
