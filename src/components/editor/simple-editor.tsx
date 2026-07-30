import CharacterCount from "@tiptap/extension-character-count"
import Highlight from "@tiptap/extension-highlight"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import Subscript from "@tiptap/extension-subscript"
import Superscript from "@tiptap/extension-superscript"
import TaskItem from "@tiptap/extension-task-item"
import TaskList from "@tiptap/extension-task-list"
import TextAlign from "@tiptap/extension-text-align"
import Typography from "@tiptap/extension-typography"
import Underline from "@tiptap/extension-underline"
import { EditorContent, EditorContext, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
  ArrowLeft,
  Check,
  FilePlus2,
  LoaderCircle,
  Moon,
  Sun,
} from "lucide-react"
import { useTheme } from "next-themes"
import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  HighlightPanel,
  LinkPanel,
  MainToolbar,
  ToolbarSeparator,
} from "@/components/editor/editor-toolbar"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useWorkspaceStore } from "@/features/workspace/workspace-store"
import { useIsMobile } from "@/hooks/use-mobile"

function findBreadcrumb(
  nodes: ReturnType<typeof useWorkspaceStore.getState>["nodes"],
  documentId: string,
) {
  const parent = Object.values(nodes).find((node) =>
    node.children?.includes(documentId),
  )
  return parent && parent.id !== "root" ? parent.name : "全部文档"
}

