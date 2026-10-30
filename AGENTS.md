# Cadence

Internal PM/PO roadmap tool. Vue 3 + TypeScript, Bryntum Gantt, one Hono process, SQLite.

## Reading order

1. This file.
2. `REPO_MAP.md`, to find the one file the task needs.
3. That file, and nothing else unless the task names another.

Open `C:\Users\pruet\Dev\cadence-plan.md` only when the task changes scope, schema, or licensing. Do not open it for an ordinary edit. Do not read `node_modules` or Bryntum package internals.

## Rules

- Tasks stay manually scheduled. Do not turn on Bryntum's scheduling engine.
- One sync request is one SQLite transaction. Map `$PhantomId` to a real id in that response. Rewrite foreign keys that still point at a phantom id. Update only fields present on the record.
- Reject a sync when `revision` does not match `roadmaps.revision`.
- A dependency stays inside one roadmap.
- The caller's email comes from the `EMAIL_HEADER` request header. Do not add accounts, passwords, or a user table.
- Only an `editor` of the roadmap's team may sync. Other viewers load the chart with no `syncUrl`.
- Import Bryntum as `@bryntum/gantt`. Do not import `@bryntum/gantt-trial`. A license change is a `package.json` alias change.
- The AI token is `process.env.OPENAI_API_KEY`, read only in `src/server/routes/ai.ts`. Do not put it in the client, `VITE_*` env, logs, error bodies, or the image.
- Only an editor gets the AI chat. AI edits save through the normal sync. Leave voice endpoints and the `criticalPath` tool out.
- Do not add resources, assignments, calendars, baselines, or cross-roadmap dependencies.

## Commands

None. Phase 0 is docs only. Do not invent scripts.
