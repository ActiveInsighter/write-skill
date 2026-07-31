"use client"

import { useEffect, useState } from "react"
import { useThrottledCallback } from "@/hooks/use-throttled-callback"

export interface WindowSizeState {
  width: number
  height: number
  offsetTop: number
  offsetLeft: number
  scale: number
}

export function useWindowSize(): WindowSizeState {
  const [windowSize, setWindowSize] = useState<WindowSizeState>({
    width: 0,
    height: 0,
    offsetTop: 0,
    offsetLeft: 0,
    scale: 1,
  })

  const handleViewportChange = useThrottledCallback(
    () => {
      if (typeof window === "undefined") return

      const viewport = window.visualViewport
      const nextSize: WindowSizeState = viewport
        ? {
            width: viewport.width,
            height: viewport.height,
            offsetTop: viewport.offsetTop,
            offsetLeft: viewport.offsetLeft,
            scale: viewport.scale,
          }
        : {
            width: window.innerWidth,
            height: window.innerHeight,
            offsetTop: 0,
            offsetLeft: 0,
            scale: 1,
          }

      setWindowSize((current) =>
        current.width === nextSize.width &&
        current.height === nextSize.height &&
        current.offsetTop === nextSize.offsetTop &&
        current.offsetLeft === nextSize.offsetLeft &&
        current.scale === nextSize.scale
          ? current
          : nextSize,
      )
    },
    120,
    [],
    { leading: true, trailing: true },
  )

  useEffect(() => {
    const viewport = window.visualViewport

    if (viewport) {
      viewport.addEventListener("resize", handleViewportChange, { passive: true })
      viewport.addEventListener("scroll", handleViewportChange, { passive: true })
    } else {
      window.addEventListener("resize", handleViewportChange, { passive: true })
    }

    handleViewportChange()

    return () => {
      if (viewport) {
        viewport.removeEventListener("resize", handleViewportChange)
        viewport.removeEventListener("scroll", handleViewportChange)
      } else {
        window.removeEventListener("resize", handleViewportChange)
      }
    }
  }, [handleViewportChange])

  return windowSize
}
