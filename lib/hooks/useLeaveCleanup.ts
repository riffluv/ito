"use client"
import { useCallback, useEffect, useRef } from "react"
import type { User } from "firebase/auth"
import { getAuth, onIdTokenChanged } from "firebase/auth"
import { leaveRoom as leaveRoomAction } from "@/lib/firebase/rooms"
import { forceDetachAll } from "@/lib/firebase/presence"

export function useLeaveCleanup({
  enabled,
  roomId,
  uid,
  displayName,
  detachNow,
  leavingRef,
  user,
}: {
  enabled: boolean
  roomId: string
  uid: string | null
  displayName: string | null | undefined
  detachNow: () => Promise<void> | void
  leavingRef: React.MutableRefObject<boolean>
  user: User | null
}) {
  const tokenRef = useRef<string | null>(null)

  useEffect(() => {
    tokenRef.current = null
    if (!enabled) return
    if (!user) return
    let cancelled = false
    let unsubscribe: (() => void) | undefined
    let auth: ReturnType<typeof getAuth> | null = null
    try {
      auth = getAuth()
    } catch {
      auth = null
    }

    user
      .getIdToken()
      .then((token) => {
        if (!cancelled) tokenRef.current = token
      })
      .catch(() => {})

    if (auth) {
      unsubscribe = onIdTokenChanged(auth, (next) => {
        if (cancelled) return
        if (!next || next.uid !== user.uid) {
          tokenRef.current = null
          return
        }
        next
          .getIdToken()
          .then((token) => {
            if (!cancelled) tokenRef.current = token
          })
          .catch(() => {})
      })
    }

    return () => {
      cancelled = true
      try {
        unsubscribe?.()
      } catch {}
    }
  }, [enabled, user?.uid])

  const sendLeaveBeacon = useCallback(() => {
    if (!uid) return
    const token = tokenRef.current
    if (!token) return
    const payload = JSON.stringify({
      uid,
      displayName: displayName ?? null,
      token,
    })
    const url = `/api/rooms/${roomId}/leave`
    let handled = false
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      try {
        const blob = new Blob([payload], { type: "application/json" })
        handled = navigator.sendBeacon(url, blob)
      } catch {}
    }
    if (!handled && typeof fetch === "function") {
      try {
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {})
      } catch {}
    }
  }, [uid, roomId, displayName])

  const performCleanup = useCallback(() => {
    if (!uid) return
    if (leavingRef.current) return
    leavingRef.current = true
    try {
      Promise.resolve(detachNow()).catch(() => {})
    } catch {}
    try {
      forceDetachAll(roomId, uid).catch(() => {})
    } catch {}
    try {
      Promise.resolve(leaveRoomAction(roomId, uid, displayName)).catch(() => {})
    } catch {}
    sendLeaveBeacon()
  }, [uid, detachNow, roomId, displayName, leavingRef, sendLeaveBeacon])

  useEffect(() => {
    if (!enabled) return
    const handler = () => {
      performCleanup()
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [enabled, performCleanup])

  useEffect(() => {
    if (!enabled) return
    const handler = () => {
      performCleanup()
    }
    window.addEventListener("pagehide", handler)
    return () => window.removeEventListener("pagehide", handler)
  }, [enabled, performCleanup])
}
