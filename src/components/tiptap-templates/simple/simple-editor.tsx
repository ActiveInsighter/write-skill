"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { JSONContent } from "@tiptap/core"
import { EditorContent, EditorContext, useEditor } from "@tiptap/react"

import { StarterKit } from "@tiptap/starter-kit"
import { Image } from "@tiptap/extension-image"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { TextAlign } from "@tiptap/extension-text-align"
import { Typography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import { Selection } from "@tiptap/extensions"

import { Button } from "@/components/tiptap-ui-primitive/button"
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/tiptap-ui-primitive/toolbar"

import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import "@/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "@/components/tiptap-node/code-block-node/code-block-node.scss"
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "@/components/tiptap-node/list-node/list-node.scss"
import "@/components/tiptap-node/image-node/image-node.scss"
import "@/components/tiptap-node/heading-node/heading-node.scss"
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss"

import { HeadingDropdownMenu } from "@/components/tiptap-ui/heading-dropdown-menu"
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu"
import { BlockquoteButton } from "@/components/tiptap-ui/blockquote-button"
import { CodeBlockButton } from "@/components/tiptap-ui/code-block-button"
import {
  ColorHighlightPopover,
  ColorHighlightPopoverContent,
  ColorHighlightPopoverButton,
} from "@/components/tiptap-ui/color-highlight-popover"
import {
  LinkPopover,
  LinkContent,
  LinkButton,
} from "@/components/tiptap-ui/link-popover"
import { MarkButton } from "@/components/tiptap-ui/mark-button"
import { TextAlignButton } from "@/components/tiptap-ui/text-align-button"
import { UndoRedoButton } from "@/components/tiptap-ui/undo-redo-button"

import { ArrowLeftIcon } from "@/components/tiptap-icons/arrow-left-icon"
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon"
import { LinkIcon } from "@/components/tiptap-icons/link-icon"

import { useCursorVisibility } from "@/hooks/use-cursor-visibility"
import { useRefRect } from "@/hooks/use-element-rect"
import { useIsBreakpoint } from "@/hooks/use-is-breakpoint"
import { useWindowSize } from "@/hooks/use-window-size"
import { ThemeToggle } from "@/components/tiptap-templates/simple/theme-toggle"

import "@/components/tiptap-templates/simple/simple-editor.scss"
import starterContent from "@/components/tiptap-templates/simple/data/content.json"

const MainToolbarContent = ({
  onHighlighterClick,
  onLinkClick,
  isMobile,
}: {
  onHighlighterClick: () => void
  onLinkClick: () => void
  isMobile: boolean
}) => (
  <>
    <ToolbarGroup>
      <UndoRedoButton action="undo" />
      <UndoRedoButton action="redo" />
    </ToolbarGroup>
    <ToolbarSeparator />
    <ToolbarGroup>
      <HeadingDropdownMenu modal={false} levels={[1, 2, 3, 4]} />
      <ListDropdownMenu modal={false} types={["bulletList", "orderedList", "taskList"]} />
      <BlockquoteButton />
      <CodeBlockButton />
    </ToolbarGroup>
    <ToolbarSeparator />
    <ToolbarGroup>
      <MarkButton type="bold" />
      <MarkButton type="italic" />
      <MarkButton type="strike" />
      <MarkButton type="code" />
      <MarkButton type="underline" />
      {isMobile ? (
        <ColorHighlightPopoverButton onClick={onHighlighterClick} />
      ) : (
        <ColorHighlightPopover />
      )}
      {isMobile ? <LinkButton onClick={onLinkClick} /> : <LinkPopover />}
    </ToolbarGroup>
    <ToolbarSeparator />
    <ToolbarGroup>
      <MarkButton type="superscript" />
      <MarkButton type="subscript" />
    </ToolbarGroup>
    <ToolbarSeparator />
    <ToolbarGroup>
      <TextAlignButton align="left" />
      <TextAlignButton align="center" />
      <TextAlignButton align="right" />
      <TextAlignButton align="justify" />
    </ToolbarGroup>
    <ToolbarSeparator />
    <ToolbarGroup>
      <ThemeToggle />
    </ToolbarGroup>
  </>
)

const MobileToolbarContent = ({
  type,
  onBack,
}: {
  type: "highlighter" | "link"
  onBack: () => void
}) => (
  <>
    <ToolbarGroup>
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeftIcon className="tiptap-button-icon" />
        {type === "highlighter" ? (
          <HighlighterIcon className="tiptap-button-icon" />
        ) : (
          <LinkIcon className="tiptap-button-icon" />
        )}
      </Button>
    </ToolbarGroup>
    <ToolbarSeparator />
    {type === "highlighter" ? <ColorHighlightPopoverContent /> : <LinkContent />}
  </>
)

export interface SimpleEditorProps {
  content?: JSONContent
  onUpdate?: (content: JSONContent) => void
}

export function SimpleEditor({ content, onUpdate }: SimpleEditorProps) {
  const isMobile = useIsBreakpoint()
  const { height, offsetTop } = useWindowSize()
  const [mobileView, setMobileView] = useState<"main" | "highlighter" | "link">("main")
  const [toolbarHeight, setToolbarHeight] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const onUpdateRef = useRef(onUpdate)
  const lastEmittedContentRef = useRef<string | null>(null)
  const lastEmittedContentObjectRef = useRef<JSONContent | null>(null)
  const wrapperRect = useRefRect(wrapperRef, {
    enabled: isMobile,
    throttleMs: 100,
    useResizeObserver: true,
  })

  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])

  const editor = useEditor({
    immediatelyRender: false,
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": "Main content area, start typing to enter text.",
        class: "simple-editor",
      },
    },
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
      }),
      HorizontalRule,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Image,
      Typography,
      Superscript,
      Subscript,
      Selection,
    ],
    content: content ?? starterContent,
    onUpdate: ({ editor: currentEditor }) => {
      const nextContent = currentEditor.getJSON()
      lastEmittedContentObjectRef.current = nextContent
      lastEmittedContentRef.current = JSON.stringify(nextContent)
      onUpdateRef.current?.(nextContent)
    },
  })

  const editorContextValue = useMemo(() => ({ editor }), [editor])
  useCursorVisibility({
    editor,
    overlayHeight: isMobile ? toolbarHeight : 0,
    scrollContainer: contentRef,
  })

  useEffect(() => {
    const toolbar = toolbarRef.current
    if (!isMobile || !toolbar) {
      setToolbarHeight(0)
      return
    }

    let animationFrame: number | null = null
    const measureToolbar = () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null
        setToolbarHeight(toolbar.getBoundingClientRect().height)
      })
    }

    measureToolbar()
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measureToolbar)
    resizeObserver?.observe(toolbar)
    window.addEventListener("resize", measureToolbar, { passive: true })
    window.visualViewport?.addEventListener("resize", measureToolbar, { passive: true })

    return () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame)
      resizeObserver?.disconnect()
      window.removeEventListener("resize", measureToolbar)
      window.visualViewport?.removeEventListener("resize", measureToolbar)
    }
  }, [isMobile, mobileView])

  useEffect(() => {
    if (!editor || !content) return
    if (content === lastEmittedContentObjectRef.current) return

    const incomingContent = JSON.stringify(content)
    if (incomingContent === lastEmittedContentRef.current) {
      lastEmittedContentObjectRef.current = content
      return
    }
    if (incomingContent === JSON.stringify(editor.getJSON())) {
      lastEmittedContentObjectRef.current = content
      lastEmittedContentRef.current = incomingContent
      return
    }

    editor.commands.setContent(content, { emitUpdate: false })
    lastEmittedContentObjectRef.current = content
    lastEmittedContentRef.current = incomingContent
  }, [content, editor])

  useEffect(() => {
    if (!isMobile && mobileView !== "main") setMobileView("main")
  }, [isMobile, mobileView])

  const mobileToolbarBottom = Math.max(0, wrapperRect.bottom - (height + offsetTop))

  return (
    <div ref={wrapperRef} className="simple-editor-wrapper">
      <EditorContext.Provider value={editorContextValue}>
        <Toolbar
          ref={toolbarRef}
          className="simple-editor-toolbar"
          aria-label="Formatting toolbar"
          style={isMobile ? { bottom: `${mobileToolbarBottom}px` } : undefined}
        >
          <div className="simple-editor-toolbar-content">
            {mobileView === "main" ? (
              <MainToolbarContent
                onHighlighterClick={() => setMobileView("highlighter")}
                onLinkClick={() => setMobileView("link")}
                isMobile={isMobile}
              />
            ) : (
              <MobileToolbarContent
                type={mobileView === "highlighter" ? "highlighter" : "link"}
                onBack={() => setMobileView("main")}
              />
            )}
          </div>
        </Toolbar>

        <EditorContent
          ref={contentRef}
          editor={editor}
          role="presentation"
          className="simple-editor-content"
        />
      </EditorContext.Provider>
    </div>
  )
}
