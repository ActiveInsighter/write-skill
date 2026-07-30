# Write Skill 后端架构

## 部署单元

生产环境使用一个 Cloudflare Worker 同时承载：

- React/Vite 构建后的静态资源；
- `/api/*` JSON API；
- D1 数据库绑定 `DB`。

静态资源使用 Workers Static Assets，SPA 路由由 `not_found_handling: single-page-application` 处理，只有 `/api/*` 会优先进入 Worker 函数。

## 身份与隔离

当前版本没有正式登录系统。Worker 首次初始化时生成随机 UUID，并通过 `__Host-write_skill_workspace` 安全 Cookie 标识匿名工作区：

- `HttpOnly`：前端 JavaScript 无法读取；
- `Secure`：仅 HTTPS；
- `SameSite=Lax`：降低跨站请求风险；
- API 写操作还会校验 `Origin`。

每个浏览器拥有独立工作区。数据库结构已经把 `workspace_id` 作为所有节点的分区键，后续接入登录后可新增用户表和成员关系表，不需要重写文档树表。

## 数据模型

### `workspaces`

| 字段 | 说明 |
|---|---|
| `id` | 匿名工作区 UUID，主键 |
| `selected_document_id` | 最近选中的文档 |
| `revision` | 工作区服务端版本号 |
| `created_at` | 创建时间 |
| `updated_at` | 最近变更时间 |

### `nodes`

文件夹与文档共用一张邻接表：

| 字段 | 说明 |
|---|---|
| `workspace_id` + `id` | 复合主键 |
| `parent_id` | 父文件夹；根节点为 `NULL` |
| `kind` | `folder` 或 `document` |
| `name` | 名称，最长 80 字符 |
| `position` | 同级排序位置 |
| `content` | 文档 HTML；文件夹必须为 `NULL` |
| `version` | 节点版本号 |
| `created_at` / `updated_at` | 时间戳 |

父子关系使用复合外键和级联删除；索引覆盖常用的工作区、父节点、位置、类型和更新时间查询。

## API

| 方法 | 路径 | 功能 |
|---|---|---|
| `GET` | `/api/health` | Worker 与 D1 健康检查 |
| `POST` | `/api/workspaces/bootstrap` | 首次创建或读取当前工作区 |
| `GET` | `/api/workspaces/current` | 读取完整工作区快照 |
| `PUT` | `/api/workspaces/current` | 保存当前选中文档 |
| `PUT` | `/api/workspaces/current/snapshot` | 故障恢复或强制同步完整快照 |
| `PUT` | `/api/nodes/:id` | 新建或更新节点 |
| `DELETE` | `/api/nodes/:id` | 删除节点及其后代 |
| `PUT` | `/api/folders/:id?operation=children` | 保存文件夹子节点顺序 |

所有 SQL 参数都通过 D1 prepared statements 绑定。多条相关写入使用 `D1Database.batch()`，失败时整体回滚。

## 前端同步策略

1. Zustand 继续写入 `localStorage`，因此断网时不会丢失当前浏览器数据。
2. 应用启动后调用 bootstrap：
   - 云端工作区不存在：把本地工作区作为初始数据写入 D1；
   - 云端工作区已存在：加载云端版本。
3. 当前前端通过 Zustand 订阅器监听目录与正文变化，防抖后保存完整快照。
4. Worker 同时提供节点级增量接口，后续可在不修改数据库结构的情况下逐步切换。
5. 云端失败时本地编辑继续，恢复联网后自动重试完整快照。

## 后续扩展

- 正式用户登录与跨设备同步；
- 通过 `revision` 实现乐观并发控制；
- 文档历史版本表和恢复功能；
- 图片从 D1 Base64 内容迁移到 R2；
- Cloudflare Access 或应用级认证；
- D1 Sessions API 与读副本。
