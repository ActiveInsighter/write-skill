import * as React from "react"
import { Dialog } from "@base-ui/react/dialog"
import { Menu } from "@base-ui/react/menu"
import { Tooltip } from "@base-ui/react/tooltip"
import Highlight from "@tiptap/extension-highlight"
import Image from "@tiptap/extension-image"
import Placeholder from "@tiptap/extension-placeholder"
import Subscript from "@tiptap/extension-subscript"
import Superscript from "@tiptap/extension-superscript"
import TaskItem from "@tiptap/extension-task-item"
import TaskList from "@tiptap/extension-task-list"
import TextAlign from "@tiptap/extension-text-align"
import Typography from "@tiptap/extension-typography"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  CheckSquare,
  ChevronDown,
  Code2,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  SubscriptIcon,
  SuperscriptIcon,
  Underline,
  Undo2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspace"

const highlightColors = [
  { name: "黄色", value: "#fef08a" },
  { name: "绿色", value: "#bbf7d0" },
  { name: "蓝色", value: "#bfdbfe" },
  { name: "紫色", value: "#ddd6fe" },
  { name: "粉色", value: "#fbcfe8" },
]

type ToolbarButtonProps = {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}

function ToolbarButton({ label, active, disabled, onClick, children }: ToolbarButtonProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        aria-label={label}
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground outline-none transition",
          "hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/35",
          active && "bg-accent text-accent-foreground shadow-inner",
          disabled && "pointer-events-none opacity-35",
        )}
        disabled={disabled}
        onClick={onClick}
        type="button"
      >
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner className="z-[70]" sideOffset={8}>
          <Tooltip.Popup className="rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background shadow-lg">
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

function ToolbarDivider() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-border" />
}

