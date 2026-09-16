# Nucleus / Fish-Net documentation content

This repository holds **only the documentation content**. The site is rendered by the FreeDoc
software (https://github.com/FirstGearGames/FreeDoc), which is pulled in at build time. Keeping
content and software apart means doc edits and pull requests never touch the software repo.

## What lives here

- `content/<version>/**.md` — the pages. Folder structure becomes the sidebar; `_meta.json` in a
  folder controls order, titles and tags. Files or folders starting with `_` are ignored.
- `docs.config.json` — title, versions, top-nav links, theme colors, and the `github` block used
  for the "Edit on GitHub" links (point it at this repo so contributors can edit content).
- `static/` — images and other assets, referenced as `/static/<file>`.

## Editing

Edit Markdown under `content/` and open a pull request. CI runs the content-scan and renderer
security checks (from FreeDoc) on every PR; a merge triggers a redeploy.

## Build locally

```bash
npm install
npm run build      # fetches the FreeDoc renderer into .freedoc/ and renders to out/
```

Live preview with instant edits:

```bash
npm run dev        # runs the FreeDoc preview server against this repo's content
```

## Hosting (Cloudflare Pages)

Connect this repo in Cloudflare Pages with:

- **Build command**: `npm run build`
- **Build output directory**: `out`
- Framework preset: **None**

Every merge auto-rebuilds and redeploys. Host on a domain separate from any authenticated site
(a `*.pages.dev` URL or a dedicated domain), never a subdomain of a site that sets login cookies.

## Pinning the renderer version

`npm run fetch-renderer` pulls the latest FreeDoc `main`. To pin a specific release, change the
`fetch-renderer` script to `degit FirstGearGames/FreeDoc/fishnet-docs#<tag-or-commit> .freedoc --force`.
