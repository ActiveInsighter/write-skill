import type { Editor } from "@tiptap/react"
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Code2,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Underline as UnderlineIcon,
  Undo2,
  X,
} from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const HIGHLIGHT_COLORS = [
  { label: "黄色", value: "#fde68a" },
  { label: "绿色", value: "#bbf7d0" },
  { label: "蓝色", value: "#bfdbfe" },
  { label: "紫色", value: "#ddd6fe" },
  { label: "粉色", value: "#fbcfe8" },
]

type ToolbarButtonProps = {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: ToolbarButtonProps) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        "rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
        active && "bg-accent text-foreground shadow-xs",
      )}
      onClick={onClick}
    >
      {children}
    </Button>
  )

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function ToolbarSeparator() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />
}

function ToolbarGroup({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 items-center gap-0.5">{children}</div>
}

function HeadingMenu({ editor }: { editor: Editor | null }) {
  const currentLabel = editor?.isActive("heading", { level: 1 })
    ? "标题 1"
    : editor?.isActive("heading", { level: 2 })
      ? "标题 2"
      : editor?.isActive("heading", { level: 3 })
        ? "标题 3"
        : editor?.isActive("heading", { level: 4 })
          ? "标题 4"
          : "正文"

  return (
    <details className="group relative">
      <summary className="flex h-8 min-w-20 cursor-pointer list-none items-center justify-between gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 [&::-webkit-details-marker]:hidden">
        <span>{currentLabel}</span>
        <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute left-0 top-10 z-40 w-32 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-xl">
        <button
          type="button"
          className="flex h-8 w-full items-center rounded-md px-2 text-sm hover:bg-accent"
          onClick={(event) => {
            editor?.chain().focus().setParagraph().run()
            event.currentTarget.closest("details")?.removeAttribute("open")
          }}
        >
          正文
        </button>
        {([1, 2, 3, 4] as const).map((level) => (
          <button
            type="button"
            key={level}
            className={cn(
              "flex h-8 w-full items-center rounded-md px-2 text-sm hover:bg-accent",
              editor?.isActive("heading", { level }) && "bg-accent",
            )}
            onClick={(event) => {
              editor?.chain().focus().toggleHeading({ level }).run()
              event.currentTarget.closest("details")?.removeAttribute("open")
            }}
          >
            标题 {level}
          </button>
        ))}
      </div>
    </details>
  )
}

export function HighlightPanel({
  editor,
  onClose,
}: {
  editor: Editor | null
  onClose: () => void
}) {
  return (
    <div className="flex min-w-56 flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">高亮颜色</span>
        <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="关闭">
          <X />
        </Button>
      </div>
      <div className="grid grid-cols-6 gap-2">
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color.value}
            type="button"
            aria-label={color.label}
            title={color.label}
            className="size-7 rounded-full border border-black/10 shadow-xs outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring"
            style={{ backgroundColor: color.value }}
            onClick={() => {
              editor?.chain().focus().toggleHighlight({ color: color.value }).run()
              onClose()
            }}
          />
        ))}
        <button
          type="button"
          aria-label="移除高亮"
          title="移除高亮"
          className="flex size-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-accent"
          onClick={() => {
            editor?.chain().focus().unsetHighlight().run()
            onClose()
          }}
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

export function LinkPanel({
  editor,
  value,
  onChange,
  onApply,
  onClose,
}: {
  editor: Editor | null
  value: string
  onChange: (value: string) => void
  onApply: () => void
  onClose: () => void
}) {
  return (
    <div className="flex min-w-72 flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">编辑链接</span>
        <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="关闭">
          <X />
        </Button>
      </div>
      <div className="flex gap-2">
        <input
          value={value}
          autoFocus
          aria-label="链接地址"
          placeholder="https://example.com"
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onApply()
          }}
        />
        <Button size="sm" onClick={onApply}>
          应用
        </Button>
      </div>
      {editor?.isActive("link") && (
        <button
          type="button"
          className="self-start text-xs text-destructive hover:underline"
          onClick={() => {
            editor.chain().focus().extendMarkRange("link").unsetLink().run()
            onClose()
          }}
        >
          移除当前链接
        </button>
      )}
    </div>
  )
}

