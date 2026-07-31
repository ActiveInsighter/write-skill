import { useMemo } from "react"

import { useMediaQuery } from "@/hooks/use-media-query"

type BreakpointMode = "min" | "max"

/**
 * Detect whether the viewport matches a breakpoint rule.
 * Example:
 *   useIsBreakpoint("max", 768)   // true when width < 768
 *   useIsBreakpoint("min", 1024)  // true when width >= 1024
 */
export function useIsBreakpoint(
  mode: BreakpointMode = "max",
  breakpoint = 768,
) {
  const query = useMemo(
    () =>
      mode === "min"
        ? `(min-width: ${breakpoint}px)`
        : `(max-width: ${breakpoint - 1}px)`,
    [breakpoint, mode],
  )

  return useMediaQuery(query)
}
