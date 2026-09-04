# Understory

A small, public, interlinked collection of ideas — built with [Quartz](https://quartz.jzhao.xyz), sourced from the `Garden/` folder inside the ExtendedBrain vault. This is a separate, standalone site from [The Rope](https://therope.us) on purpose: The Rope is essays read start to finish; this is short evergreen notes meant to be wandered.

**Nothing here is automatic.** A piece only ends up in `content/` because it was deliberately cultivated from a Concept or Keyword page in the vault (see `CLAUDE.md`'s "Cultivate" operation and `Garden/README.md` inside the vault), then synced into this project by hand.

## How the pieces get here

This project doesn't read the vault directly — `content/` holds an actual copy, synced on demand:

```bash
npm run sync-garden      # copies ../ExtendedBrain/Garden/*.md into content/
```

That assumes this project and the vault are sibling folders (e.g. both directly under `~/Documents/`). If they're not, pass the path explicitly:

```bash
bash bin/sync-garden.sh /path/to/ExtendedBrain/Garden
```

## Preview locally

```bash
npm install
npx quartz build --serve
```

Open the URL it prints. Only pages with `publish: true` in their frontmatter are ever built — that's enforced by the `explicit-publish` plugin in `quartz.config.yaml`, on top of the fact that `content/` only ever holds what you deliberately synced in. Two independent locks, not one.

## Publishing to the live site

1. **Create the GitHub repo** (one-time):
   ```bash
   git init
   git add -A
   git commit -m "Initial commit"
   gh repo create understory --public --source=. --remote=origin
   git push -u origin main
   ```
2. **Turn on GitHub Pages** (one-time): on the repo's GitHub page, go to Settings → Pages → under "Source" choose **GitHub Actions**. The included workflow (`.github/workflows/deploy.yml`) builds and deploys on every push to `main`.
3. **Every time you've cultivated something new:**
   ```bash
   npm run sync-garden
   git add -A
   git commit -m "Add: <piece title>"
   git push
   ```
   GitHub Actions rebuilds and redeploys automatically — usually live within a minute or two. Your site will be at `https://<your-github-username>.github.io/understory`.
4. **Custom domain (optional):** Settings → Pages → Custom domain. See [Quartz's hosting docs](https://quartz.jzhao.xyz/hosting#custom-domain) for the DNS records.

## The newsletter pipeline (Buttondown)

For a piece you also want emailed out, add `newsletter: draft` to its frontmatter alongside `publish: true` (do this on the source page in `Garden/`, before syncing — or directly on the synced copy in `content/`, though the next sync will overwrite it from the vault, so the vault copy is the one that should carry the flag long-term).

```bash
cp .env.example .env        # once -- then fill in BUTTONDOWN_API_KEY
npm run newsletter -- --dry-run     # preview what would be staged, no API calls
npm run newsletter                  # actually create the Buttondown drafts
```

**This never sends anything.** It creates each eligible piece as a `draft` email in your Buttondown account (Buttondown's own API defaults to draft now too — this pipeline doesn't fight that, it relies on it) and flips the piece's frontmatter from `newsletter: draft` to `newsletter: staged`. Log into Buttondown, read the draft, and hit send yourself when you're ready. Once you've actually sent it, flip the frontmatter to `newsletter: sent` by hand — that's the one step this pipeline deliberately leaves to you.

## What's different from a typical Quartz site

- Content source is never the live vault — always a synced copy, so a build here can never accidentally reach into `ExtendedBrain/Wiki`, `Raw/`, or anything else private.
- `explicit-publish` is turned on and `remove-draft` is left on too — a piece needs `publish: true` *and* no `draft: true`, redundant on purpose.
- Analytics are off (`analytics: null` in `quartz.config.yaml`) until you decide you want them.
