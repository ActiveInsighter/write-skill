import { create } from "zustand"
import { persist } from "zustand/middleware"

export type WorkspaceNodeKind = "folder" | "document"

export interface WorkspaceNode {
  id: string
  name: string
  kind: WorkspaceNodeKind
  children?: string[]
  content?: string
  createdAt: string
  updatedAt: string
}

interface WorkspaceState {
  nodes: Record<string, WorkspaceNode>
  selectedDocumentId: string
  selectDocument: (id: string) => void
  renameNode: (id: string, name: string) => void
  updateDocumentContent: (id: string, content: string) => void
  createDocument: (parentId?: string) => string
  createFolder: (parentId?: string) => string
  deleteNode: (id: string) => void
  replaceChildren: (parentId: string, children: string[]) => void
}

const createdAt = new Date().toISOString()

const welcomeContent = `
<h1>把想法整理成可复用的技能</h1>
<p>Write Skill 是一个专注于结构化写作的现代文档工作台。左侧目录负责组织内容，右侧使用 Tiptap 3 的 Simple Editor 体验进行编辑。</p>
<h2>推荐文档结构</h2>
<ul>
  <li><p><strong>目标</strong>：清楚说明这项技能最终要完成什么。</p></li>
  <li><p><strong>输入</strong>：列出执行前需要准备的材料和上下文。</p></li>
  <li><p><strong>步骤</strong>：把复杂任务拆成可以依次执行的动作。</p></li>
  <li><p><strong>输出</strong>：定义结果的格式、质量标准和限制。</p></li>
</ul>
<blockquote><p>先搭好结构，再补充边界、示例与异常处理。</p></blockquote>
<h2>当前前端能力</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>目录创建、重命名、删除与拖拽排序</p></div></li>
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>富文本、列表、任务项、代码、链接、图片与高亮</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>接入 Cloudflare Worker 与 D1 云端持久化</p></div></li>
</ul>
`

export const initialWorkspaceNodes: Record<string, WorkspaceNode> = {
  root: {
    id: "root",
    name: "工作区",
    kind: "folder",
    children: ["start", "examples", "archive"],
    createdAt,
    updatedAt: createdAt,
  },
  start: {
    id: "start",
    name: "开始使用",
    kind: "folder",
    children: ["welcome", "shortcuts"],
    createdAt,
    updatedAt: createdAt,
  },
  welcome: {
    id: "welcome",
    name: "欢迎使用 Write Skill",
    kind: "document",
    content: welcomeContent,
    createdAt,
    updatedAt: createdAt,
  },
  shortcuts: {
    id: "shortcuts",
    name: "编辑器快捷方式",
    kind: "document",
    content:
      '<h1>编辑器快捷方式</h1><p>你可以使用 <code>Ctrl/Cmd + B</code> 加粗、<code>Ctrl/Cmd + I</code> 斜体，也可以通过顶部工具栏插入链接、任务列表和图片。</p><p>使用 <code>Ctrl/Cmd + K</code> 搜索目录，使用 <code>Ctrl/Cmd + B</code>（焦点不在编辑器时）切换侧边栏。</p>',
    createdAt,
    updatedAt: createdAt,
  },
  examples: {
    id: "examples",
    name: "示例技能",
    kind: "folder",
    children: ["rewrite", "research", "summary"],
    createdAt,
    updatedAt: createdAt,
  },
  rewrite: {
    id: "rewrite",
    name: "专业改写",
    kind: "document",
    content:
      "<h1>专业改写</h1><p>在不改变原意的前提下，提高文本的清晰度、准确性与可读性。</p><h2>执行步骤</h2><ol><li><p>判断受众和使用场景。</p></li><li><p>修复结构、语法和表达问题。</p></li><li><p>检查是否引入了原文没有的新事实。</p></li></ol>",
    createdAt,
    updatedAt: createdAt,
  },
  research: {
    id: "research",
    name: "资料研究",
    kind: "document",
    content:
      "<h1>资料研究</h1><p>围绕明确的问题查找可靠资料，区分事实、观点与推断，并保留可核验的来源信息。</p>",
    createdAt,
    updatedAt: createdAt,
  },
  summary: {
    id: "summary",
    name: "长文总结",
    kind: "document",
    content:
      "<h1>长文总结</h1><p>提取关键结论、证据、限制和后续行动，而不是机械复述原文。</p>",
    createdAt,
    updatedAt: createdAt,
  },
  archive: {
    id: "archive",
    name: "归档",
    kind: "folder",
    children: [],
    createdAt,
    updatedAt: createdAt,
  },
}

function makeId(kind: WorkspaceNodeKind) {
  const value =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  return `${kind}-${value}`
}

function findFirstDocument(nodes: Record<string, WorkspaceNode>) {
  const queue = [...(nodes.root?.children ?? [])]
  while (queue.length) {
    const id = queue.shift()
    if (!id) continue
    const node = nodes[id]
    if (!node) continue
    if (node.kind === "document") return id
    queue.unshift(...(node.children ?? []))
  }
  return ""
}

