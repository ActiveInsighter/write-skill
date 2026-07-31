import { useEffect, useState } from "react"

import { Button } from "@/components/tiptap-ui-primitive/button"
import { MoonStarIcon } from "@/components/tiptap-icons/moon-star-icon"
import { SunIcon } from "@/components/tiptap-icons/sun-icon"

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

export function ThemeToggle() {
  const [themePreference, setThemePreference] = useState<ThemePreference>(readThemePreference)
  const [systemDarkMode, setSystemDarkMode] = useState(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  )
  const isDarkMode =
    themePreference === "dark" || (themePreference === null && systemDarkMode)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => setSystemDarkMode(mediaQuery.matches)
    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  useEffect(() => {
    applyTheme(isDarkMode)
  }, [isDarkMode])

  const toggleDarkMode = () => {
    const nextPreference: Exclude<ThemePreference, null> = isDarkMode ? "light" : "dark"
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextPreference)
    } catch {
      // The visual preference still applies for this session when storage is unavailable.
    }
    setThemePreference(nextPreference)
  }

  return (
    <Button
      onClick={toggleDarkMode}
      aria-label={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
      variant="ghost"
    >
      {isDarkMode ? (
        <SunIcon className="tiptap-button-icon" />
      ) : (
        <MoonStarIcon className="tiptap-button-icon" />
      )}
    </Button>
  )
}
