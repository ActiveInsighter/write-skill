"use client"

import { useCallback, useEffect, useState } from "react"
import { useThrottledCallback } from "@/hooks/use-throttled-callback"

export type RectState = Omit<DOMRect, "toJSON">

export interface ElementRectOptions {
  /**
   * The element to track. Can be an Element, ref, or selector string.
   * Defaults to document.body if not provided.
   */
  element?: Element | React.RefObject<Element> | string | null
  /** Whether to enable rect tracking. */
  enabled?: boolean
  /** Throttle delay in milliseconds for rect updates. */
  throttleMs?: number
  /** Whether to use ResizeObserver for more accurate tracking. */
  useResizeObserver?: boolean
}

const initialRect: RectState = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
}

const isSSR = typeof window === "undefined"
const hasResizeObserver = !isSSR && typeof ResizeObserver !== "undefined"
const isClientSide = (): boolean => !isSSR

export function useElementRect({
  element,
  enabled = true,
  throttleMs = 100,
  useResizeObserver = true,
}: ElementRectOptions = {}): RectState {
  const [rect, setRect] = useState<RectState>(initialRect)

  const getTargetElement = useCallback((): Element | null => {
    if (!enabled || !isClientSide()) return null
    if (!element) return document.body
    if (typeof element === "string") return document.querySelector(element)
    if ("current" in element) return element.current
    return element
  }, [element, enabled])

  const updateRect = useThrottledCallback(
    () => {
      if (!enabled || !isClientSide()) return

      const targetElement = getTargetElement()
      if (!targetElement) {
        setRect(initialRect)
        return
      }

      const nextRect = targetElement.getBoundingClientRect()
      setRect((current) => {
        if (
          current.x === nextRect.x &&
          current.y === nextRect.y &&
          current.width === nextRect.width &&
          current.height === nextRect.height &&
          current.top === nextRect.top &&
          current.right === nextRect.right &&
          current.bottom === nextRect.bottom &&
          current.left === nextRect.left
        ) {
          return current
        }

        return {
          x: nextRect.x,
          y: nextRect.y,
          width: nextRect.width,
          height: nextRect.height,
          top: nextRect.top,
          right: nextRect.right,
          bottom: nextRect.bottom,
          left: nextRect.left,
        }
      })
    },
    throttleMs,
    [enabled, getTargetElement],
    { leading: true, trailing: true },
  )

  useEffect(() => {
    if (!enabled || !isClientSide()) {
      setRect(initialRect)
      return
    }

    const targetElement = getTargetElement()
    if (!targetElement) return

    updateRect()
    const cleanup: Array<() => void> = []

    if (useResizeObserver && hasResizeObserver) {
      const resizeObserver = new ResizeObserver(() => {
        window.requestAnimationFrame(updateRect)
      })
      resizeObserver.observe(targetElement)
      cleanup.push(() => resizeObserver.disconnect())
    }

    const handleUpdate = () => updateRect()
    window.addEventListener("scroll", handleUpdate, { capture: true, passive: true })
    window.addEventListener("resize", handleUpdate, { passive: true })

    cleanup.push(() => {
      window.removeEventListener("scroll", handleUpdate, true)
      window.removeEventListener("resize", handleUpdate)
    })

    return () => {
      cleanup.forEach((dispose) => dispose())
      setRect(initialRect)
    }
  }, [enabled, getTargetElement, updateRect, useResizeObserver])

  return rect
}

export function useBodyRect(
  options: Omit<ElementRectOptions, "element"> = {},
): RectState {
  return useElementRect({
    ...options,
    element: isClientSide() ? document.body : null,
  })
}

export function useRefRect<T extends Element>(
  ref: React.RefObject<T>,
  options: Omit<ElementRectOptions, "element"> = {},
): RectState {
  return useElementRect({ ...options, element: ref })
}
