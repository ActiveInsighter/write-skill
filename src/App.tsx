import { useState, type CSSProperties } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { EditorWorkspace } from "@/components/editor-workspace"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

const SIDEBAR_COOKIE_NAME = "sidebar_state"
const SIDEBAR_STYLE = {
  "--sidebar-width": "17.5rem",
  "--sidebar-width-mobile": "19rem",
} as CSSProperties

const readSidebarOpenState = () => {
  if (typeof document === "undefined") return true

  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${SIDEBAR_COOKIE_NAME}=`))

  if (!cookie) return true
  return cookie.slice(SIDEBAR_COOKIE_NAME.length + 1) !== "false"
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarOpenState)

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      className="h-dvh min-h-0 overflow-hidden"
      style={SIDEBAR_STYLE}
    >
      <AppSidebar />
      <SidebarInset className="h-dvh min-h-0 min-w-0 overflow-hidden bg-background">
        <EditorWorkspace />
      </SidebarInset>
    </SidebarProvider>
  )
}
