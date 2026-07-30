# Write Skill

一个运行在 Cloudflare Workers + D1 上的现代化网页文档编辑器。

## 技术栈

- React 19 + TypeScript + Vite
- Tailwind CSS 4
- shadcn/ui Base UI 风格组件
- Zustand 本地缓存与云端同步
- Headless Tree 文档目录
- Tiptap 3 Simple Editor
- Cloudflare Worker + Static Assets
- Cloudflare D1
- GitHub Actions 自动迁移与部署

## 已实现

- 响应式侧边栏和可拖拽文档树；
- Tiptap 富文本编辑器、工具栏、图片、链接和任务列表；
- `localStorage` 离线缓存；
- Worker JSON API；
- D1 工作区与文档树持久化；
- 首次启动自动把浏览器本地数据迁移到 D1；
- Zustand 状态变化防抖后自动保存完整工作区快照；
- 断网时继续保存在本地，恢复联网后自动重试；
- Actions 自动创建 D1、执行迁移、部署 Worker 与静态资源、检查健康端点。

后端数据模型、API 和同步策略见 [`docs/backend-architecture.md`](docs/backend-architecture.md)。

## 本地开发

安装依赖：

```bash
npm install
```

首次运行先创建本地 D1 表：

```bash
npm run d1:migrate:local
```

终端一启动本地 Worker：

```bash
npm run dev:worker
```

终端二启动 Vite；`/api` 会代理到 `127.0.0.1:8787`：

```bash
npm run dev
```

## 检查与构建

```bash
npm run lint
npm run typecheck
npm run d1:migrate:local
npm run build
npm run worker:dry-run
```

## Cloudflare 部署

GitHub 仓库需要配置：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

合并到 `main` 后，`Deploy Cloudflare` Action 会：

1. 安装依赖并运行完整检查；
2. 查找或自动创建 `write-skill-db` D1 数据库；
3. 生成包含真实数据库 UUID 的临时 Wrangler 配置；
4. 应用远程迁移；
5. 部署 Worker 和 `dist` 静态资源；
6. 请求 `/api/health` 验证部署结果。

真实数据库 UUID 不写入 Git 仓库，`.wrangler/wrangler.generated.jsonc` 仅在 CI 中生成。

## 当前身份模型

当前版本使用安全的匿名工作区 Cookie 隔离数据，每个浏览器拥有独立工作区。它适合当前单用户原型，但还不是正式账号系统；跨设备同步需要后续接入登录。
