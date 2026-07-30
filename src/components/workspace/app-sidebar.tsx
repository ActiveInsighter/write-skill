import { Fragment, useEffect, useMemo, useState } from "react"
import {
  createOnDropHandler,
  dragAndDropFeature,
  hotkeysCoreFeature,
  keyboardDragAndDropFeature,
  renamingFeature,
  searchFeature,
  selectionFeature,
  syncDataLoaderFeature,
} from "@headless-tree/core"
import { AssistiveTreeDescription, useTree } from "@headless-tree/react"
import {
  BookOpenText,
  ChevronRight,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  type WorkspaceNode,
  useWorkspaceStore,
} from "@/features/workspace/workspace-store"
import { cn } from "@/lib/utils"

const DEFAULT_EXPANDED_ITEMS = ["start", "examples"]

function findParentId(nodes: Record<string, WorkspaceNode>, childId: string) {
  return (
    Object.values(nodes).find((node) => node.children?.includes(childId))?.id ??
    "root"
  )
}

export function AppSidebar() {
  const nodes = useWorkspaceStore((state) => state.nodes)
  const selectedDocumentId = useWorkspaceStore(
    (state) => state.selectedDocumentId,
  )
  const selectDocument = useWorkspaceStore((state) => state.selectDocument)
  const createDocument = useWorkspaceStore((state) => state.createDocument)
  const createFolder = useWorkspaceStore((state) => state.createFolder)
  const deleteNode = useWorkspaceStore((state) => state.deleteNode)
  const renameNode = useWorkspaceStore((state) => state.renameNode)
  const replaceChildren = useWorkspaceStore((state) => state.replaceChildren)
  const { state: sidebarState, setOpen, setOpenMobile, isMobile } = useSidebar()
  const collapsed = sidebarState === "collapsed"

  const [expandedItems, setExpandedItems] = useState<string[]>(
    DEFAULT_EXPANDED_ITEMS,
  )
  const [selectedItems, setSelectedItems] = useState<string[]>([
    selectedDocumentId,
  ])
  const activeItemId = selectedItems.at(-1) ?? selectedDocumentId

  const dataLoader = useMemo(
    () => ({
      getItem: (itemId: string) => nodes[itemId],
      getChildren: (itemId: string) => nodes[itemId]?.children ?? [],
    }),
    [nodes],
  )

  const tree = useTree<WorkspaceNode>({
    rootItemId: "root",
    state: { expandedItems, selectedItems },
    setExpandedItems,
    setSelectedItems,
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => item.getItemData().kind === "folder",
    dataLoader,
    indent: 18,
    canReorder: true,
    canRename: (item) => item.getId() !== "root",
    onDrop: createOnDropHandler((item, newChildren) => {
      replaceChildren(item.getId(), newChildren)
    }),
    onRename: (item, value) => renameNode(item.getId(), value),
    onPrimaryAction: (item) => {
      setSelectedItems([item.getId()])
      if (item.isFolder()) {
        if (item.isExpanded()) item.collapse()
        else item.expand()
      } else {
        selectDocument(item.getId())
        if (isMobile) setOpenMobile(false)
      }
    },
    features: [
      syncDataLoaderFeature,
      selectionFeature,
      hotkeysCoreFeature,
      dragAndDropFeature,
      keyboardDragAndDropFeature,
      renamingFeature,
      searchFeature,
    ],
  })

  useEffect(() => {
    tree.scheduleRebuildTree()
  }, [nodes, tree])

  useEffect(() => {
    setSelectedItems([selectedDocumentId])
  }, [selectedDocumentId])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") {
        return
      }
      const target = event.target as HTMLElement | null
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], [role="textbox"]',
        )
      ) {
        return
      }
      event.preventDefault()
      setOpen(true)
      tree.openSearch()
    }
    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [setOpen, tree])

  const getTargetFolder = () => {
    const activeNode = nodes[activeItemId]
    if (activeNode?.kind === "folder") return activeNode.id
    if (activeNode?.kind === "document") return findParentId(nodes, activeNode.id)
    return "root"
  }

  const handleCreateDocument = () => {
    const parentId = getTargetFolder()
    setExpandedItems((items) =>
      items.includes(parentId) ? items : [...items, parentId],
    )
    const id = createDocument(parentId)
    setSelectedItems([id])
    if (isMobile) setOpenMobile(false)
  }

  const handleCreateFolder = () => {
    const parentId = getTargetFolder()
    setExpandedItems((items) =>
      items.includes(parentId) ? items : [...items, parentId],
    )
    const id = createFolder(parentId)
    setSelectedItems([id])
  }

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`确定删除“${name}”吗？文件夹中的内容也会被删除。`)) {
      return
    }
    deleteNode(id)
    setExpandedItems((items) => items.filter((itemId) => itemId !== id))
  }

  const documentCount = Object.values(nodes).filter(
    (node) => node.kind === "document",
  ).length

  return (
    <Sidebar collapsible="icon" aria-label="文档目录">
      <SidebarHeader className="gap-3 border-b border-sidebar-border/80 p-3">
        <div className="flex h-10 items-center gap-2.5 overflow-hidden">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20">
            <Sparkles className="size-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight">
                Write Skill
              </p>
              <p className="truncate text-[11px] text-sidebar-foreground/55">
                文档技能工作台
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            className={cn("shrink-0", collapsed && "mx-auto")}
            aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
            onClick={() => setOpen(collapsed)}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        </div>

        {!collapsed && (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Button className="justify-start" onClick={handleCreateDocument}>
              <FilePlus2 />
              新建文档
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="新建文件夹"
              title="新建文件夹"
              onClick={handleCreateFolder}
            >
              <FolderPlus />
            </Button>
          </div>
        )}
      </SidebarHeader>

      {collapsed ? (
        <SidebarContent className="items-center gap-2 px-2 py-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="新建文档"
                aria-label="新建文档"
                onClick={handleCreateDocument}
              >
                <FilePlus2 />
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="搜索目录"
                aria-label="搜索目录"
                onClick={() => {
                  setOpen(true)
                  window.setTimeout(() => tree.openSearch(), 0)
                }}
              >
                <Search />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      ) : (
        <SidebarContent>
          <div className="px-3 pt-3">
            <div className="flex h-9 items-center rounded-lg border border-sidebar-border bg-sidebar-accent/35 px-2.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
              <Search className="size-4 shrink-0 text-sidebar-foreground/45" />
              {tree.isSearchOpen() ? (
                <>
                  <input
                    {...tree.getSearchInputElementProps()}
                    autoFocus
                    className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-sidebar-foreground/40"
                    placeholder="搜索文档或文件夹"
                  />
                  <button
                    type="button"
                    className="rounded p-0.5 text-sidebar-foreground/45 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    aria-label="关闭搜索"
                    onClick={() => tree.closeSearch()}
                  >
                    <X className="size-3.5" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center justify-between pl-2 text-left text-sm text-sidebar-foreground/55"
                  onClick={() => tree.openSearch()}
                >
                  <span>搜索目录</span>
                  <kbd className="rounded border border-sidebar-border bg-sidebar px-1.5 py-0.5 text-[10px]">
                    ⌘K
                  </kbd>
                </button>
              )}
            </div>
          </div>

          <SidebarGroup className="min-h-0 flex-1 pt-2">
            <SidebarGroupLabel className="justify-between">
              <span>文档目录</span>
              <span className="normal-case tracking-normal">
                {tree.isSearchOpen()
                  ? `${tree.getSearchMatchingItems().length} 项匹配`
                  : `${documentCount} 篇`}
              </span>
            </SidebarGroupLabel>
            <SidebarGroupContent className="min-h-0 flex-1 overflow-auto px-1 pb-3">
              <div
                {...tree.getContainerProps()}
                className="relative min-w-0 outline-none"
              >
                <AssistiveTreeDescription tree={tree} />
                {tree.getItems().map((item) => {
                  const node = item.getItemData()
                  const isFolder = item.isFolder()
                  const isActive = item.getId() === selectedDocumentId
                  return (
                    <Fragment key={item.getId()}>
                      {item.isRenaming() ? (
                        <div
                          className="my-0.5 pr-2"
                          style={{
                            paddingLeft: `${item.getItemMeta().level * 18 + 31}px`,
                          }}
                        >
                          <input
                            {...item.getRenameInputProps()}
                            className="h-8 w-full rounded-md border border-ring bg-background px-2 text-sm text-foreground outline-none ring-2 ring-ring/20"
                          />
                        </div>
                      ) : (
                        <div
                          {...item.getProps()}
                          className={cn(
                            "group/tree-item relative my-0.5 flex h-8 cursor-default select-none items-center gap-1 rounded-md pr-1 text-sm outline-none transition-colors",
                            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                            isActive &&
                              "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                            item.isFocused() && "ring-2 ring-ring/30",
                            item.isMatchingSearch() && "text-primary",
                            item.isDragTarget() && "bg-primary/10 ring-1 ring-primary/40",
                          )}
                          style={{
                            paddingLeft: `${item.getItemMeta().level * 18 + 4}px`,
                          }}
                          onDoubleClick={() => item.startRenaming()}
                        >
                          <span className="flex size-4 shrink-0 items-center justify-center text-sidebar-foreground/45">
                            {isFolder && (
                              <ChevronRight
                                className={cn(
                                  "size-3.5 transition-transform",
                                  item.isExpanded() && "rotate-90",
                                )}
                              />
                            )}
                          </span>
                          <span className="flex size-4 shrink-0 items-center justify-center text-sidebar-foreground/60">
                            {isFolder ? (
                              item.isExpanded() ? (
                                <FolderOpen className="size-4" />
                              ) : (
                                <Folder className="size-4" />
                              )
                            ) : (
                              <FileText className="size-4" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{node.name}</span>
                          <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/tree-item:opacity-100 group-focus-within/tree-item:opacity-100">
                            <button
                              type="button"
                              className="rounded p-1 text-sidebar-foreground/45 hover:bg-sidebar hover:text-sidebar-foreground"
                              aria-label={`重命名 ${node.name}`}
                              title="重命名"
                              onClick={(event) => {
                                event.stopPropagation()
                                setSelectedItems([item.getId()])
                                item.startRenaming()
                              }}
                            >
                              <Pencil className="size-3" />
                            </button>
                            <button
                              type="button"
                              className="rounded p-1 text-sidebar-foreground/45 hover:bg-destructive/10 hover:text-destructive"
                              aria-label={`删除 ${node.name}`}
                              title="删除"
                              onClick={(event) => {
                                event.stopPropagation()
                                handleDelete(item.getId(), node.name)
                              }}
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </span>
                        </div>
                      )}
                    </Fragment>
                  )
                })}
                <div
                  className="pointer-events-none absolute h-0.5 rounded-full bg-primary"
                  style={tree.getDragLineStyle()}
                />
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      )}

      <SidebarFooter className="border-t border-sidebar-border/80">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="本地工作区" className="text-xs">
              <span className="relative flex size-4 items-center justify-center">
                <BookOpenText className="size-4" />
                <span className="absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full bg-emerald-500 ring-2 ring-sidebar" />
              </span>
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 truncate text-left">
                    本地工作区
                  </span>
                  <MoreHorizontal className="text-sidebar-foreground/40" />
                </>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
