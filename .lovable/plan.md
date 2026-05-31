# GitHub Pages deployment for iCal generator

The iCal generator in `public/ical/` is already a zero-build static site (plain HTML + JS + xlsx CDN). The cleanest path is to publish **just that folder** as the GitHub Pages site — no TanStack build, no Node runtime needed, and it works out of the box on `username.github.io/repo-name/`.

I can't push to your GitHub account from here, so I will prepare everything in the repo and give you the exact commands to push.

## What I'll add

1. **`.github/workflows/deploy-pages.yml`** — GitHub Actions workflow that:
   - Triggers on push to `main` (and manual `workflow_dispatch`).
   - Copies `public/ical/` into a clean `_site/` directory.
   - Adds a `.nojekyll` file so GitHub Pages serves files as-is.
   - Uses the official `actions/upload-pages-artifact` + `actions/deploy-pages` actions to publish to the `github-pages` environment.
   - Requests the right `pages: write` + `id-token: write` permissions.

2. **`public/ical/README.md`** — Short note: how to use locally and that this is the deployed app.

3. **Repo-root `README.md`** (only if missing) — link to the deployed Pages URL and usage notes in Czech.

## What you'll do once (one-time GitHub setup)

After I push the files, in your GitHub repo:
1. **Settings → Pages → Build and deployment → Source: GitHub Actions** (not "Deploy from branch").
2. Push to `main`. The workflow runs, deploys, and your site is live at:
   `https://<username>.github.io/<repo>/`

I'll include those steps in chat after I create the files.

## Technical details

Workflow file shape:

```yaml
name: Deploy iCal generator to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          mkdir -p _site
          cp -r public/ical/. _site/
          touch _site/.nojekyll
      - uses: actions/upload-pages-artifact@v3
        with: { path: _site }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Why this and not deploying the full TanStack Start app: TanStack Start is an SSR/edge framework and needs a server runtime — GitHub Pages serves only static files. Your iCal app is fully client-side, so deploying just `public/ical/` is the correct fit and keeps the URL clean.

## After approval

Once you click Implement, I'll create the workflow file and give you the exact `git` commands to push and the one-time Pages setting to flip in your repo.
