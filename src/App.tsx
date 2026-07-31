import type { CSSProperties } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { EditorWorkspace } from "@/components/editor-workspace"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function App() {
  return (
    <SidebarProvider
      defaultOpen
      className="h-dvh min-h-0 overflow-hidden"
      style={{ "--sidebar-width": "17.5rem" } as CSSProperties}
    >
      <AppSidebar />
      <SidebarInset className="h-dvh min-h-0 min-w-0 overflow-hidden bg-background">
        <EditorWorkspace />
      </SidebarInset>
    </SidebarProvider>
  )
}