export function MainToolbar({
  editor,
  isMobile,
  onOpenHighlight,
  onOpenLink,
  onImageUpload,
}: {
  editor: Editor | null
  isMobile: boolean
  onOpenHighlight: () => void
  onOpenLink: () => void
  onImageUpload: () => void
}) {
  return (
    <>
      <ToolbarGroup>
        <ToolbarButton
          label="撤销"
          disabled={!editor?.can().chain().focus().undo().run()}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 />
        </ToolbarButton>
        <ToolbarButton
          label="重做"
          disabled={!editor?.can().chain().focus().redo().run()}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 />
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <HeadingMenu editor={editor} />
        <ToolbarButton
          label="无序列表"
          active={editor?.isActive("bulletList")}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List />
        </ToolbarButton>
        <ToolbarButton
          label="有序列表"
          active={editor?.isActive("orderedList")}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </ToolbarButton>
        <ToolbarButton
          label="任务列表"
          active={editor?.isActive("taskList")}
          onClick={() => editor?.chain().focus().toggleTaskList().run()}
        >
          <ListChecks />
        </ToolbarButton>
        <ToolbarButton
          label="引用"
          active={editor?.isActive("blockquote")}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <Quote />
        </ToolbarButton>
        <ToolbarButton
          label="代码块"
          active={editor?.isActive("codeBlock")}
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
        >
          <Code2 />
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ToolbarButton
          label="加粗"
          active={editor?.isActive("bold")}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold />
        </ToolbarButton>
        <ToolbarButton
          label="斜体"
          active={editor?.isActive("italic")}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </ToolbarButton>
        <ToolbarButton
          label="删除线"
          active={editor?.isActive("strike")}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          <Strikethrough />
        </ToolbarButton>
        <ToolbarButton
          label="行内代码"
          active={editor?.isActive("code")}
          onClick={() => editor?.chain().focus().toggleCode().run()}
        >
          <Code2 />
        </ToolbarButton>
        <ToolbarButton
          label="下划线"
          active={editor?.isActive("underline")}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon />
        </ToolbarButton>
        <ToolbarButton
          label="高亮"
          active={editor?.isActive("highlight")}
          onClick={onOpenHighlight}
        >
          <Highlighter />
        </ToolbarButton>
        <ToolbarButton
          label="链接"
          active={editor?.isActive("link")}
          onClick={onOpenLink}
        >
          <Link2 />
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ToolbarButton
          label="上标"
          active={editor?.isActive("superscript")}
          onClick={() => editor?.chain().focus().toggleSuperscript().run()}
        >
          <SuperscriptIcon />
        </ToolbarButton>
        <ToolbarButton
          label="下标"
          active={editor?.isActive("subscript")}
          onClick={() => editor?.chain().focus().toggleSubscript().run()}
        >
          <SubscriptIcon />
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ToolbarButton
          label="左对齐"
          active={editor?.isActive({ textAlign: "left" })}
          onClick={() => editor?.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft />
        </ToolbarButton>
        <ToolbarButton
          label="居中"
          active={editor?.isActive({ textAlign: "center" })}
          onClick={() => editor?.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter />
        </ToolbarButton>
        <ToolbarButton
          label="右对齐"
          active={editor?.isActive({ textAlign: "right" })}
          onClick={() => editor?.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight />
        </ToolbarButton>
        <ToolbarButton
          label="两端对齐"
          active={editor?.isActive({ textAlign: "justify" })}
          onClick={() => editor?.chain().focus().setTextAlign("justify").run()}
        >
          <AlignJustify />
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ToolbarButton label="插入图片" onClick={onImageUpload}>
          <ImagePlus />
        </ToolbarButton>
        {!isMobile && (
          <ToolbarButton
            label="清除格式"
            onClick={() =>
              editor?.chain().focus().clearNodes().unsetAllMarks().run()
            }
          >
            <RemoveFormatting />
          </ToolbarButton>
        )}
      </ToolbarGroup>
    </>
  )
}
