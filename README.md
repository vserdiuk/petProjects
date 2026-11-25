# Pet projects

A personal portal of small, isolated tools. Every tool is its own app with its own
dependencies and build; the portal is just an index page that links to them.

```
apps/
  portal/      index page (reads projects.json)
  polyline/    Polyline delivery generator
  img2pdf/     Images → PDF (e.g. comic pages)
  sticky-wall/ Picture → sticky-note wall, printed in passes
projects.json  registry of projects shown on the portal
scripts/assemble.mjs  merges all builds into one static dist/
docs/          specs
```

## Develop

```bash
pnpm install
pnpm dev:portal      # or: pnpm dev:polyline
pnpm build           # builds every app and assembles dist/
```

`dist/` layout: the portal at the root, each project at `dist/<slug>/`.
All apps use a relative base (`base: "./"`), so the site works at a domain root
and in a sub-folder such as `https://<user>.github.io/petProjects/`.

## Add a new project

1. Create `apps/<slug>/` (copy `apps/polyline` as a starting point and rename `name` in its `package.json` to `<slug>`).
2. Add `{ "slug": "<slug>", "title": "...", "description": "...", "icon": "🧪", "status": "in-progress" }` to `projects.json`.
3. `pnpm install && pnpm build`.

Projects never import each other. Shared code, if ever needed, goes into `packages/*`
and is opt-in per project.

## Deploy

### GitHub Pages
The workflow `.github/workflows/deploy-pages.yml` builds and deploys on every push to `main`.
One-time setup: repository **Settings → Pages → Source: GitHub Actions**.

### Cloudflare Pages
One-time setup in the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**, pick this repository, then:

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | `pnpm build` |
| Build output directory | `dist` |
| Environment variable | `NODE_VERSION` = `22` |

Cloudflare then deploys `main` automatically and creates preview URLs for pull requests.