export function SimpleEditor() {
  const nodes = useWorkspaceStore((state) => state.nodes)
  const selectedDocumentId = useWorkspaceStore(
    (state) => state.selectedDocumentId,
  )
  const createDocument = useWorkspaceStore((state) => state.createDocument)
  const renameNode = useWorkspaceStore((state) => state.renameNode)
  const updateDocumentContent = useWorkspaceStore(
    (state) => state.updateDocumentContent,
  )
  const selectedDocument = nodes[selectedDocumentId]
  const breadcrumb = useMemo(
    () => findBreadcrumb(nodes, selectedDocumentId),
    [nodes, selectedDocumentId],
  )
  const isMobile = useIsMobile()
  const { resolvedTheme, setTheme } = useTheme()

  const [mobileView, setMobileView] = useState<"main" | "highlight" | "link">(
    "main",
  )
  const [desktopPanel, setDesktopPanel] = useState<"highlight" | "link" | null>(
    null,
  )
  const [linkValue, setLinkValue] = useState("https://")
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved")
  const [stats, setStats] = useState({ words: 0, characters: 0 })
  const [, refreshToolbar] = useState(0)

  const activeDocumentIdRef = useRef(selectedDocumentId)
  const loadedDocumentRef = useRef<string | null>(null)
  const saveTimerRef = useRef<number | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    activeDocumentIdRef.current = selectedDocumentId
  }, [selectedDocumentId])

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": "文档内容编辑区",
        class: "simple-editor",
      },
    },
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        link: false,
        underline: false,
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      Link.configure({
        autolink: true,
        defaultProtocol: "https",
        openOnClick: false,
        enableClickSelection: true,
      }),
      Image.configure({ allowBase64: true }),
      Underline,
      Typography,
      Subscript,
      Superscript,
      Placeholder.configure({
        placeholder: "输入 / 开始写作，或从工具栏选择格式…",
      }),
      CharacterCount,
    ],
    content: selectedDocument?.content ?? "",
    onCreate: ({ editor: currentEditor }) => {
      setStats({
        words: currentEditor.storage.characterCount.words(),
        characters: currentEditor.storage.characterCount.characters(),
      })
    },
    onSelectionUpdate: () => refreshToolbar((value) => value + 1),
    onTransaction: () => refreshToolbar((value) => value + 1),
    onUpdate: ({ editor: currentEditor }) => {
      updateDocumentContent(
        activeDocumentIdRef.current,
        currentEditor.getHTML(),
      )
      setStats({
        words: currentEditor.storage.characterCount.words(),
        characters: currentEditor.storage.characterCount.characters(),
      })
      setSaveState("saving")
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = window.setTimeout(() => setSaveState("saved"), 500)
    },
  })

  useEffect(() => {
    if (!editor || !selectedDocument || selectedDocument.kind !== "document") {
      return
    }
    if (loadedDocumentRef.current === selectedDocumentId) return

    loadedDocumentRef.current = selectedDocumentId
    editor.commands.setContent(selectedDocument.content ?? "", {
      emitUpdate: false,
    })
    setStats({
      words: editor.storage.characterCount.words(),
      characters: editor.storage.characterCount.characters(),
    })
    setDesktopPanel(null)
    setMobileView("main")
    setSaveState("saved")
  }, [editor, selectedDocument, selectedDocumentId])

  useEffect(
    () => () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    },
    [],
  )

  const openLinkPanel = () => {
    const href = editor?.getAttributes("link").href as string | undefined
    setLinkValue(href || "https://")
    if (isMobile) setMobileView("link")
    else setDesktopPanel((current) => (current === "link" ? null : "link"))
  }

  const applyLink = () => {
    if (!editor) return
    const href = linkValue.trim()
    if (!href || href === "https://") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run()
    }
    setDesktopPanel(null)
    setMobileView("main")
  }

  const openHighlightPanel = () => {
    if (isMobile) setMobileView("highlight")
    else
      setDesktopPanel((current) =>
        current === "highlight" ? null : "highlight",
      )
  }

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || !editor) return
    if (file.size > 1.5 * 1024 * 1024) {
      window.alert("当前前端原型中的本地图片不能超过 1.5 MB。")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== "string") return
      editor
        .chain()
        .focus()
        .setImage({ src: reader.result, alt: file.name, title: file.name })
        .run()
    }
    reader.readAsDataURL(file)
  }

  if (!selectedDocument || selectedDocument.kind !== "document") {
    return (
      <div className="flex min-h-svh flex-1 items-center justify-center p-6">
        <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-xl shadow-black/5">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FilePlus2 className="size-6" />
          </div>
          <h1 className="text-xl font-semibold">创建第一篇文档</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            从空白内容开始，整理目标、步骤、约束和输出格式。
          </p>
          <Button className="mt-6" onClick={() => createDocument("root")}>
            <FilePlus2 />
            新建文档
          </Button>
        </div>
      </div>
    )
  }

  const mobilePanel = mobileView === "highlight" ? (
    <HighlightPanel editor={editor} onClose={() => setMobileView("main")} />
  ) : (
    <LinkPanel
      editor={editor}
      value={linkValue}
      onChange={setLinkValue}
      onApply={applyLink}
      onClose={() => setMobileView("main")}
    />
  )

  return (
    <div className="flex min-h-svh min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/80 bg-background/85 px-3 backdrop-blur-xl sm:px-4">
        <SidebarTrigger className="shrink-0" />
        <div className="mx-1 h-5 w-px bg-border" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] text-muted-foreground">
            {breadcrumb} / {selectedDocument.name}
          </p>
          <input
            value={selectedDocument.name}
            aria-label="文档标题"
            className="block h-6 w-full max-w-xl truncate bg-transparent text-sm font-semibold tracking-tight outline-none placeholder:text-muted-foreground"
            onChange={(event) => renameNode(selectedDocumentId, event.target.value)}
          />
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <div className="hidden items-center gap-1.5 rounded-full border border-border bg-muted/45 px-2.5 py-1 text-[11px] text-muted-foreground sm:flex">
            {saveState === "saving" ? (
              <LoaderCircle className="size-3 animate-spin" />
            ) : (
              <Check className="size-3 text-emerald-500" />
            )}
            {saveState === "saving" ? "保存中" : "已保存到本地"}
          </div>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="切换明暗主题"
                  onClick={() =>
                    setTheme(resolvedTheme === "dark" ? "light" : "dark")
                  }
                >
                  {resolvedTheme === "dark" ? <Sun /> : <Moon />}
                </Button>
              }
            />
            <TooltipContent>切换主题</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <EditorContext.Provider value={{ editor }}>
          <div className="relative z-30 shrink-0 border-b border-border/80 bg-background/92 backdrop-blur-xl">
            {isMobile && mobileView !== "main" ? (
              <div className="flex min-h-12 items-center gap-2 overflow-x-auto px-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="返回主工具栏"
                  onClick={() => setMobileView("main")}
                >
                  <ArrowLeft />
                </Button>
                <ToolbarSeparator />
                {mobilePanel}
              </div>
            ) : (
              <div
                className="flex min-h-12 items-center overflow-x-auto px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-3"
                role="toolbar"
                aria-label="文本格式工具栏"
              >
                <MainToolbar
                  editor={editor}
                  isMobile={isMobile}
                  onOpenHighlight={openHighlightPanel}
                  onOpenLink={openLinkPanel}
                  onImageUpload={() => imageInputRef.current?.click()}
                />
              </div>
            )}

            {desktopPanel && !isMobile && (
              <div className="absolute left-1/2 top-[calc(100%+8px)] z-50 -translate-x-1/2 rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl">
                {desktopPanel === "highlight" ? (
                  <HighlightPanel
                    editor={editor}
                    onClose={() => setDesktopPanel(null)}
                  />
                ) : (
                  <LinkPanel
                    editor={editor}
                    value={linkValue}
                    onChange={setLinkValue}
                    onApply={applyLink}
                    onClose={() => setDesktopPanel(null)}
                  />
                )}
              </div>
            )}
          </div>

          <input
            ref={imageInputRef}
            className="sr-only"
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
          />

          <div className="editor-scroll min-h-0 flex-1 overflow-y-auto bg-editor-canvas px-3 py-5 sm:px-6 sm:py-8 lg:px-10">
            <div className="editor-paper mx-auto min-h-[calc(100vh-11rem)] w-full max-w-[880px] rounded-2xl border border-border/70 bg-card shadow-[0_18px_60px_-28px_rgba(15,23,42,0.25)] sm:rounded-3xl">
              <EditorContent
                editor={editor}
                role="presentation"
                className="simple-editor-content"
              />
            </div>
          </div>
        </EditorContext.Provider>

        <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-border/70 bg-background px-3 text-[10px] text-muted-foreground sm:px-4">
          <span>{stats.words} 个词</span>
          <span>{stats.characters} 个字符</span>
          <span className="ml-auto hidden sm:inline">HTML 富文本 · 本地自动保存</span>
        </footer>
      </div>
    </div>
  )
}
