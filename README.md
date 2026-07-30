# Write Skill

A modern, local-first document editor front end built with React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui on Base UI, Zustand, Headless Tree, and Tiptap 3.

## Current scope

- Responsive shadcn sidebar shell
- Accessible Headless Tree document hierarchy
- Create folders and documents, rename with `F2` or double-click
- Official Tiptap Simple Editor Template
- Per-document Tiptap JSON persisted through Zustand middleware
- Clear local data boundary for a later Cloudflare Worker + D1 API

## Development

The first pull-request workflow installs the official shadcn and Tiptap template source, patches the template with document content callbacks, builds the app, and commits the generated component files back to the feature branch.

After generated sources are committed:

```bash
npm install
npm run dev
```

Production verification:

```bash
npm run build
```
