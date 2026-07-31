import path from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const rootDirectory = path.dirname(fileURLToPath(import.meta.url))

const resolveVendorChunk = (id: string) => {
  if (!id.includes("node_modules")) return undefined

  if (id.includes("/@tiptap/") || id.includes("/prosemirror-")) {
    return "editor-core"
  }

  if (
    id.includes("/@headless-tree/") ||
    id.includes("/@base-ui/") ||
    id.includes("/@floating-ui/") ||
    id.includes("/@radix-ui/")
  ) {
    return "workspace-ui"
  }

  if (
    id.includes("/react/") ||
    id.includes("/react-dom/") ||
    id.includes("/scheduler/")
  ) {
    return "react-vendor"
  }

  return undefined
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(rootDirectory, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: resolveVendorChunk,
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
})
