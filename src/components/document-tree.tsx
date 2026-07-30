import * as React from "react"
import {
  createOnDropHandler,
  dragAndDropFeature,
  hotkeysCoreFeature,
  renamingFeature,
  selectionFeature,
  syncDataLoaderFeature,
} from "@headless-tree/core"
import { useTree } from "@headless-tree/react"
import { Menu } from "@base-ui/react/menu"
import {
  ChevronRight,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ROOT_ID, type WorkspaceNode, useWorkspaceStore } from "@/stores/workspace"

export function DocumentTree() {
  const nodes = useWorkspaceStore((state) => state.nodes)
  const activeDocumentId = useWorkspaceStore((state) => state.activeDocumentId)
  const setActiveDocument = useWorkspaceStore((state) => state.setActiveDocument)
  const addDocument = useWorkspaceStore((state) => state.addDocument)
  const addFolder = useWorkspaceStore((state) => state.addFolder)
  const renameNode = useWorkspaceStore((state) => state.renameNode)
  const deleteNode = useWorkspaceStore((state) => state.deleteNode)
  const replaceChildren = useWorkspaceStore((state) => state.replaceChildren)
  const [query, setQuery] = React.useState("")

  const tree = useTree<WorkspaceNode>({
    rootItemId: ROOT_ID,
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => item.getItemData().type === "folder",
    dataLoader: {
      getItem: (itemId) => nodes[itemId],
      getChildren: (itemId) => nodes[itemId]?.children ?? [],
    },
    indent: 16,
    canReorder: true,
    onPrimaryAction: (item) => {
      const data = item.getItemData()
      if (data.type === "document") setActiveDocument(data.id)
    },
    onRename: (item, value) => renameNode(item.getId(), value),
    canRename: (item) => item.getId() !== ROOT_ID,
    onDrop: createOnDropHandler((item, newChildren) => {
      replaceChildren(item.getId(), newChildren)
    }),
    features: [
      syncDataLoaderFeature,
      selectionFeature,
      hotkeysCoreFeature,
      renamingFeature,
      dragAndDropFeature,
    ],
  })

  React.useEffect(() => {
    tree.scheduleRebuildTree()
  }, [nodes, tree])

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleItems = tree.getItems().filter((item) => {
    if (!normalizedQuery) return true
    return item.getItemName().toLocaleLowerCase().includes(normalizedQuery)
  })

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            aria-label="搜索文档"
            className="h-8 w-full rounded-md border border-sidebar-border bg-sidebar-accent/55 pl-8 pr-3 text-xs outline-none transition focus:border-sidebar-ring focus:ring-2 focus:ring-sidebar-ring/20"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索文档"
            value={query}
          />
        </div>
        <Button aria-label="新建文档" onClick={() => addDocument(ROOT_ID)} size="icon-sm" variant="ghost">
          <FilePlus2 />
        </Button>
        <Button aria-label="新建文件夹" onClick={() => addFolder(ROOT_ID)} size="icon-sm" variant="ghost">
          <FolderPlus />
        </Button>
      </div>

      <div
        {...tree.getContainerProps()}
        aria-label="文档目录"
        className="relative min-h-0 flex-1 overflow-y-auto px-1 pb-3 outline-none"
      >
        {visibleItems.length === 0 ? (
          <div className="mx-1 mt-6 rounded-lg border border-dashed border-sidebar-border px-3 py-6 text-center text-xs text-muted-foreground">
            没有匹配的文档
          </div>
        ) : null}

        {visibleItems.map((item) => {
          const data = item.getItemData()
          const isFolder = data.type === "folder"
          const isActive = data.id === activeDocumentId
          const level = item.getItemMeta().level

          return (
            <div
              {...item.getProps()}
              className={cn(
                "group relative my-0.5 flex h-8 cursor-default items-center gap-1 rounded-md pr-1 text-[13px] outline-none transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/30",
                item.isFocused() && "bg-sidebar-accent/80",
                isActive && "bg-sidebar-primary/12 font-medium text-sidebar-primary",
                item.isDragTarget() && "ring-2 ring-sidebar-ring/35",
              )}
              key={item.getId()}
              style={{ paddingLeft: `${Math.max(level - 1, 0) * 16 + 4}px` }}
            >
              <button
                aria-label={item.isExpanded() ? "折叠文件夹" : "展开文件夹"}
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-sm text-muted-foreground transition hover:bg-sidebar-accent-foreground/8 hover:text-foreground",
                  !isFolder && "invisible",
                )}
                onClick={(event) => {
                  event.stopPropagation()
                  if (!isFolder) return
                  if (item.isExpanded()) item.collapse()
                  else item.expand()
                }}
                type="button"
              >
                <ChevronRight className={cn("size-3.5 transition-transform", item.isExpanded() && "rotate-90")} />
              </button>

              {isFolder ? (
                item.isExpanded() ? <FolderOpen className="size-4 text-amber-500" /> : <Folder className="size-4 text-amber-500" />
              ) : (
                <FileText className={cn("size-4 text-muted-foreground", isActive && "text-sidebar-primary")} />
              )}

              {item.isRenaming() ? (
                <input
                  {...item.getRenameInputProps()}
                  className="h-6 min-w-0 flex-1 rounded border border-sidebar-ring bg-background px-1.5 text-xs outline-none ring-2 ring-sidebar-ring/20"
                />
              ) : (
                <span className="min-w-0 flex-1 truncate">{data.name}</span>
              )}

              <Menu.Root>
                <Menu.Trigger
                  aria-label={`${data.name} 的操作`}
                  className="grid size-6 shrink-0 place-items-center rounded opacity-0 outline-none transition hover:bg-sidebar-accent-foreground/10 focus-visible:opacity-100 group-hover:opacity-100 data-[popup-open]:bg-sidebar-accent-foreground/10 data-[popup-open]:opacity-100"
                  onClick={(event) => event.stopPropagation()}
                >
                  <MoreHorizontal className="size-3.5" />
                </Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner className="z-50" sideOffset={6}>
                    <Menu.Popup className="w-44 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-xl outline-none">
                      {isFolder ? (
                        <>
                          <Menu.Item className="menu-item" onClick={() => addDocument(data.id)}>
                            <FilePlus2 /> 新建文档
                          </Menu.Item>
                          <Menu.Item className="menu-item" onClick={() => addFolder(data.id)}>
                            <FolderPlus /> 新建文件夹
                          </Menu.Item>
                        </>
                      ) : null}
                      <Menu.Item className="menu-item" onClick={() => item.startRenaming()}>
                        <Pencil /> 重命名
                      </Menu.Item>
                      <Menu.Separator className="my-1 h-px bg-border" />
                      <Menu.Item
                        className="menu-item text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
                        onClick={() => deleteNode(data.id)}
                      >
                        <Trash2 /> 删除
                      </Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </div>
          )
        })}

        <div
          className="pointer-events-none absolute left-0 right-0 h-0.5 rounded-full bg-sidebar-primary shadow-[0_0_0_1px_var(--sidebar)]"
          style={tree.getDragLineStyle()}
        />
      </div>
    </div>
  )
}
