import { ThemeProvider } from "next-themes"
import { SimpleEditor } from "@/components/editor/simple-editor"
import { AppSidebar } from "@/components/workspace/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

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
        <SidebarProvider defaultOpen>
          <AppSidebar />
          <SidebarInset className="h-svh overflow-hidden">
            <SimpleEditor />
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </ThemeProvider>
  )
}
