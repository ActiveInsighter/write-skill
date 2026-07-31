import * as React from "react"
import { ContextMenu } from "@base-ui/react/context-menu"
import {
  dragAndDropFeature,
  hotkeysCoreFeature,
  isOrderedDragTarget,
  keyboardDragAndDropFeature,
  renamingFeature,
  selectionFeature,
  syncDataLoaderFeature,
} from "@headless-tree/core"
import { AssistiveTreeDescription, useTree } from "@headless-tree/react"
import {
  ChevronRight,
  Copy,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  GripVertical,
  Pencil,
  SearchX,
  Trash2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/store/workspace-store"
import type { WorkspaceNode, WorkspaceNodes } from "@/types/document"

const resolveStateUpdate = <T,>(value: T | ((current: T) => T), current: T) =>
  typeof value === "function" ? (value as (current: T) => T)(current) : value

const isNodeInsideSubtree = (
  nodes: WorkspaceNodes,
  nodeId: string,
  subtreeRootId: string,
) => {
  let currentId: string | null = nodeId
  while (currentId) {
    if (currentId === subtreeRootId) return true
    currentId = nodes[currentId]?.parentId ?? null
  }
  return false
}

const getNodePath = (nodes: WorkspaceNodes, nodeId: string) => {
  const path: string[] = []
  let parentId = nodes[nodeId]?.parentId ?? null

  while (parentId && parentId !== "root") {
    const parent = nodes[parentId]
    if (!parent) break
    path.unshift(parent.name)
    parentId = parent.parentId
  }

  return path.length > 0 ? path.join(" / ") : "Workspace"
}

const menuPopupClassName =
  "min-w-52 rounded-lg border bg-popover p-1.5 text-popover-foreground shadow-lg outline-none"
const menuItemClassName =
  "flex h-9 cursor-default select-none items-center gap-2 rounded-md px-2.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
const menuShortcutClassName = "ml-auto text-[0.68rem] tracking-wide text-muted-foreground"

export function DocumentTree() {
  const nodes = useWorkspaceStore((state) => state.nodes)
  const activeDocumentId = useWorkspaceStore((state) => state.activeDocumentId)
  const expandedItems = useWorkspaceStore((state) => state.expandedItems)
  const searchQuery = useWorkspaceStore((state) => state.searchQuery)
  const setSearchQuery = useWorkspaceStore((state) => state.setSearchQuery)
  const setExpandedItems = useWorkspaceStore((state) => state.setExpandedItems)
  const selectDocument = useWorkspaceStore((state) => state.selectDocument)
  const renameNode = useWorkspaceStore((state) => state.renameNode)
  const createDocument = useWorkspaceStore((state) => state.createDocument)
  const createFolder = useWorkspaceStore((state) => state.createFolder)
  const duplicateNode = useWorkspaceStore((state) => state.duplicateNode)
  const moveNodes = useWorkspaceStore((state) => state.moveNodes)
  const deleteNode = useWorkspaceStore((state) => state.deleteNode)

  const tree = useTree<WorkspaceNode>({
    rootItemId: "root",
    indent: 18,
    canReorder: true,
    seperateDragHandle: true,
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => item.getItemData().type === "folder",
    dataLoader: {
      getItem: (itemId) => nodes[itemId],
      getChildren: (itemId) => nodes[itemId]?.children ?? [],
    },
    state: { expandedItems },
    setExpandedItems: (value) => setExpandedItems(resolveStateUpdate(value, expandedItems)),
    onPrimaryAction: (item) => {
      if (item.getItemData().type === "document") selectDocument(item.getId())
    },
    onRename: (item, value) => renameNode(item.getId(), value),
    canRename: (item) => item.getId() !== "root",
    canDrag: (items) =>
      searchQuery.trim().length === 0 && items.every((item) => item.getId() !== "root"),
    canDrop: (items, target) => {
      const parentId = target.item.getId()
      if (nodes[parentId]?.type !== "folder") return false

      return items.every(
        (item) =>
          item.getId() !== parentId && !isNodeInsideSubtree(nodes, parentId, item.getId()),
      )
    },
    onDrop: (items, target) => {
      moveNodes(
        items.map((item) => item.getId()),
        target.item.getId(),
        isOrderedDragTarget(target) ? target.insertionIndex : undefined,
      )
    },
    features: [
      syncDataLoaderFeature,
      selectionFeature,
      hotkeysCoreFeature,
      renamingFeature,
      dragAndDropFeature,
      keyboardDragAndDropFeature,
    ],
  })

  React.useEffect(() => {
    tree.scheduleRebuildTree()
  }, [nodes, tree])

  const query = searchQuery.trim().toLocaleLowerCase()
  const searchResults = React.useMemo(
    () =>
      query
        ? Object.values(nodes).filter(
            (node) => node.id !== "root" && node.name.toLocaleLowerCase().includes(query),
          )
        : [],
    [nodes, query],
  )

  const openSearchResult = (node: WorkspaceNode) => {
    const foldersToExpand: string[] = []
    let currentId: string | null = node.type === "folder" ? node.id : node.parentId

    while (currentId) {
      if (nodes[currentId]?.type === "folder") foldersToExpand.push(currentId)
      currentId = nodes[currentId]?.parentId ?? null
    }

    setExpandedItems(Array.from(new Set([...expandedItems, ...foldersToExpand])))
    if (node.type === "document") selectDocument(node.id)
    setSearchQuery("")
  }

  if (query) {
    if (searchResults.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sidebar-foreground/55">
          <SearchX className="size-5" aria-hidden="true" />
          <p className="text-xs">No matching documents</p>
        </div>
      )
    }

    return (
      <div className="flex min-w-0 flex-col gap-1" aria-label="Document search results">
        <p className="px-2 pb-1 text-[0.68rem] text-sidebar-foreground/45">
          {searchResults.length} {searchResults.length === 1 ? "result" : "results"}
        </p>
        {searchResults.map((node) => {
          const isFolder = node.type === "folder"
          const isActive = node.id === activeDocumentId

          return (
            <button
              key={node.id}
              type="button"
              onClick={() => openSearchResult(node)}
              className={cn(
                "flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              {isFolder ? (
                <Folder className="size-4 shrink-0 text-amber-600/85" aria-hidden="true" />
              ) : (
                <FileText className="size-4 shrink-0 text-sidebar-foreground/55" aria-hidden="true" />
              )}
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate text-sm">{node.name}</span>
                <span className="truncate text-[0.68rem] text-sidebar-foreground/45">
                  {getNodePath(nodes, node.id)}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div
      {...tree.getContainerProps()}
      aria-label="Document directory"
      className="relative flex min-h-24 min-w-0 flex-col gap-0.5 outline-none"
    >
      <AssistiveTreeDescription tree={tree} />

      {tree.getItems().map((item) => {
        const node = item.getItemData()
        const isFolder = node.type === "folder"
        const isActive = node.id === activeDocumentId
        const level = Math.max(0, item.getItemMeta().level - 1)
        const itemProps = item.getProps()

        const requestDelete = () => {
          const description =
            isFolder && node.children.length > 0
              ? `Delete “${node.name}” and everything inside it?`
              : `Delete “${node.name}”?`
          if (window.confirm(description)) deleteNode(node.id)
        }

        return (
          <ContextMenu.Root key={item.getId()}>
            <ContextMenu.Trigger
              {...itemProps}
              className={cn(
                "group/tree-item relative flex h-9 min-w-0 cursor-default items-center gap-1 rounded-lg pr-1.5 text-sm outline-none transition-[background-color,color,box-shadow]",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                isActive &&
                  "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--sidebar-border)_70%,transparent)]",
                item.isFocused() && !isActive && "bg-sidebar-accent/65",
                item.isDragTarget() && "bg-primary/10 ring-1 ring-primary/45",
              )}
              style={{ paddingLeft: `${5 + level * 16}px` }}
              onDoubleClick={(event) => {
                itemProps.onDoubleClick?.(event)
                if (item.getId() !== "root") item.startRenaming()
              }}
            >
              <span
                {...item.getDragHandleProps()}
                aria-label={`Drag ${node.name}`}
                title="Drag to move"
                className="flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-sidebar-foreground/30 opacity-0 transition hover:bg-sidebar-accent hover:text-sidebar-foreground/70 active:cursor-grabbing group-focus-within/tree-item:opacity-100 group-hover/tree-item:opacity-100"
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
              >
                <GripVertical className="size-3.5" aria-hidden="true" />
              </span>

              {isFolder ? (
                <ChevronRight
                  className={cn(
                    "size-3.5 shrink-0 text-sidebar-foreground/45 transition-transform",
                    item.isExpanded() && "rotate-90",
                  )}
                  aria-hidden="true"
                />
              ) : (
                <span className="w-3.5 shrink-0" />
              )}

              {isFolder ? (
                item.isExpanded() ? (
                  <FolderOpen className="size-4 shrink-0 text-amber-600/85" aria-hidden="true" />
                ) : (
                  <Folder className="size-4 shrink-0 text-amber-600/85" aria-hidden="true" />
                )
              ) : (
                <FileText className="size-4 shrink-0 text-sidebar-foreground/55" aria-hidden="true" />
              )}

              {item.isRenaming() ? (
                <input
                  {...item.getRenameInputProps()}
                  className="h-7 min-w-0 flex-1 rounded-md border border-sidebar-ring bg-sidebar px-2 text-sm outline-none ring-2 ring-sidebar-ring/20"
                  onClick={(event) => event.stopPropagation()}
                />
              ) : (
                <span className="min-w-0 flex-1 truncate">{node.name}</span>
              )}
            </ContextMenu.Trigger>

            <ContextMenu.Portal>
              <ContextMenu.Positioner className="z-[100] outline-none" sideOffset={5}>
                <ContextMenu.Popup className={menuPopupClassName}>
                  {isFolder && (
                    <>
                      <ContextMenu.Item
                        className={menuItemClassName}
                        onClick={() => createDocument(node.id)}
                      >
                        <FilePlus2 className="size-4 text-muted-foreground" />
                        New document
                      </ContextMenu.Item>
                      <ContextMenu.Item
                        className={menuItemClassName}
                        onClick={() => createFolder(node.id)}
                      >
                        <FolderPlus className="size-4 text-muted-foreground" />
                        New folder
                      </ContextMenu.Item>
                      <ContextMenu.Separator className="my-1 h-px bg-border" />
                    </>
                  )}

                  <ContextMenu.Item
                    className={menuItemClassName}
                    onClick={() => duplicateNode(node.id)}
                  >
                    <Copy className="size-4 text-muted-foreground" />
                    Duplicate
                  </ContextMenu.Item>
                  <ContextMenu.Item
                    className={menuItemClassName}
                    onClick={() => queueMicrotask(() => item.startRenaming())}
                  >
                    <Pencil className="size-4 text-muted-foreground" />
                    Rename
                    <span className={menuShortcutClassName}>F2</span>
                  </ContextMenu.Item>

                  <ContextMenu.Separator className="my-1 h-px bg-border" />
                  <ContextMenu.Item
                    className={cn(
                      menuItemClassName,
                      "text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive",
                    )}
                    onClick={requestDelete}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </ContextMenu.Item>
                </ContextMenu.Popup>
              </ContextMenu.Positioner>
            </ContextMenu.Portal>
          </ContextMenu.Root>
        )
      })}

      <div
        style={tree.getDragLineStyle()}
        className="pointer-events-none z-30 h-0.5 rounded-full bg-primary shadow-[0_0_0_1px_color-mix(in_oklab,var(--sidebar)_75%,transparent)] before:absolute before:-left-1 before:-top-[3px] before:size-2 before:rounded-full before:border-2 before:border-primary before:bg-sidebar"
      />
    </div>
  )
}
