# Repo map

Read `AGENTS.md` first. Use this file to open one path. Skip directories the task does not name.

Phase 0 created only this file, `README.md`, `AGENTS.md`, `.gitignore`, and `.env.example`. Every other path below is where a later phase puts code. Those paths do not exist yet. Do not search the tree for them.

## Root

| Path | When it exists | Open it for |
| --- | --- | --- |
| `README.md` | phase 0 | What the product is and how it runs |
| `AGENTS.md` | phase 0 | Rules and reading order |
| `REPO_MAP.md` | phase 0 | Where files go |
| `.gitignore` | phase 0 | Ignored artifacts |
| `.env.example` | phase 0 | Variable names. Values stay empty |
| `package.json` | phase 1 | Dependencies, including the Bryntum alias |
| `vite.config.ts` | phase 1 | Vue build and `/api` proxy |
| `tsconfig.json` | phase 1 | TypeScript |
| `drizzle.config.ts` | phase 2 | Migrations |
| `Dockerfile` | phase 4 | `node:22-bookworm-slim` image |
| `docker-compose.yml` | phase 4 | Port 8080 and the `/data` volume |

Product decisions are not in this repo. They are in `C:\Users\pruet\Dev\cadence-plan.md`. Open that file only for scope, schema, or licensing.

## `src/client`

Vue 3 UI. Start here for screens and the chart.

| Path | Phase | Open it for |
| --- | --- | --- |
| `src/client/main.ts` | 1 | App bootstrap |
| `src/client/App.vue` | 1 | Shell |
| `src/client/pages/RoadmapPage.vue` | 1 | The editable Gantt page |
| `src/client/gantt/ganttConfig.ts` | 1 | Columns, zoom, `loadUrl` / `syncUrl`, manual scheduling. AI feature is added in phase 2 for editors |
| `src/client/gantt/taskModel.ts` | 1 | `status`, `owner`, `outcome` on the task model |
| `src/client/pages/RoadmapList.vue` | 3 | Teams and their roadmaps |
| `src/client/pages/PortfolioPage.vue` | 3 | Read-only top-level initiatives |

## `src/server`

Hono process. It will serve `dist/` and the API on one port.

| Path | Phase | Open it for |
| --- | --- | --- |
| `src/server/index.ts` | 2 | Process entry, static files, listen |
| `src/server/db.ts` | 2 | SQLite connection, `DATABASE_PATH` |
| `src/server/schema.ts` | 2 | Tables |
| `src/server/migrate.ts` | 2 | Migrations run on startup |
| `src/server/routes/roadmaps.ts` | 2 | Load, sync, phantom ids, revision |
| `src/server/routes/ai.ts` | 2 | `OPENAI_API_KEY`, prompt proxy, enabled flag |
| `src/server/routes/portfolio.ts` | 3 | Read-only cross-team load |

## `src/shared`

| Path | Phase | Open it for |
| --- | --- | --- |
| `src/shared/types.ts` | 2 | Types shared by client and server |

## Do not open

`node_modules/`, `dist/`, `data/`, any `*.db`, and anything inside `@bryntum`.
