import { useCallback, useMemo, useSyncExternalStore } from "react"

const getServerSnapshot = () => false

/**
 * Subscribe to a media query without a post-mount false state.
 * This keeps responsive components in the correct mode on their first client render.
 */
export function useMediaQuery(query: string) {
  const mediaQuery = useMemo(
    () => (typeof window === "undefined" ? null : window.matchMedia(query)),
    [query],
  )

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!mediaQuery) return () => undefined

      mediaQuery.addEventListener("change", onStoreChange)
      return () => mediaQuery.removeEventListener("change", onStoreChange)
    },
    [mediaQuery],
  )

  const getSnapshot = useCallback(() => mediaQuery?.matches ?? false, [mediaQuery])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
