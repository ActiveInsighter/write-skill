import * as React from "react"
import { Tooltip } from "@base-ui/react/tooltip"
import { BookOpenText, Cloud, MoonStar, Sparkles, Sun, WifiOff } from "lucide-react"

import { DocumentTree } from "@/components/document-tree"
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useWorkspaceStore } from "@/stores/workspace"

export default function App() {
  const theme = useWorkspaceStore((state) => state.theme)
  const toggleTheme = useWorkspaceStore((state) => state.toggleTheme)
  const activeDocument = useWorkspaceStore((state) => state.nodes[state.activeDocumentId])

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    document.documentElement.style.colorScheme = theme
  }, [theme])

  return (
    <Tooltip.Provider delay={350}>
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2.5 rounded-lg px-1 py-0.5">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm shadow-sidebar-primary/20">
                <BookOpenText className="size-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold tracking-tight">Write Skill</span>
                  <Sparkles className="size-3.5 text-sidebar-primary" />
                </div>
                <p className="truncate text-[11px] text-muted-foreground">本地优先的文档工作台</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <DocumentTree />
          </SidebarContent>

          <SidebarFooter>
            <div className="flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/45 px-2.5 py-2">
              <div className="grid size-7 place-items-center rounded-md bg-background text-muted-foreground shadow-xs">
                <WifiOff className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">本地模式</p>
                <p className="truncate text-[10px] text-muted-foreground">Worker 与 D1 接口预留中</p>
              </div>
            </div>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="flex h-svh min-h-0 flex-col bg-background">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/90 px-3 backdrop-blur-xl sm:px-4">
            <SidebarTrigger />
            <div className="h-5 w-px bg-border" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{activeDocument?.name ?? "Write Skill"}</p>
              <p className="hidden truncate text-[10px] text-muted-foreground sm:block">
                工作区 / 文档 · 自动保存
              </p>
            </div>
            <div className="hidden items-center gap-1.5 rounded-full border border-border bg-muted/45 px-2.5 py-1 text-[10px] text-muted-foreground sm:flex">
              <Cloud className="size-3" />
              Cloudflare 待接入
            </div>
            <Tooltip.Root>
              <Tooltip.Trigger
                aria-label={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
                render={
                  <Button onClick={toggleTheme} size="icon-sm" variant="ghost">
                    {theme === "dark" ? <Sun /> : <MoonStar />}
                  </Button>
                }
              />
              <Tooltip.Portal>
                <Tooltip.Positioner className="z-50" sideOffset={8}>
                  <Tooltip.Popup className="tooltip-popup">
                    {theme === "dark" ? "浅色模式" : "深色模式"}
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </header>

          <div className="min-h-0 flex-1">
            <SimpleEditor />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </Tooltip.Provider>
  )
}