function HeadingMenu({ editor }: { editor: Editor }) {
  const current = editor.isActive("heading", { level: 1 })
    ? "标题 1"
    : editor.isActive("heading", { level: 2 })
      ? "标题 2"
      : editor.isActive("heading", { level: 3 })
        ? "标题 3"
        : "正文"

  return (
    <Menu.Root>
      <Menu.Trigger className="flex h-8 min-w-20 items-center justify-between gap-2 rounded-md px-2 text-xs font-medium text-foreground outline-none transition hover:bg-accent data-[popup-open]:bg-accent">
        <span>{current}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="z-50" sideOffset={7}>
          <Menu.Popup className="w-40 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-xl outline-none">
            <Menu.Item className="menu-item" onClick={() => editor.chain().focus().setParagraph().run()}>
              <Pilcrow /> 正文
            </Menu.Item>
            {([1, 2, 3] as const).map((level) => (
              <Menu.Item
                className="menu-item"
                key={level}
                onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
              >
                <span className="grid size-4 place-items-center font-semibold">H{level}</span>
                标题 {level}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

function AlignmentMenu({ editor }: { editor: Editor }) {
  const options = [
    { label: "左对齐", value: "left", icon: AlignLeft },
    { label: "居中", value: "center", icon: AlignCenter },
    { label: "右对齐", value: "right", icon: AlignRight },
    { label: "两端对齐", value: "justify", icon: AlignJustify },
  ] as const

  const CurrentIcon = options.find((option) => editor.isActive({ textAlign: option.value }))?.icon ?? AlignLeft

  return (
    <Menu.Root>
      <Menu.Trigger aria-label="文字对齐" className="toolbar-menu-trigger">
        <CurrentIcon />
        <ChevronDown className="size-3" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="z-50" sideOffset={7}>
          <Menu.Popup className="w-36 rounded-lg border border-border bg-popover p-1 shadow-xl outline-none">
            {options.map(({ label, value, icon: Icon }) => (
              <Menu.Item
                className="menu-item"
                key={value}
                onClick={() => editor.chain().focus().setTextAlign(value).run()}
              >
                <Icon /> {label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

function HighlightMenu({ editor }: { editor: Editor }) {
  return (
    <Menu.Root>
      <Menu.Trigger aria-label="高亮颜色" className="toolbar-menu-trigger">
        <Highlighter />
        <ChevronDown className="size-3" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="z-50" sideOffset={7}>
          <Menu.Popup className="w-36 rounded-lg border border-border bg-popover p-1 shadow-xl outline-none">
            {highlightColors.map((color) => (
              <Menu.Item
                className="menu-item"
                key={color.value}
                onClick={() => editor.chain().focus().toggleHighlight({ color: color.value }).run()}
              >
                <span className="size-4 rounded-full border border-black/10" style={{ backgroundColor: color.value }} />
                {color.name}
              </Menu.Item>
            ))}
            <Menu.Separator className="my-1 h-px bg-border" />
            <Menu.Item className="menu-item" onClick={() => editor.chain().focus().unsetHighlight().run()}>
              <Minus /> 清除高亮
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

function LinkDialog({ editor }: { editor: Editor }) {
  const [open, setOpen] = React.useState(false)
  const [url, setUrl] = React.useState("")

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setUrl(editor.getAttributes("link").href ?? "")
    setOpen(nextOpen)
  }

  const applyLink = () => {
    const value = url.trim()
    if (!value) editor.chain().focus().extendMarkRange("link").unsetLink().run()
    else editor.chain().focus().extendMarkRange("link").setLink({ href: value }).run()
    setOpen(false)
  }

  return (
    <Dialog.Root onOpenChange={handleOpenChange} open={open}>
      <Tooltip.Root>
        <Tooltip.Trigger
          aria-label="添加链接"
          className={cn("toolbar-icon-button", editor.isActive("link") && "bg-accent text-accent-foreground")}
          onClick={() => setOpen(true)}
          type="button"
        >
          <Link2 />
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner className="z-[70]" sideOffset={8}>
            <Tooltip.Popup className="tooltip-popup">添加链接</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[2px] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-[81] w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-popover p-5 text-popover-foreground shadow-2xl outline-none data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
          <Dialog.Title className="text-base font-semibold">添加或编辑链接</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            输入目标地址；留空后保存可移除当前链接。
          </Dialog.Description>
          <input
            autoFocus
            className="mt-4 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") applyLink()
            }}
            placeholder="https://example.com"
            value={url}
          />
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close render={<Button variant="ghost" />}>取消</Dialog.Close>
            <Button onClick={applyLink}>保存链接</Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ImageDialog({ editor }: { editor: Editor }) {
  const [open, setOpen] = React.useState(false)
  const [url, setUrl] = React.useState("")

  const insertFromUrl = () => {
    const value = url.trim()
    if (!value) return
    editor.chain().focus().setImage({ src: value }).run()
    setUrl("")
    setOpen(false)
  }

  const insertFile = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        editor.chain().focus().setImage({ src: reader.result, alt: file.name }).run()
        setOpen(false)
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <Dialog.Root onOpenChange={setOpen} open={open}>
      <Tooltip.Root>
        <Tooltip.Trigger aria-label="插入图片" className="toolbar-icon-button" onClick={() => setOpen(true)} type="button">
          <ImagePlus />
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner className="z-[70]" sideOffset={8}>
            <Tooltip.Popup className="tooltip-popup">插入图片</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[2px]" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-[81] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-popover p-5 shadow-2xl outline-none">
          <Dialog.Title className="text-base font-semibold">插入图片</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            从本地选择图片，或粘贴一个公开图片地址。
          </Dialog.Description>
          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/35 px-4 py-8 text-center transition hover:border-ring hover:bg-muted/55">
            <ImagePlus className="mb-2 size-6 text-muted-foreground" />
            <span className="text-sm font-medium">选择本地图片</span>
            <span className="mt-1 text-xs text-muted-foreground">图片会暂时以 Data URL 保存</span>
            <input
              accept="image/*"
              className="sr-only"
              onChange={(event) => insertFile(event.target.files?.[0])}
              type="file"
            />
          </label>
          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> 或 <span className="h-px flex-1 bg-border" />
          </div>
          <div className="flex gap-2">
            <input
              className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://images.example.com/photo.png"
              value={url}
            />
            <Button onClick={insertFromUrl}>插入</Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function SimpleEditor() {
  const activeDocumentId = useWorkspaceStore((state) => state.activeDocumentId)
  const documentNode = useWorkspaceStore((state) => state.nodes[state.activeDocumentId])
  const renameNode = useWorkspaceStore((state) => state.renameNode)
  const updateDocument = useWorkspaceStore((state) => state.updateDocument)
  const [saveState, setSaveState] = React.useState<"saved" | "saving">("saved")
  const [wordCount, setWordCount] = React.useState(0)
  const saveTimerRef = React.useRef<number | undefined>(undefined)
  const activeDocumentIdRef = React.useRef(activeDocumentId)
  activeDocumentIdRef.current = activeDocumentId

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          autolink: true,
          defaultProtocol: "https",
          openOnClick: false,
        },
      }),
      Highlight.configure({ multicolor: true }),
      Image.configure({ allowBase64: true }),
      Placeholder.configure({ placeholder: "从这里开始写作…" }),
      Subscript,
      Superscript,
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Typography,
    ],
    content: documentNode?.content ?? "<p></p>",
    editorProps: {
      attributes: {
        class: "tiptap",
        spellcheck: "true",
      },
    },
    onCreate: ({ editor: instance }) => setWordCount(countWords(instance.getText())),
    onUpdate: ({ editor: instance }) => {
      updateDocument(activeDocumentIdRef.current, instance.getHTML())
      setWordCount(countWords(instance.getText()))
      setSaveState("saving")
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = window.setTimeout(() => setSaveState("saved"), 450)
    },
  })

  React.useEffect(() => {
    if (!editor || !documentNode) return
    editor.commands.setContent(documentNode.content || "<p></p>", { emitUpdate: false })
    setWordCount(countWords(editor.getText()))
    setSaveState("saved")
  }, [activeDocumentId, editor])

  React.useEffect(() => () => window.clearTimeout(saveTimerRef.current), [])

  if (!documentNode || documentNode.type !== "document") {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div>
          <FileTextPlaceholder />
          <h2 className="mt-4 font-semibold">还没有可编辑的文档</h2>
          <p className="mt-1 text-sm text-muted-foreground">从左侧目录新建一个文档开始写作。</p>
        </div>
      </div>
    )
  }

  if (!editor) return <div className="h-full animate-pulse bg-muted/20" />

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="editor-toolbar-shell">
        <div className="editor-toolbar" role="toolbar" aria-label="编辑器工具栏">
          <HeadingMenu editor={editor} />
          <ToolbarDivider />
          <ToolbarButton label="撤销" disabled={!editor.can().chain().focus().undo().run()} onClick={() => editor.chain().focus().undo().run()}>
            <Undo2 />
          </ToolbarButton>
          <ToolbarButton label="重做" disabled={!editor.can().chain().focus().redo().run()} onClick={() => editor.chain().focus().redo().run()}>
            <Redo2 />
          </ToolbarButton>
          <ToolbarDivider />
          <ToolbarButton active={editor.isActive("bold")} label="加粗" onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("italic")} label="斜体" onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("underline")} label="下划线" onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <Underline />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("strike")} label="删除线" onClick={() => editor.chain().focus().toggleStrike().run()}>
            <Strikethrough />
          </ToolbarButton>
          <HighlightMenu editor={editor} />
          <ToolbarDivider />
          <ToolbarButton active={editor.isActive("bulletList")} label="无序列表" onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("orderedList")} label="有序列表" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("taskList")} label="任务列表" onClick={() => editor.chain().focus().toggleTaskList().run()}>
            <CheckSquare />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("blockquote")} label="引用" onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <Quote />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("codeBlock")} label="代码块" onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
            <Code2 />
          </ToolbarButton>
          <ToolbarDivider />
          <AlignmentMenu editor={editor} />
          <LinkDialog editor={editor} />
          <ImageDialog editor={editor} />
          <ToolbarDivider />
          <ToolbarButton active={editor.isActive("superscript")} label="上标" onClick={() => editor.chain().focus().toggleSuperscript().run()}>
            <SuperscriptIcon />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("subscript")} label="下标" onClick={() => editor.chain().focus().toggleSubscript().run()}>
            <SubscriptIcon />
          </ToolbarButton>
          <ToolbarButton label="清除格式" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>
            <RemoveFormatting />
          </ToolbarButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-editor-canvas px-3 py-4 sm:px-6 sm:py-7 lg:px-10">
        <article className="editor-page mx-auto min-h-[calc(100vh-10rem)] max-w-[56rem] rounded-xl border border-border/80 bg-editor-paper px-6 py-8 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] sm:px-10 sm:py-11 lg:px-16 lg:py-14">
          <input
            aria-label="文档标题"
            className="mb-8 w-full border-0 bg-transparent text-3xl font-bold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/60 sm:text-4xl"
            onChange={(event) => renameNode(documentNode.id, event.target.value)}
            placeholder="未命名文档"
            value={documentNode.name}
          />
          <EditorContent editor={editor} />
        </article>
      </div>

      <footer className="flex h-8 shrink-0 items-center justify-between border-t border-border bg-background/90 px-4 text-[11px] text-muted-foreground backdrop-blur">
        <span>{saveState === "saving" ? "正在保存…" : "已保存到本地"}</span>
        <span>{wordCount} 字 · HTML</span>
      </footer>
    </section>
  )
}

function countWords(text: string) {
  const normalized = text.trim()
  if (!normalized) return 0
  const chinese = normalized.match(/[\u3400-\u9fff]/g)?.length ?? 0
  const latin = normalized.replace(/[\u3400-\u9fff]/g, " ").match(/[\p{L}\p{N}]+/gu)?.length ?? 0
  return chinese + latin
}

function FileTextPlaceholder() {
  return (
    <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-border bg-card shadow-sm">
      <Pilcrow className="size-6 text-muted-foreground" />
    </div>
  )
}
