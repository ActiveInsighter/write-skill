import type { RefObject } from "react"
import { useEffect } from "react"
import type { Editor } from "@tiptap/react"

import { useWindowSize } from "@/hooks/use-window-size"

export interface CursorVisibilityOptions {
  editor?: Editor | null
  overlayHeight?: number
  scrollContainer?: RefObject<HTMLElement | null>
}

const CURSOR_MARGIN = 24

export function useCursorVisibility({
  editor,
  overlayHeight = 0,
  scrollContainer,
}: CursorVisibilityOptions) {
  const { height: viewportHeight, offsetTop: viewportOffsetTop } = useWindowSize()

  useEffect(() => {
    if (!editor) return

    let animationFrame: number | null = null

    const ensureCursorVisibility = () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame)

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null
        if (editor.isDestroyed || !editor.view.hasFocus() || viewportHeight <= 0) return

        const container = scrollContainer?.current
        if (!container) return

        const cursor = editor.view.coordsAtPos(editor.state.selection.from)
        const containerRect = container.getBoundingClientRect()
        const visibleTop = Math.max(containerRect.top, viewportOffsetTop) + CURSOR_MARGIN
        const visibleBottom =
          Math.min(containerRect.bottom, viewportOffsetTop + viewportHeight) -
          overlayHeight -
          CURSOR_MARGIN

        if (visibleBottom <= visibleTop) return

        let scrollDelta = 0
        if (cursor.bottom > visibleBottom) scrollDelta = cursor.bottom - visibleBottom
        else if (cursor.top < visibleTop) scrollDelta = cursor.top - visibleTop

        if (Math.abs(scrollDelta) > 1) {
          container.scrollBy({ top: scrollDelta, behavior: "auto" })
        }
      })
    }

    editor.on("selectionUpdate", ensureCursorVisibility)
    editor.on("update", ensureCursorVisibility)
    editor.on("focus", ensureCursorVisibility)
    ensureCursorVisibility()

    return () => {
      editor.off("selectionUpdate", ensureCursorVisibility)
      editor.off("update", ensureCursorVisibility)
      editor.off("focus", ensureCursorVisibility)
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame)
    }
  }, [editor, overlayHeight, scrollContainer, viewportHeight, viewportOffsetTop])
}
