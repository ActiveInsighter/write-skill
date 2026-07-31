# Write Skill

A modern cloud-backed document editor built with React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui on Base UI, Zustand, Headless Tree, Tiptap 3, Cloudflare Workers, and D1.

## Application architecture

- Cloudflare Workers Static Assets serves the production React SPA.
- `/api/*` requests run through `worker/index.ts` before static asset routing.
- D1 stores each workspace as validated Tiptap/tree JSON with an atomic revision number.
- A database trigger archives the previous snapshot on every successful update and retains the latest 50 revisions.
- Anonymous workspaces are protected by a browser-generated high-entropy access token; only its SHA-256 hash is stored in D1.
- Zustand remains the offline/local cache. Document changes are debounced and synchronized to D1 when connectivity is available.
- Local and cloud copies are never silently overwritten when both have changed; the editor asks the user which copy to keep.

## Editor behavior

- The sidebar uses Headless Tree for keyboard navigation, renaming, ordered drag-and-drop, and keyboard drag-and-drop.
- Right-click or long-press a file or folder for create, duplicate, rename, and delete actions.
- Search results are presented separately from the tree so hidden tree items cannot interfere with keyboard focus.
- The Tiptap Simple Editor toolbar remains horizontally scrollable on narrow screens.
- Image rendering is supported, but upload controls remain hidden until a persistent object-storage upload path is configured.

## API

- `GET /api/health`
- `POST /api/workspaces`
- `GET /api/workspaces/:workspaceId`
- `PUT /api/workspaces/:workspaceId`
- `DELETE /api/workspaces/:workspaceId`
- `GET /api/workspaces/:workspaceId/revisions`

Workspace reads and writes require `Authorization: Bearer <workspace-access-token>`.

## Local development

Install dependencies and start the frontend:

```bash
npm ci
npm run dev
```

For local Worker and D1 development, apply the migration and run Wrangler in another terminal:

```bash
npm run db:migrate:local
npm run dev:worker
```

Vite proxies `/api` requests to Wrangler at `http://127.0.0.1:8787`.

## Verification

```bash
npm run typecheck
npm run build
```

The `Verify application` workflow runs for every pushed branch and for pull requests targeting `main`.

## Cloudflare deployment

The `Deploy Cloudflare` GitHub Action runs after changes are pushed or merged to `main`.
It performs the following steps:

1. Builds and typechecks the frontend and Worker.
2. Finds or creates the `write-skill-db` D1 database in the APAC location.
3. Writes the resolved D1 database ID into the temporary CI copy of `wrangler.jsonc`.
4. Applies pending migrations.
5. Deploys the Worker and SPA together as `write-skill`.
6. Runs an API and D1 smoke test against the deployed Worker.

Required GitHub secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
