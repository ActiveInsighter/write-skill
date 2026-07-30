import * as React from "react"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type SidebarContextValue = {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  toggle: () => void
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

export function SidebarProvider({
  defaultOpen = true,
  children,
}: React.PropsWithChildren<{ defaultOpen?: boolean }>) {
  const [open, setOpen] = React.useState(defaultOpen)
  const toggle = React.useCallback(() => setOpen((value) => !value), [])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault()
        toggle()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [toggle])

  return (
    <SidebarContext.Provider value={{ open, setOpen, toggle }}>
      <div className="flex min-h-svh w-full overflow-hidden bg-background">{children}</div>
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) throw new Error("useSidebar must be used inside SidebarProvider")
  return context
}

export function Sidebar({ className, children }: React.HTMLAttributes<HTMLElement>) {
  const { open, setOpen } = useSidebar()

  return (
    <>
      <button
        aria-label="关闭侧边栏"
        className={cn(
          "fixed inset-0 z-30 bg-black/35 backdrop-blur-[1px] transition-opacity md:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setOpen(false)}
      />
      <aside
        data-open={open}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[18.5rem] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl shadow-black/10 transition-transform duration-300 ease-out md:relative md:z-10 md:shadow-none",
          open ? "translate-x-0" : "-translate-x-full md:-ml-[18.5rem]",
          className,
        )}
      >
        {children}
      </aside>
    </>
  )
}

export function SidebarHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-sidebar-border p-3", className)} {...props} />
}

export function SidebarContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto p-2", className)} {...props} />
}

export function SidebarFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-t border-sidebar-border p-3", className)} {...props} />
}

export function SidebarInset({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <main className={cn("min-w-0 flex-1", className)} {...props} />
}

export function SidebarTrigger({ className }: { className?: string }) {
  const { open, toggle } = useSidebar()
  return (
    <Button
      aria-label={open ? "折叠侧边栏" : "展开侧边栏"}
      aria-pressed={open}
      className={className}
      onClick={toggle}
      size="icon-sm"
      variant="ghost"
    >
      {open ? <PanelLeftClose /> : <PanelLeftOpen />}
    </Button>
  )
}

export function SidebarRail() {
  const { open, toggle } = useSidebar()
  return (
    <button
      aria-label={open ? "折叠侧边栏" : "展开侧边栏"}
      className="absolute inset-y-0 right-0 hidden w-1 translate-x-1/2 cursor-col-resize transition-colors hover:bg-sidebar-ring md:block"
      onClick={toggle}
    />
  )
}
