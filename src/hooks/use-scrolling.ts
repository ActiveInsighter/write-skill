import type { RefObject } from "react"
import { useEffect, useState } from "react"

type ScrollTarget = RefObject<HTMLElement> | Window | null | undefined
type EventTargetWithScroll = Window | HTMLElement | Document

interface UseScrollingOptions {
  debounce?: number
  fallbackToDocument?: boolean
}

export function useScrolling(
  target?: ScrollTarget,
  options: UseScrollingOptions = {},
): boolean {
  const { debounce = 150, fallbackToDocument = true } = options
  const [isScrolling, setIsScrolling] = useState(false)

  useEffect(() => {
    const element: EventTargetWithScroll =
      target && typeof Window !== "undefined" && target instanceof Window
        ? target
        : ((target as RefObject<HTMLElement>)?.current ?? window)

    const eventTarget: EventTargetWithScroll =
      fallbackToDocument && element === window && typeof document !== "undefined"
        ? document
        : element

    let timeout: ReturnType<typeof setTimeout> | undefined
    const supportsScrollEnd = element === window && "onscrollend" in window

    const handleScroll: EventListener = () => {
      setIsScrolling(true)

      if (!supportsScrollEnd) {
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(() => setIsScrolling(false), debounce)
      }
    }

    const handleScrollEnd: EventListener = () => setIsScrolling(false)

    eventTarget.addEventListener("scroll", handleScroll, { capture: true, passive: true })
    if (supportsScrollEnd) {
      eventTarget.addEventListener("scrollend", handleScrollEnd, { capture: true, passive: true })
    }

    return () => {
      eventTarget.removeEventListener("scroll", handleScroll, true)
      if (supportsScrollEnd) {
        eventTarget.removeEventListener("scrollend", handleScrollEnd, true)
      }
      if (timeout) clearTimeout(timeout)
    }
  }, [target, debounce, fallbackToDocument])

  return isScrolling
}
