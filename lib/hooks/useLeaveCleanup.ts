"use client"
import { useCallback, useEffect, useRef } from "react"
import type { User } from "firebase/auth"
import { getAuth, onIdTokenChanged } from "firebase/auth"
import { forceDetachAll } from "@/lib/firebase/presence"
import { leaveRoom as leaveRoomAction } from "@/lib/firebase/rooms"

const TOKEN_KEY_PREFIX = "leaveToken:"
const REJOIN_KEY_PREFIX = "pendingRejoin:"
const RECALL_V2_ENABLED =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_RECALL_V2 === "1"
const FORCE_DETACH_ON_LEAVE =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_FORCE_DETACH_ON_LEAVE !== "0"

function setSessionValue(key: string | null, value: string | null) {
  if (!key || typeof window === "undefined") return
  try {
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, value)
  } catch {}
}

function getSessionValue(key: string | null): string | null {
  if (!key || typeof window === "undefined") return null
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

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
  const tokenKey = uid ? `${TOKEN_KEY_PREFIX}${uid}` : null
  const rejoinKey = uid ? `${REJOIN_KEY_PREFIX}${roomId}` : null
  const reloadIntentRef = useRef(false)

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

    const updateToken = (token: string | null) => {
      tokenRef.current = token
      setSessionValue(tokenKey, token)
    }

    user
      .getIdToken()
      .then((token) => {
        if (!cancelled) updateToken(token)
      })
      .catch(() => {})

    if (auth) {
      unsubscribe = onIdTokenChanged(auth, (next) => {
        if (cancelled) return
        if (!next || next.uid !== user.uid) {
          updateToken(null)
          return
        }
        next
          .getIdToken()
          .then((token) => {
            if (!cancelled) updateToken(token)
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
  }, [enabled, user?.uid, tokenKey])

  const readToken = useCallback(() => {
    if (tokenRef.current) return tokenRef.current
    try {
      const auth = getAuth()
      const current = auth.currentUser as any
      if (current && current.uid === uid) {
        const accessToken = current?.stsTokenManager?.accessToken
        if (typeof accessToken === "string" && accessToken) {
          tokenRef.current = accessToken
          setSessionValue(tokenKey, accessToken)
          return accessToken
        }
      }
    } catch {}
    const stored = getSessionValue(tokenKey)
    if (stored) {
      tokenRef.current = stored
      return stored
    }
    return null
  }, [tokenKey, uid])

  const sendLeaveBeacon = useCallback(() => {
    if (!uid) return
    const token = readToken()
    if (!token) return
    const payload = JSON.stringify({ uid, displayName: displayName ?? null, token })
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
  }, [uid, roomId, readToken, displayName])


  useEffect(() => {
    if (!uid || !rejoinKey) return
    if (typeof window === "undefined") return
    const persistRejoin = () => setSessionValue(rejoinKey, uid)
    const handleVisibility = () => {
      try {
        if (document.visibilityState === "hidden") {
          persistRejoin()
        }
      } catch {}
    }
    window.addEventListener("pagehide", persistRejoin)
    window.addEventListener("visibilitychange", handleVisibility)
    return () => {
      window.removeEventListener("pagehide", persistRejoin)
      window.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [uid, rejoinKey])

  useEffect(() => {
    if (!enabled) {
      reloadIntentRef.current = false
      return
    }
    if (typeof window === "undefined") return

    const markReloadIntent = () => {
      reloadIntentRef.current = true
    }

    const nav: any = (window as any).navigation
    let detachNavigate: (() => void) | null = null
    if (nav && typeof nav.addEventListener === "function") {
      const handleNavigate = (event: any) => {
        try {
          if (event?.navigationType === "reload") {
            markReloadIntent()
          }
        } catch {}
      }
      nav.addEventListener("navigate", handleNavigate)
      detachNavigate = () => {
        try {
          nav.removeEventListener("navigate", handleNavigate)
        } catch {}
      }
    }

    const keydownHandler = (event: KeyboardEvent) => {
      if (!event) return
      if (event.defaultPrevented) return
      const key = event.key
      if (key === "F5") {
        markReloadIntent()
        return
      }
      const isReloadShortcut = (key === "r" || key === "R") && (event.ctrlKey || event.metaKey)
      if (isReloadShortcut && !event.altKey) {
        markReloadIntent()
      }
    }

    window.addEventListener("keydown", keydownHandler, true)

    const restoreReload = (() => {
      const locationObj: any = window.location
      const originalReload: ((...args: any[]) => any) | undefined = locationObj?.reload?.bind(locationObj)
      if (typeof originalReload !== "function") {
        return () => {}
      }
      const patchedReload = (...args: any[]) => {
        markReloadIntent()
        return originalReload(...args)
      }
      try {
        locationObj.reload = patchedReload
      } catch {}
      return () => {
        try {
          if (typeof originalReload === "function") {
            locationObj.reload = originalReload
          }
        } catch {}
      }
    })()

    return () => {
      reloadIntentRef.current = false
      window.removeEventListener("keydown", keydownHandler, true)
      detachNavigate?.()
      restoreReload()
    }
  }, [enabled])

  const performCleanup = useCallback(() => {
    if (!uid) return
    if (leavingRef.current) return
    const isReloadIntent = reloadIntentRef.current
    reloadIntentRef.current = false
    leavingRef.current = true
    if (isReloadIntent) setSessionValue(rejoinKey, uid)
    else setSessionValue(rejoinKey, null)
    try {
      Promise.resolve(detachNow()).catch(() => {})
    } catch {}
    if (!isReloadIntent && FORCE_DETACH_ON_LEAVE) {
      try {
        forceDetachAll(roomId, uid).catch(() => {})
      } catch {}
    }
    const shouldSendLeave = !isReloadIntent
    if (shouldSendLeave) {
      if (!isReloadIntent) {
        sendLeaveBeacon()
      }
      try {
        Promise.resolve(leaveRoomAction(roomId, uid, displayName)).catch(() => {})
      } catch {}
    }
  }, [uid, roomId, detachNow, leavingRef, sendLeaveBeacon, displayName, rejoinKey])

  const performCleanupRef = useRef(performCleanup)
  const skipCleanupRef = useRef(false)

  useEffect(() => {
    performCleanupRef.current = performCleanup
  }, [performCleanup])

  useEffect(() => {
    if (!enabled) return
    reloadIntentRef.current = false

    skipCleanupRef.current = true
    let timeout: ReturnType<typeof setTimeout> | null = null

    const release = () => {
      skipCleanupRef.current = false
      timeout = null
    }

    if (typeof queueMicrotask === "function") {
      queueMicrotask(release)
    } else {
      timeout = setTimeout(release, 0)
    }

    return () => {
      if (timeout !== null) {
        clearTimeout(timeout)
        timeout = null
      }
      if (skipCleanupRef.current) {
        skipCleanupRef.current = false
        return
      }
      try {
        performCleanupRef.current?.()
      } catch {}
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
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
  }, [enabled, performCleanup])
}

