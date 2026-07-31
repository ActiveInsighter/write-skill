import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"

const THEME_STORAGE_KEY = "write-skill-theme"
type ThemePreference = "light" | "dark" | null

const readThemePreference = (): ThemePreference => {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return value === "light" || value === "dark" ? value : null
  } catch {
    return null
  }
}

const applyTheme = (isDarkMode: boolean) => {
  document.documentElement.classList.toggle("dark", isDarkMode)
  document.documentElement.style.colorScheme = isDarkMode ? "dark" : "light"
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute("content", isDarkMode ? "#1b1a18" : "#f8f7f4")
}

export function ThemeToggle({ className }: { className?: string }) {
  const [themePreference, setThemePreference] = useState<ThemePreference>(readThemePreference)
  const systemDarkMode = useMediaQuery("(prefers-color-scheme: dark)")
  const isDarkMode =
    themePreference === "dark" || (themePreference === null && systemDarkMode)

  useEffect(() => {
    applyTheme(isDarkMode)
  }, [isDarkMode])

  const toggleDarkMode = () => {
    const nextPreference: Exclude<ThemePreference, null> = isDarkMode ? "light" : "dark"

    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextPreference)
    } catch {
      // The visual preference still applies for this session.
    }

    setThemePreference(nextPreference)
  }

  const nextTheme = isDarkMode ? "light" : "dark"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-7 shrink-0", className)}
      onClick={toggleDarkMode}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      {isDarkMode ? (
        <Sun className="size-3.5" aria-hidden="true" />
      ) : (
        <Moon className="size-3.5" aria-hidden="true" />
      )}
    </Button>
  )
}
