import type { JSONContent } from "@tiptap/core"

import type { WorkspaceNodes } from "@/types/document"

const now = new Date().toISOString()

const paragraph = (text: string): JSONContent => ({
  type: "paragraph",
  content: text ? [{ type: "text", text }] : undefined,
})

const heading = (text: string, level = 1): JSONContent => ({
  type: "heading",
  attrs: { level },
  content: [{ type: "text", text }],
})

const bulletList = (items: string[]): JSONContent => ({
  type: "bulletList",
  content: items.map((item) => ({
    type: "listItem",
    content: [paragraph(item)],
  })),
})

const documentContent = (
  title: string,
  intro: string,
  items: string[],
): JSONContent => ({
  type: "doc",
  content: [
    heading(title),
    paragraph(intro),
    heading("Focus", 2),
    bulletList(items),
    paragraph("Start editing here. Your changes are saved locally in this browser."),
  ],
})

export const initialWorkspaceNodes: WorkspaceNodes = {
  root: {
    id: "root",
    parentId: null,
    type: "folder",
    name: "Workspace",
    children: ["folder-product", "folder-research", "doc-inbox"],
    updatedAt: now,
  },
  "folder-product": {
    id: "folder-product",
    parentId: "root",
    type: "folder",
    name: "Product",
    children: ["doc-product-brief", "doc-roadmap"],
    updatedAt: now,
  },
  "doc-product-brief": {
    id: "doc-product-brief",
    parentId: "folder-product",
    type: "document",
    name: "Product brief",
    children: [],
    content: documentContent(
      "Product brief",
      "A calm space for shaping the next version of Write Skill.",
      [
        "Fast, distraction-free writing",
        "A navigable document hierarchy",
        "A clean boundary for future Cloudflare sync",
      ],
    ),
    updatedAt: now,
  },
  "doc-roadmap": {
    id: "doc-roadmap",
    parentId: "folder-product",
    type: "document",
    name: "Roadmap",
    children: [],
    content: documentContent(
      "Roadmap",
      "A lightweight plan from local-first prototype to a cloud workspace.",
      ["Front-end workspace", "Worker API", "D1 persistence", "Sharing and history"],
    ),
    updatedAt: now,
  },
  "folder-research": {
    id: "folder-research",
    parentId: "root",
    type: "folder",
    name: "Research",
    children: ["doc-reading-notes"],
    updatedAt: now,
  },
  "doc-reading-notes": {
    id: "doc-reading-notes",
    parentId: "folder-research",
    type: "document",
    name: "Reading notes",
    children: [],
    content: documentContent(
      "Reading notes",
      "Capture useful ideas and turn them into durable knowledge.",
      ["Summarize the central claim", "Record evidence", "Write one practical next step"],
    ),
    updatedAt: now,
  },
  "doc-inbox": {
    id: "doc-inbox",
    parentId: "root",
    type: "document",
    name: "Inbox",
    children: [],
    content: documentContent(
      "Inbox",
      "A quick place for ideas before they find a permanent home.",
      ["Capture first", "Organize later", "Keep the next action visible"],
    ),
    updatedAt: now,
  },
}