function findDescendantIds(
  nodes: Record<string, WorkspaceNode>,
  id: string,
): string[] {
  const node = nodes[id]
  if (!node) return []
  return [
    id,
    ...(node.children ?? []).flatMap((childId) =>
      findDescendantIds(nodes, childId),
    ),
  ]
}

function resolveFolder(
  nodes: Record<string, WorkspaceNode>,
  preferredId?: string,
) {
  if (preferredId && nodes[preferredId]?.kind === "folder") return preferredId
  return "root"
}

function uniqueName(
  nodes: Record<string, WorkspaceNode>,
  parentId: string,
  baseName: string,
) {
  const names = new Set(
    (nodes[parentId]?.children ?? []).map((id) => nodes[id]?.name),
  )
  if (!names.has(baseName)) return baseName
  let index = 2
  while (names.has(`${baseName} ${index}`)) index += 1
  return `${baseName} ${index}`
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      nodes: initialWorkspaceNodes,
      selectedDocumentId: "welcome",

      selectDocument: (id) => {
        if (get().nodes[id]?.kind === "document") {
          set({ selectedDocumentId: id })
        }
      },

      renameNode: (id, name) => {
        if (id === "root" || !get().nodes[id]) return
        const normalized = name.replace(/\s+/g, " ").trim().slice(0, 80)
        if (!normalized) return
        set((state) => ({
          nodes: {
            ...state.nodes,
            [id]: {
              ...state.nodes[id],
              name: normalized,
              updatedAt: new Date().toISOString(),
            },
          },
        }))
      },

      updateDocumentContent: (id, content) => {
        if (get().nodes[id]?.kind !== "document") return
        set((state) => ({
          nodes: {
            ...state.nodes,
            [id]: {
              ...state.nodes[id],
              content,
              updatedAt: new Date().toISOString(),
            },
          },
        }))
      },

      createDocument: (parentId) => {
        const state = get()
        const parent = resolveFolder(state.nodes, parentId)
        const id = makeId("document")
        const timestamp = new Date().toISOString()
        const name = uniqueName(state.nodes, parent, "未命名文档")
        set((current) => ({
          nodes: {
            ...current.nodes,
            [id]: {
              id,
              name,
              kind: "document",
              content: `<h1>${name}</h1><p>从这里开始写作…</p>`,
              createdAt: timestamp,
              updatedAt: timestamp,
            },
            [parent]: {
              ...current.nodes[parent],
              children: [...(current.nodes[parent].children ?? []), id],
              updatedAt: timestamp,
            },
          },
          selectedDocumentId: id,
        }))
        return id
      },

      createFolder: (parentId) => {
        const state = get()
        const parent = resolveFolder(state.nodes, parentId)
        const id = makeId("folder")
        const timestamp = new Date().toISOString()
        const name = uniqueName(state.nodes, parent, "新建文件夹")
        set((current) => ({
          nodes: {
            ...current.nodes,
            [id]: {
              id,
              name,
              kind: "folder",
              children: [],
              createdAt: timestamp,
              updatedAt: timestamp,
            },
            [parent]: {
              ...current.nodes[parent],
              children: [...(current.nodes[parent].children ?? []), id],
              updatedAt: timestamp,
            },
          },
        }))
        return id
      },

      deleteNode: (id) => {
        if (id === "root" || !get().nodes[id]) return
        set((state) => {
          const deletedIds = new Set(findDescendantIds(state.nodes, id))
          const nodes = Object.fromEntries(
            Object.entries(state.nodes)
              .filter(([nodeId]) => !deletedIds.has(nodeId))
              .map(([nodeId, node]) => [
                nodeId,
                node.kind === "folder"
                  ? {
                      ...node,
                      children: (node.children ?? []).filter(
                        (childId) => !deletedIds.has(childId),
                      ),
                    }
                  : node,
              ]),
          ) as Record<string, WorkspaceNode>
          return {
            nodes,
            selectedDocumentId: deletedIds.has(state.selectedDocumentId)
              ? findFirstDocument(nodes)
              : state.selectedDocumentId,
          }
        })
      },

      replaceChildren: (parentId, children) => {
        if (get().nodes[parentId]?.kind !== "folder") return
        const uniqueChildren = [...new Set(children)].filter(
          (childId) => childId !== parentId && Boolean(get().nodes[childId]),
        )
        set((state) => ({
          nodes: {
            ...state.nodes,
            [parentId]: {
              ...state.nodes[parentId],
              children: uniqueChildren,
              updatedAt: new Date().toISOString(),
            },
          },
        }))
      },
    }),
    {
      name: "write-skill-workspace-v1",
      version: 1,
      partialize: (state) => ({
        nodes: state.nodes,
        selectedDocumentId: state.selectedDocumentId,
      }),
      merge: (persisted, current) => {
        const restored = persisted as Partial<WorkspaceState> | undefined
        const nodes = restored?.nodes ?? current.nodes
        const selectedDocumentId =
          restored?.selectedDocumentId &&
          nodes[restored.selectedDocumentId]?.kind === "document"
            ? restored.selectedDocumentId
            : findFirstDocument(nodes) || current.selectedDocumentId
        return { ...current, ...restored, nodes, selectedDocumentId }
      },
    },
  ),
)
