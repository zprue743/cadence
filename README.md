# Cadence

Internal roadmap tool for product managers and product owners. Each team edits its own roadmap on a Bryntum Gantt. Leads get a separate read-only portfolio of top-level initiatives.

The app is Vue 3 and TypeScript. One Node process serves the built UI and a Hono API. Data is a SQLite file. Decisions live in `C:\Users\pruet\Dev\cadence-plan.md`.

## Status

Phase 0: repo docs only. There is no application code yet.

## Bryntum

There is no free community edition. Development starts on the public npm trial, pinned to one exact 7.3.x version for both packages. Imports use `@bryntum/gantt`. The trial package is an alias in `package.json`.

The trial build shows a watermark and is feature-limited. A paid internal rollout uses Bryntum's End User License, one per developer. Switching licenses changes the alias and the npm registry. It does not change imports.

Editors on a roadmap get Bryntum's AI chat. The model token is `OPENAI_API_KEY` in the server environment. The browser does not receive it.

## Run

Not yet. Phase 1 renders a chart. Phase 2 adds save and the AI proxy. Phase 4 adds Docker.

When Docker exists, the service listens on port 8080 and stores the database at `/data/app.db` on a named volume. Sign-in stays on the reverse proxy in front of the container. Pass `OPENAI_API_KEY` in at runtime. An empty value leaves the chat off.
