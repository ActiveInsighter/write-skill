# Write Skill

一个现代化、响应式的网页文档编辑器前端原型。

## 技术栈

- React 19 + TypeScript + Vite
- Tailwind CSS 4
- shadcn/ui（Base UI 风格与 Base UI primitives）
- Zustand 本地状态与持久化
- Headless Tree 文档目录
- Tiptap 3 Simple Editor 体验

## 已实现

- shadcn 组合式侧边栏：桌面图标折叠、移动端抽屉、快捷键切换
- Headless Tree：选择、展开、搜索、创建、重命名、删除、鼠标和键盘拖拽排序
- Tiptap 3：标题、列表、任务列表、引用、代码、常用文字标记、链接、高亮、对齐、图片
- 文档标题与正文自动保存到浏览器 `localStorage`
- 明暗主题、响应式工具栏、字数与字符统计
- GitHub Actions 前端质量检查

当前状态层刻意保持纯前端，后续可把 Zustand action 的持久化部分替换为 Cloudflare Worker API，并将文档树和内容写入 D1。

## 开发

```bash
npm install
npm run dev
```

## 检查与构建

```bash
npm run lint
npm run typecheck
npm run build
```
