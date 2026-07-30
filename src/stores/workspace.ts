import { create } from "zustand"
import { persist } from "zustand/middleware"

import { createId } from "@/lib/utils"

export const ROOT_ID = "workspace-root"

export type WorkspaceNode = {
  id: string
  name: string
  type: "folder" | "document"
  children: string[]
  content: string
  updatedAt: number
}

type Theme = "light" | "dark"

type WorkspaceState = {
  nodes: Record<string, WorkspaceNode>
  activeDocumentId: string
  theme: Theme
  setActiveDocument: (id: string) => void
  addDocument: (parentId?: string) => string
  addFolder: (parentId?: string) => string
  renameNode: (id: string, name: string) => void
  deleteNode: (id: string) => void
  updateDocument: (id: string, content: string) => void
  replaceChildren: (id: string, children: string[]) => void
  toggleTheme: () => void
}

const now = Date.now()

const initialNodes: Record<string, WorkspaceNode> = {
  [ROOT_ID]: {
    id: ROOT_ID,
    name: "Write Skill",
    type: "folder",
    children: ["folder-inbox", "folder-projects", "folder-archive"],
    content: "",
    updatedAt: now,
  },
  "folder-inbox": {
    id: "folder-inbox",
    name: "快速开始",
    type: "folder",
    children: ["doc-welcome", "doc-shortcuts"],
    content: "",
    updatedAt: now,
  },
  "doc-welcome": {
    id: "doc-welcome",
    name: "欢迎使用 Write Skill",
    type: "document",
    children: [],
    updatedAt: now,
    content: `
      <h1>欢迎使用 Write Skill</h1>
      <p>这是一个面向长文写作与提示词管理的现代化网页文档编辑器。</p>
      <blockquote><p>所有内容目前保存在浏览器本地。后续可以无缝接入 Cloudflare Worker 与 D1。</p></blockquote>
      <h2>你现在可以做什么</h2>
      <ul>
        <li><p>在左侧目录中新建文件夹和文档</p></li>
        <li><p>拖拽目录项完成排序与移动</p></li>
        <li><p>使用工具栏编排标题、列表、引用、代码与图片</p></li>
        <li><p>切换明暗主题并自动保存内容</p></li>
      </ul>
      <h2>编辑器设计</h2>
      <p>右侧编辑区采用 Tiptap 3，并参考 Simple Editor Template 的响应式工具栏与轻量文档画布。</p>
    `,
  },
  "doc-shortcuts": {
    id: "doc-shortcuts",
    name: "常用快捷键",
    type: "document",
    children: [],
    updatedAt: now,
    content: `
      <h1>常用快捷键</h1>
      <p><strong>Ctrl / ⌘ + B</strong>：加粗</p>
      <p><strong>Ctrl / ⌘ + I</strong>：斜体</p>
      <p><strong>Ctrl / ⌘ + Shift + 7</strong>：有序列表</p>
      <p><strong>Ctrl / ⌘ + Shift + 8</strong>：无序列表</p>
      <p><strong>Ctrl / ⌘ + Z</strong>：撤销</p>
    `,
  },
  "folder-projects": {
    id: "folder-projects",
    name: "项目",
    type: "folder",
    children: ["doc-product-brief", "folder-research"],
    content: "",
    updatedAt: now,
  },
  "doc-product-brief": {
    id: "doc-product-brief",
    name: "产品构想",
    type: "document",
    children: [],
    updatedAt: now,
    content: `
      <h1>产品构想</h1>
      <p>打造一个简洁、快速、可扩展的云端写作工作台。</p>
      <h2>核心原则</h2>
      <ol>
        <li><p>写作优先，界面保持安静。</p></li>
        <li><p>目录与编辑器之间保持即时同步。</p></li>
        <li><p>前端状态与未来 D1 数据模型边界清晰。</p></li>
      </ol>
      <pre><code>// 后续：Worker API + D1 persistence</code></pre>
    `,
  },
  "folder-research": {
    id: "folder-research",
    name: "研究资料",
    type: "folder",
    children: ["doc-editor-notes"],
    content: "",
    updatedAt: now,
  },
  "doc-editor-notes": {
    id: "doc-editor-notes",
    name: "编辑器技术笔记",
    type: "document",
    children: [],
    updatedAt: now,
    content: `
      <h1>编辑器技术笔记</h1>
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>React 19 + Vite</p></div></li>
        <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Tailwind CSS 4 + shadcn tokens</p></div></li>
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Cloudflare Worker API</p></div></li>
      </ul>
    `,
  },
  "folder-archive": {
    id: "folder-archive",
    name: "归档",
    type: "folder",
    children: [],
    content: "",
    updatedAt: now,
  },
}

