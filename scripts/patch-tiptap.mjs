import { readFile, writeFile } from "node:fs/promises"

const filePath = process.env.SIMPLE_EDITOR_PATH
if (!filePath) throw new Error("SIMPLE_EDITOR_PATH is not set")
let source = await readFile(filePath, "utf8")

if (source.includes("export interface SimpleEditorProps")) {
  console.log("Simple Editor already supports workspace props.")
  process.exit(0)
}

source = source.replace(
  'import { EditorContent, EditorContext, useEditor } from "@tiptap/react"',
  'import type { JSONContent } from "@tiptap/core"\nimport { EditorContent, EditorContext, useEditor } from "@tiptap/react"',
)
source = source.replace(
  'import content from "@/components/tiptap-templates/simple/data/content.json"',
  'import starterContent from "@/components/tiptap-templates/simple/data/content.json"',
)
source = source.replace(
  "export function SimpleEditor() {",
  `export interface SimpleEditorProps {\n  content?: JSONContent\n  onUpdate?: (content: JSONContent) => void\n}\n\nexport function SimpleEditor({ content, onUpdate }: SimpleEditorProps) {`,
)
source = source.replace(
  /^\s*content,\s*$/m,
  `    content: content ?? starterContent,\n    onUpdate: ({ editor }) => onUpdate?.(editor.getJSON()),`,
)

const requiredFragments = [
  "export interface SimpleEditorProps",
  "content: content ?? starterContent",
  "onUpdate?.(editor.getJSON())",
]

for (const fragment of requiredFragments) {
  if (!source.includes(fragment)) {
    throw new Error(`Could not patch Simple Editor: missing ${fragment}`)
  }
}

await writeFile(filePath, source)
console.log("Patched Simple Editor with controlled document content callbacks.")
