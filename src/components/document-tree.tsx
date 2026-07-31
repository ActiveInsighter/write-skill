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

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { MAX_NODE_NAME_LENGTH } from "@/lib/workspace-snapshot"
import { useWorkspaceStore } from "@/store/workspace-store"
import type { WorkspaceNode, WorkspaceNodes } from "@/types/document"

const resolveStateUpdate = <T,>(value: T | ((current: T) => T), current: T) =>
  typeof value === "function" ? (value as (current: T) => T)(current) : value

const isNodeInsideSubtree = (
  nodes: WorkspaceNodes,
  nodeId: string,
  subtreeRootId: string,
) => {
  const visited = new Set<string>()
  let currentId: string | null = nodeId

  while (currentId && !visited.has(currentId)) {
    if (currentId === subtreeRootId) return true
    visited.add(currentId)
    currentId = nodes[currentId]?.parentId ?? null
  }
  return false
}

const getNodePath = (nodes: WorkspaceNodes, nodeId: string) => {
  const path: string[] = []
  const visited = new Set<string>()
  let parentId = nodes[nodeId]?.parentId ?? null

  while (parentId && parentId !== "root" && !visited.has(parentId)) {
    visited.add(parentId)
    const parent = nodes[parentId]
    if (!parent) break
    path.unshift(parent.name)
    parentId = parent.parentId
  }

  return path.length > 0 ? path.join(" / ") : "Workspace"
}

const hasTreeDataChanged = (previous: WorkspaceNodes, next: WorkspaceNodes) => {
  const previousIds = Object.keys(previous)
  const nextIds = Object.keys(next)
  if (previousIds.length !== nextIds.length) return true

  for (const nodeId of previousIds) {
    const previousNode = previous[nodeId]
    const nextNode = next[nodeId]
    if (!nextNode) return true

    if (
      previousNode.name !== nextNode.name ||
      previousNode.type !== nextNode.type ||
      previousNode.parentId !== nextNode.parentId ||
      previousNode.children.length !== nextNode.children.length ||
      previousNode.children.some((childId, index) => childId !== nextNode.children[index])
    ) {
      return true
    }
  }

  return false
}

const menuPopupClassName =
  "min-w-52 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl outline-none transition duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"
const menuItemClassName =
  "flex h-9 cursor-default select-none items-center gap-2 rounded-lg px-2.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
const menuShortcutClassName = "ml-auto text-[0.68rem] tracking-wide text-muted-foreground"
const folderIconClassName = "text-sidebar-foreground/60"
const fileIconClassName = "text-sidebar-foreground/48"

