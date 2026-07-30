import {
  Cloud,
  FilePlus2,
  FolderPlus,
  LibraryBig,
  Search,
  Sparkles,
} from "lucide-react"

import { DocumentTree } from "@/components/document-tree"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { useWorkspaceStore } from "@/store/workspace-store"

export function AppSidebar() {
  const { state } = useSidebar()
  const searchQuery = useWorkspaceStore((store) => store.searchQuery)
  const setSearchQuery = useWorkspaceStore((store) => store.setSearchQuery)
  const createDocument = useWorkspaceStore((store) => store.createDocument)
  const createFolder = useWorkspaceStore((store) => store.createFolder)

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="gap-3 border-b border-sidebar-border/70 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="hover:bg-transparent active:bg-transparent">
              <div className="flex aspect-square size-8 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
                <Sparkles className="size-4" aria-hidden="true" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold tracking-[-0.01em]">Write Skill</span>
                <span className="truncate text-xs text-sidebar-foreground/55">Local workspace</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {state !== "collapsed" && (
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-sidebar-foreground/45"
              aria-hidden="true"
            />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search documents"
              aria-label="Search documents"
              className="h-8 border-sidebar-border bg-sidebar-accent/45 pl-8 text-xs shadow-none placeholder:text-sidebar-foreground/40"
            />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="min-h-0 flex-1">
          <div className="mb-1 flex items-center justify-between px-2">
            <SidebarGroupLabel className="px-0 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/45">
              Documents
            </SidebarGroupLabel>
            {state !== "collapsed" && (
              <div className="flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-sidebar-foreground/55 hover:text-sidebar-foreground"
                  onClick={() => createDocument()}
                  aria-label="Create document"
                  title="Create document"
                >
                  <FilePlus2 className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-sidebar-foreground/55 hover:text-sidebar-foreground"
                  onClick={() => createFolder()}
                  aria-label="Create folder"
                  title="Create folder"
                >
                  <FolderPlus className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
          <SidebarGroupContent className="min-h-0 overflow-y-auto px-1">
            {state === "collapsed" ? (
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Documents">
                    <LibraryBig />
                    <span>Documents</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            ) : (
              <DocumentTree />
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/70">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="h-auto min-h-9 py-2" tooltip="Cloud sync coming next">
              <Cloud className="text-sidebar-foreground/50" />
              <div className="grid flex-1 text-left text-xs leading-tight">
                <span className="font-medium">Stored locally</span>
                <span className="text-[0.68rem] text-sidebar-foreground/45">Worker + D1 ready next</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
