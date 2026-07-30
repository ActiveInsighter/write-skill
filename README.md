# Write Skill

一个面向长文、提示词和知识文档的现代化网页编辑器前端。

## 技术栈

- React 19 + TypeScript + Vite
- Tailwind CSS 4
- shadcn/ui 设计令牌与组件结构
- Base UI 弹层、菜单与 Tooltip
- Zustand 本地工作区状态
- Headless Tree 文档目录
- Tiptap 3 富文本编辑器

## 当前功能

- shadcn 风格可折叠侧边栏，支持桌面与移动端
- Headless Tree 目录：展开、选择、搜索、重命名、删除、拖拽排序和跨文件夹移动
- 文档与文件夹的新建操作
- 基于 Tiptap 3 的 Simple Editor 风格编辑区
- 标题、加粗、斜体、下划线、删除线、列表、任务列表、引用、代码块、文字对齐、高亮、链接、图片、上下标等工具
- 明暗主题
- Zustand `persist` 本地自动保存
- Cloudflare Worker 与 D1 尚未接入，数据访问边界已集中在 `src/stores/workspace.ts`

## 本地开发

```bash
npm install
npm run dev
```

构建检查：

```bash
npm run build
```

## 目录结构

```text
src/
├─ components/
│  ├─ document-tree.tsx
│  ├─ tiptap-templates/simple/simple-editor.tsx
│  └─ ui/
│     ├─ button.tsx
│     └─ sidebar.tsx
├─ stores/workspace.ts
├─ lib/utils.ts
├─ App.tsx
└─ styles.css
```

## 与 Cloudflare 对接建议

后续可以把 `workspace.ts` 中的节点操作抽象为 repository/service 层：

1. Worker 提供文档树和内容的 CRUD API。
2. D1 保存节点元数据、父子关系与文档内容。
3. Zustand 保留编辑中的乐观状态与离线缓存。
4. 使用版本号或 `updatedAt` 处理并发写入冲突。

## Tiptap 模板说明

官方 Simple Editor Template 的功能和响应式布局已作为设计基线。由于官方 UI Components 当前仍提示 React 19 兼容工作尚未完全结束，本项目没有直接复制其全部 UI 源码，而是使用 Tiptap 3 核心能力结合 shadcn/Base UI 重写工具栏和弹层，以保持 React 19 技术栈的一致性。