function collectDescendants(nodes: Record<string, WorkspaceNode>, id: string, result = new Set<string>()) {
  const node = nodes[id]
  if (!node || result.has(id)) return result
  result.add(id)
  node.children.forEach((childId) => collectDescendants(nodes, childId, result))
  return result
}

function findFirstDocument(nodes: Record<string, WorkspaceNode>) {
  return Object.values(nodes).find((node) => node.type === "document")?.id ?? ""
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      nodes: initialNodes,
      activeDocumentId: "doc-welcome",
      theme: "light",
      setActiveDocument: (id) => {
        if (get().nodes[id]?.type === "document") set({ activeDocumentId: id })
      },
      addDocument: (parentId = ROOT_ID) => {
        const id = createId("doc")
        const state = get()
        const safeParentId = state.nodes[parentId]?.type === "folder" ? parentId : ROOT_ID
        const node: WorkspaceNode = {
          id,
          name: "未命名文档",
          type: "document",
          children: [],
          content: "<h1>未命名文档</h1><p></p>",
          updatedAt: Date.now(),
        }
        set({
          nodes: {
            ...state.nodes,
            [id]: node,
            [safeParentId]: {
              ...state.nodes[safeParentId],
              children: [...state.nodes[safeParentId].children, id],
              updatedAt: Date.now(),
            },
          },
          activeDocumentId: id,
        })
        return id
      },
      addFolder: (parentId = ROOT_ID) => {
        const id = createId("folder")
        const state = get()
        const safeParentId = state.nodes[parentId]?.type === "folder" ? parentId : ROOT_ID
        const node: WorkspaceNode = {
          id,
          name: "新建文件夹",
          type: "folder",
          children: [],
          content: "",
          updatedAt: Date.now(),
        }
        set({
          nodes: {
            ...state.nodes,
            [id]: node,
            [safeParentId]: {
              ...state.nodes[safeParentId],
              children: [...state.nodes[safeParentId].children, id],
              updatedAt: Date.now(),
            },
          },
        })
        return id
      },
      renameNode: (id, name) => {
        const node = get().nodes[id]
        const nextName = name.trim()
        if (!node || id === ROOT_ID || !nextName) return
        set((state) => ({
          nodes: {
            ...state.nodes,
            [id]: { ...node, name: nextName, updatedAt: Date.now() },
          },
        }))
      },
      deleteNode: (id) => {
        if (id === ROOT_ID) return
        const state = get()
        const toDelete = collectDescendants(state.nodes, id)
        const nodes = Object.fromEntries(
          Object.entries(state.nodes)
            .filter(([nodeId]) => !toDelete.has(nodeId))
            .map(([nodeId, node]) => [
              nodeId,
              { ...node, children: node.children.filter((childId) => !toDelete.has(childId)) },
            ]),
        )
        const activeDocumentId = toDelete.has(state.activeDocumentId)
          ? findFirstDocument(nodes)
          : state.activeDocumentId
        set({ nodes, activeDocumentId })
      },
      updateDocument: (id, content) => {
        const node = get().nodes[id]
        if (!node || node.type !== "document") return
        set((state) => ({
          nodes: {
            ...state.nodes,
            [id]: { ...node, content, updatedAt: Date.now() },
          },
        }))
      },
      replaceChildren: (id, children) => {
        const node = get().nodes[id]
        if (!node || node.type !== "folder") return
        set((state) => ({
          nodes: {
            ...state.nodes,
            [id]: { ...node, children, updatedAt: Date.now() },
          },
        }))
      },
      toggleTheme: () => set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
    }),
    {
      name: "write-skill-workspace-v1",
      partialize: ({ nodes, activeDocumentId, theme }) => ({ nodes, activeDocumentId, theme }),
    },
  ),
)
