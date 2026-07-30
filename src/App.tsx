import { useEffect } from "react"
import { ThemeProvider } from "next-themes"
import { SimpleEditor } from "@/components/editor/simple-editor"
import { AppSidebar } from "@/components/workspace/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { initializeCloudSync } from "@/features/workspace/cloud-sync"

function Workspace() {
  useEffect(() => {
    void initializeCloudSync()
  }, [])

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset className="h-svh overflow-hidden">
        <SimpleEditor />
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="write-skill-theme"
    >
      <TooltipProvider>
        <Workspace />
      </TooltipProvider>
    </ThemeProvider>
  )
}
