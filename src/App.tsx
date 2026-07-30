import { AppSidebar } from "@/components/app-sidebar"
import { EditorWorkspace } from "@/components/editor-workspace"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function App() {
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset className="min-h-svh overflow-hidden bg-transparent">
        <EditorWorkspace />
      </SidebarInset>
    </SidebarProvider>
  )
}
