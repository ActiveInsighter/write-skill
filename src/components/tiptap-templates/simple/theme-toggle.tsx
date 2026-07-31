import { useEffect, useState } from "react"

import { Button } from "@/components/tiptap-ui-primitive/button"
import { MoonStarIcon } from "@/components/tiptap-icons/moon-star-icon"
import { SunIcon } from "@/components/tiptap-icons/sun-icon"

const THEME_STORAGE_KEY = "write-skill-theme"
type ThemePreference = "light" | "dark" | null

const readThemePreference = (): ThemePreference => {
  const value = localStorage.getItem(THEME_STORAGE_KEY)
  return value === "light" || value === "dark" ? value : null
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
    document.documentElement.classList.toggle("dark", isDarkMode)
    document.documentElement.style.colorScheme = isDarkMode ? "dark" : "light"
  }, [isDarkMode])

  const toggleDarkMode = () => {
    const nextPreference: Exclude<ThemePreference, null> = isDarkMode ? "light" : "dark"
    localStorage.setItem(THEME_STORAGE_KEY, nextPreference)
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
