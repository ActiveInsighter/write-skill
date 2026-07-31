import {
  CircleAlert,
  Cloud,
  CloudOff,
  FilePlus2,
  FolderPlus,
  LoaderCircle,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react"

import { DocumentTree } from "@/components/document-tree"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { retryCloudSync } from "@/lib/cloud-sync"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/store/workspace-store"
import type { CloudSyncStatus } from "@/types/document"

const cloudStatusDetails: Record<
  CloudSyncStatus,
  { label: string; detail: string; icon: typeof Cloud; className?: string }
> = {
  local: { label: "Local workspace", detail: "Waiting for cloud connection", icon: CloudOff },
  connecting: { label: "Connecting", detail: "Opening D1 workspace", icon: LoaderCircle },
  syncing: { label: "Syncing changes", detail: "Saving to Cloudflare D1", icon: LoaderCircle },
  synced: {
    label: "Cloud synced",
    detail: "Local cache and D1 are current",
    icon: Cloud,
    className: "text-emerald-600",
  },
  offline: {
    label: "Working offline",
    detail: "Changes remain in this browser",
    icon: CloudOff,
    className: "text-amber-600",
  },
  conflict: {
    label: "Sync conflict",
    detail: "Choose a copy in the editor",
    icon: CircleAlert,
    className: "text-amber-600",
  },
  error: {
    label: "Cloud sync error",
    detail: "Local changes are still safe",
    icon: CircleAlert,
    className: "text-destructive",
  },
}

export function AppSidebar() {
  const { isMobile, setOpenMobile } = useSidebar()
  const searchQuery = useWorkspaceStore((store) => store.searchQuery)
  const setSearchQuery = useWorkspaceStore((store) => store.setSearchQuery)
  const createDocument = useWorkspaceStore((store) => store.createDocument)
  const createFolder = useWorkspaceStore((store) => store.createFolder)
  const cloudStatus = useWorkspaceStore((store) => store.cloudStatus)
  const cloudError = useWorkspaceStore((store) => store.cloudError)
  const cloudDetails = cloudStatusDetails[cloudStatus]
  const CloudIcon = cloudDetails.icon
  const isCloudBusy = cloudStatus === "connecting" || cloudStatus === "syncing"
  const canRetryCloud =
    cloudStatus === "local" || cloudStatus === "offline" || cloudStatus === "error"

  const createAndOpenDocument = () => {
    createDocument()
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="offcanvas" variant="sidebar">
      <SidebarHeader className="gap-3 border-b border-sidebar-border px-3 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex aspect-square size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Sparkles className="size-4" aria-hidden="true" />
          </div>
          <div className="grid min-w-0 flex-1 text-left leading-tight">
            <span className="truncate text-sm font-semibold tracking-[-0.01em]">Write Skill</span>
            <span className="truncate text-xs text-sidebar-foreground/55">Document workspace</span>
          </div>
          <SidebarTrigger
            className="size-8 shrink-0 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Toggle sidebar"
            title="Toggle sidebar (Ctrl+B)"
          />
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-sidebar-foreground/45"
            aria-hidden="true"
          />
          <SidebarInput
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search documents and folders"
            aria-label="Search documents and folders"
            className="h-9 rounded-lg border-sidebar-border bg-sidebar-accent/45 px-9 text-xs placeholder:text-sidebar-foreground/40 focus-visible:ring-sidebar-ring [&::-webkit-search-cancel-button]:hidden"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              title="Clear search"
              className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-sidebar-foreground/45 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-hidden">
        <SidebarGroup className="min-h-0 flex-1 gap-1 px-2 py-3">
          <div className="flex h-8 items-center justify-between px-2">
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-sidebar-foreground/45">
              Documents
            </span>
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                onClick={createAndOpenDocument}
                aria-label="Create document"
                title="Create document"
              >
                <FilePlus2 className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                onClick={() => createFolder()}
                aria-label="Create folder"
                title="Create folder"
              >
                <FolderPlus className="size-3.5" />
              </Button>
            </div>
          </div>

          <SidebarGroupContent className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-0.5 pb-3">
            <DocumentTree />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-3 py-3">
        <div
          className="flex min-w-0 items-center gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent/35 px-2.5 py-2"
          title={cloudError ?? cloudDetails.detail}
        >
          <CloudIcon
            className={cn(
              "size-4 shrink-0 text-sidebar-foreground/55",
              cloudDetails.className,
              isCloudBusy && "animate-spin",
            )}
            aria-hidden="true"
          />
          <div className="grid min-w-0 flex-1 text-left leading-tight">
            <span className="truncate text-xs font-medium">{cloudDetails.label}</span>
            <span className="truncate text-[0.68rem] text-sidebar-foreground/45">
              {cloudError ?? cloudDetails.detail}
            </span>
          </div>
          {canRetryCloud && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={retryCloudSync}
              aria-label="Retry cloud sync"
              title="Retry cloud sync"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
