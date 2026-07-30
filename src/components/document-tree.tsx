import * as React from "react"
import {
  hotkeysCoreFeature,
  renamingFeature,
  selectionFeature,
  syncDataLoaderFeature,
} from "@headless-tree/core"
import { useTree } from "@headless-tree/react"
import {
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  SearchX,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/store/workspace-store"
import type { WorkspaceNode } from "@/types/document"

const resolveStateUpdate = <T,>(value: T | ((current: T) => T), current: T) =>
  typeof value === "function" ? (value as (current: T) => T)(current) : value

export function DocumentTree() {
  const nodes = useWorkspaceStore((state) => state.nodes)
  const activeDocumentId = useWorkspaceStore((state) => state.activeDocumentId)
  const expandedItems = useWorkspaceStore((state) => state.expandedItems)
  const searchQuery = useWorkspaceStore((state) => state.searchQuery)
  const setExpandedItems = useWorkspaceStore((state) => state.setExpandedItems)
  const selectDocument = useWorkspaceStore((state) => state.selectDocument)
  const renameNode = useWorkspaceStore((state) => state.renameNode)

  const tree = useTree<WorkspaceNode>({
    rootItemId: "root",
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => item.getItemData().type === "folder",
    dataLoader: {
      getItem: (itemId) => nodes[itemId],
      getChildren: (itemId) => nodes[itemId]?.children ?? [],
    },
    state: { expandedItems },
    setExpandedItems: (value) =>
      setExpandedItems(resolveStateUpdate(value, expandedItems)),
    onPrimaryAction: (item) => {
      if (item.getItemData().type === "document") selectDocument(item.getId())
    },
    onRename: (item, value) => renameNode(item.getId(), value),
    canRename: (item) => item.getId() !== "root",
    features: [
      syncDataLoaderFeature,
      selectionFeature,
      hotkeysCoreFeature,
      renamingFeature,
    ],
  })

  React.useEffect(() => {
    tree.scheduleRebuildTree()
  }, [nodes, tree])

  const query = searchQuery.trim().toLocaleLowerCase()
  const items = tree.getItems().filter((item) => {
    if (!query) return true
    const node = item.getItemData()
    return node.name.toLocaleLowerCase().includes(query)
  })

  if (query && items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sidebar-foreground/55">
        <SearchX className="size-5" aria-hidden="true" />
        <p className="text-xs">No matching documents</p>
      </div>
    )
  }

  return (
    <div
      {...tree.getContainerProps()}
      aria-label="Document directory"
      className="flex min-w-0 flex-col gap-0.5 outline-none"
    >
      {items.map((item) => {
        const node = item.getItemData()
        const isFolder = node.type === "folder"
        const isActive = node.id === activeDocumentId
        const level = Math.max(0, item.getItemMeta().level - 1)

        return (
          <div
            {...item.getProps()}
            key={item.getId()}
            className={cn(
              "group/tree-item relative flex h-8 min-w-0 cursor-default items-center gap-1.5 rounded-md pr-2 text-sm outline-none transition-colors",
              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
              item.isFocused() && !isActive && "bg-sidebar-accent/65",
            )}
            style={{ paddingLeft: `${8 + level * 14}px` }}
            onDoubleClick={(event) => {
              item.getProps().onDoubleClick?.(event)
              if (item.getId() !== "root") item.startRenaming()
            }}
          >
            {isFolder ? (
              <ChevronRight
                className={cn(
                  "size-3.5 shrink-0 text-sidebar-foreground/50 transition-transform",
                  item.isExpanded() && "rotate-90",
                )}
                aria-hidden="true"
              />
            ) : (
              <span className="w-3.5 shrink-0" />
            )}

            {isFolder ? (
              item.isExpanded() ? (
                <FolderOpen className="size-4 shrink-0 text-amber-600/80" aria-hidden="true" />
              ) : (
                <Folder className="size-4 shrink-0 text-amber-600/80" aria-hidden="true" />
              )
            ) : (
              <FileText className="size-4 shrink-0 text-sidebar-foreground/55" aria-hidden="true" />
            )}

            {item.isRenaming() ? (
              <input
                {...item.getRenameInputProps()}
                className="h-6 min-w-0 flex-1 rounded border border-sidebar-ring bg-sidebar px-1.5 text-sm outline-none"
                onClick={(event) => event.stopPropagation()}
              />
            ) : (
              <span className="min-w-0 flex-1 truncate">{node.name}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