export function DocumentTree() {
  const { isMobile, setOpenMobile } = useSidebar()
  const [nodes, setNodes] = React.useState(() => useWorkspaceStore.getState().nodes)
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null)
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
  const deferredSearchQuery = React.useDeferredValue(searchQuery)

  const openDocument = React.useCallback(
    (documentId: string) => {
      selectDocument(documentId)
      if (isMobile) setOpenMobile(false)
    },
    [isMobile, selectDocument, setOpenMobile],
  )

  const createAndOpenDocument = React.useCallback(
    (parentId?: string) => {
      createDocument(parentId)
      if (isMobile) setOpenMobile(false)
    },
    [createDocument, isMobile, setOpenMobile],
  )

  React.useEffect(
    () =>
      useWorkspaceStore.subscribe((state, previousState) => {
        if (
          state.nodes !== previousState.nodes &&
          hasTreeDataChanged(previousState.nodes, state.nodes)
        ) {
          setNodes(state.nodes)
        }
      }),
    [],
  )

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
      if (item.getItemData().type === "document") openDocument(item.getId())
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

  const query = deferredSearchQuery.trim().toLocaleLowerCase()
  const searchResults = React.useMemo(
    () =>
      query
        ? Object.values(nodes).filter((node) => {
            if (node.id === "root") return false
            const searchableText = `${node.name} ${getNodePath(nodes, node.id)}`.toLocaleLowerCase()
            return searchableText.includes(query)
          })
        : [],
    [nodes, query],
  )

  const openSearchResult = (node: WorkspaceNode) => {
    const foldersToExpand: string[] = []
    const visited = new Set<string>()
    let currentId: string | null = node.type === "folder" ? node.id : node.parentId

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId)
      if (nodes[currentId]?.type === "folder") foldersToExpand.push(currentId)
      currentId = nodes[currentId]?.parentId ?? null
    }

    setExpandedItems(Array.from(new Set([...expandedItems, ...foldersToExpand])))
    if (node.type === "document") openDocument(node.id)
    setSearchQuery("")
  }

  if (query) {
    if (searchResults.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sidebar-foreground/55">
          <SearchX className="size-5" aria-hidden="true" />
          <p className="text-xs">No matching documents or folders</p>
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
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              {isFolder ? (
                <Folder className={cn("size-4 shrink-0", folderIconClassName)} aria-hidden="true" />
              ) : (
                <FileText className={cn("size-4 shrink-0", fileIconClassName)} aria-hidden="true" />
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

  const treeItems = tree.getItems()
  const pendingDeleteNode = pendingDeleteId ? nodes[pendingDeleteId] : undefined
  const deleteDescription = pendingDeleteNode
    ? pendingDeleteNode.type === "folder" && pendingDeleteNode.children.length > 0
      ? `“${pendingDeleteNode.name}” and everything inside it will be removed from this workspace.`
      : `“${pendingDeleteNode.name}” will be removed from this workspace.`
    : "This item will be removed from the workspace."

  return (
    <div
      {...tree.getContainerProps()}
      aria-label="Document directory"
      className="relative flex min-h-24 min-w-0 flex-col gap-0.5 outline-none"
    >
      <AssistiveTreeDescription tree={tree} />

      {treeItems.length === 0 && (
        <div className="mx-1 flex flex-col items-center rounded-xl border border-dashed border-sidebar-border bg-sidebar-accent/25 px-4 py-7 text-center">
          <FileText className="size-5 text-sidebar-foreground/45" aria-hidden="true" />
          <p className="mt-2 text-xs font-medium text-sidebar-foreground/75">Workspace is empty</p>
          <p className="mt-1 text-[0.68rem] leading-5 text-sidebar-foreground/45">
            Create a document or folder to begin.
          </p>
          <div className="mt-3 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => createAndOpenDocument()}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-sidebar-primary px-2 text-[0.68rem] font-medium text-sidebar-primary-foreground outline-none hover:bg-sidebar-primary/85 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <FilePlus2 className="size-3" aria-hidden="true" />
              Document
            </button>
            <button
              type="button"
              onClick={() => createFolder()}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-sidebar-border bg-sidebar px-2 text-[0.68rem] font-medium outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <FolderPlus className="size-3" aria-hidden="true" />
              Folder
            </button>
          </div>
        </div>
      )}

      {treeItems.map((item) => {
        const node = item.getItemData()
        const isFolder = node.type === "folder"
        const isActive = node.id === activeDocumentId
        const level = Math.max(0, item.getItemMeta().level - 1)
        const itemProps = item.getProps()

        return (
          <ContextMenu.Root key={item.getId()}>
            <ContextMenu.Trigger
              {...itemProps}
              aria-current={isActive ? "page" : undefined}
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
                className="document-tree-drag-handle flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-sidebar-foreground/30 opacity-0 transition hover:bg-sidebar-accent hover:text-sidebar-foreground/70 active:cursor-grabbing group-focus-within/tree-item:opacity-100 group-hover/tree-item:opacity-100"
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
                  <FolderOpen
                    className={cn("size-4 shrink-0", folderIconClassName)}
                    aria-hidden="true"
                  />
                ) : (
                  <Folder
                    className={cn("size-4 shrink-0", folderIconClassName)}
                    aria-hidden="true"
                  />
                )
              ) : (
                <FileText
                  className={cn("size-4 shrink-0", fileIconClassName)}
                  aria-hidden="true"
                />
              )}

              {item.isRenaming() ? (
                <input
                  {...item.getRenameInputProps()}
                  maxLength={MAX_NODE_NAME_LENGTH}
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
                        onClick={() => createAndOpenDocument(node.id)}
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
                    onClick={() => setPendingDeleteId(node.id)}
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

      <ConfirmDialog
        open={Boolean(pendingDeleteNode)}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null)
        }}
        title={pendingDeleteNode?.type === "folder" ? "Delete folder?" : "Delete document?"}
        description={deleteDescription}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (pendingDeleteId) deleteNode(pendingDeleteId)
        }}
      />
    </div>
  )
}
