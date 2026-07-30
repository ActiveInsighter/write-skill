import * as React from "react"
import { PanelLeft } from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

const SIDEBAR_WIDTH = "18rem"
const SIDEBAR_WIDTH_ICON = "3.75rem"

type SidebarContextValue = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) throw new Error("useSidebar must be used within SidebarProvider")
  return context
}

function SidebarProvider({
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isMobile = useIsMobile()
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const [openMobile, setOpenMobile] = React.useState(false)
  const open = controlledOpen ?? uncontrolledOpen

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      onOpenChange?.(nextOpen)
      if (controlledOpen === undefined) setUncontrolledOpen(nextOpen)
      try {
        window.localStorage.setItem("write-skill-sidebar-open", String(nextOpen))
      } catch {
        // Storage can be unavailable in privacy-restricted contexts.
      }
    },
    [controlledOpen, onOpenChange],
  )

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) setOpenMobile((value) => !value)
    else setOpen(!open)
  }, [isMobile, open, setOpen])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [toggleSidebar])

  const value = React.useMemo<SidebarContextValue>(
    () => ({
      state: open ? "expanded" : "collapsed",
      open,
      setOpen,
      openMobile,
      setOpenMobile,
      isMobile,
      toggleSidebar,
    }),
    [isMobile, open, openMobile, setOpen, toggleSidebar],
  )

  return (
    <SidebarContext.Provider value={value}>
      <div
        data-slot="sidebar-wrapper"
        style={
          {
            "--sidebar-width": SIDEBAR_WIDTH,
            "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
            ...style,
          } as React.CSSProperties
        }
        className={cn("flex min-h-svh w-full bg-background", className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

function Sidebar({
  className,
  children,
  collapsible = "icon",
  ...props
}: React.ComponentProps<"aside"> & {
  collapsible?: "offcanvas" | "icon" | "none"
}) {
  const { state, isMobile, openMobile, setOpenMobile } = useSidebar()
  const collapsed = collapsible !== "none" && state === "collapsed"

  if (isMobile) {
    return (
      <>
        {openMobile && (
          <button
            type="button"
            aria-label="关闭侧边栏"
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden"
            onClick={() => setOpenMobile(false)}
          />
        )}
        <aside
          data-slot="sidebar"
          data-mobile="true"
          data-state={openMobile ? "expanded" : "collapsed"}
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-[min(88vw,20rem)] -translate-x-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl transition-transform duration-200 md:hidden",
            openMobile && "translate-x-0",
            className,
          )}
          {...props}
        >
          {children}
        </aside>
      </>
    )
  }

  return (
    <aside
      data-slot="sidebar"
      data-state={state}
      data-collapsible={collapsed ? collapsible : ""}
      className={cn(
        "sticky top-0 hidden h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
        collapsed ? "w-(--sidebar-width-icon)" : "w-(--sidebar-width)",
        collapsible === "offcanvas" && collapsed && "w-0 overflow-hidden border-r-0",
        className,
      )}
      {...props}
    >
      {children}
    </aside>
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col p-3", className)} {...props} />
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col p-3", className)} {...props} />
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("relative flex min-w-0 flex-col px-2", className)} {...props} />
}

function SidebarGroupLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex h-8 items-center px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/50 data-[collapsed=true]:hidden",
        className,
      )}
      {...props}
    />
  )
}

function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("w-full", className)} {...props} />
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("flex min-w-0 flex-col gap-1", className)} {...props} />
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li className={cn("group/menu-item relative", className)} {...props} />
}

function SidebarMenuButton({
  className,
  isActive,
  tooltip,
  ...props
}: ButtonProps & { isActive?: boolean; tooltip?: string }) {
  const { state, isMobile } = useSidebar()
  const button = (
    <Button
      variant="ghost"
      className={cn(
        "h-9 w-full justify-start overflow-hidden px-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
        state === "collapsed" && "justify-center px-0",
        className,
      )}
      {...props}
    />
  )

  if (!tooltip || state !== "collapsed" || isMobile) return button

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

function SidebarTrigger({ className, ...props }: ButtonProps) {
  const { toggleSidebar } = useSidebar()
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={className}
      onClick={toggleSidebar}
      aria-label="切换侧边栏"
      {...props}
    >
      <PanelLeft />
    </Button>
  )
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      className={cn("relative flex min-w-0 flex-1 flex-col bg-background", className)}
      {...props}
    />
  )
}

function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar()
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label="切换侧边栏"
      title="切换侧边栏"
      onClick={toggleSidebar}
      className={cn(
        "absolute inset-y-0 -right-2 z-20 hidden w-4 cursor-col-resize after:absolute after:inset-y-0 after:left-1/2 after:w-px after:bg-transparent hover:after:bg-sidebar-border md:block",
        className,
      )}
      {...props}
    />
  )
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
}
