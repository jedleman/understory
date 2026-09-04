#!/usr/bin/env node
// Semi-automated Buttondown newsletter pipeline.
//
// Scans content/ for pieces with BOTH `publish: true` AND `newsletter: draft`
// in their frontmatter, creates each as a DRAFT email in Buttondown (never
// sent automatically -- see README.md in this folder for why), and flips
// the piece's frontmatter to `newsletter: staged` once the draft exists.
//
// Usage:
//   node bin/publish-newsletter.mjs              # stage every eligible piece
//   node bin/publish-newsletter.mjs --dry-run    # preview, no API calls, no file changes
//   node bin/publish-newsletter.mjs "My Piece"    # stage just one piece by title/filename

import { readFileSync, writeFileSync, readdirSync } from "node:fs"
import { join, dirname, basename } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const CONTENT_DIR = join(ROOT, "content")

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const targetFilter = args.find((a) => !a.startsWith("--"))

function loadEnv() {
  // Minimal .env loader -- no dependency needed for KEY=VALUE lines.
  const envPath = join(ROOT, ".env")
  const env = { ...process.env }
  try {
    const text = readFileSync(envPath, "utf-8")
    for (const rawLine of text.split("\n")) {
      const line = rawLine.trim()
      if (!line || line.startsWith("#")) continue
      const eq = line.indexOf("=")
      if (eq === -1) continue
      const key = line.slice(0, eq).trim()
      let value = line.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!(key in env)) env[key] = value
    }
  } catch {
    // no .env file -- fine, rely on process.env
  }
  return env
}

// Tiny frontmatter parser: good enough for this project's flat key: value
// pairs (title, created, updated, publish, newsletter). Not a general YAML
// parser -- if a Garden piece needs real YAML structures, this will need
// upgrading, but Cultivate's own convention keeps this frontmatter flat.
function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { frontmatter: {}, body: raw, raw }
  const [, fmBlock, body] = match
  const frontmatter = {}
  for (const line of fmBlock.split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/)
    if (!m) continue
    let [, key, value] = m
    value = value.trim()
    if (value === "true") value = true
    else if (value === "false") value = false
    else if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    frontmatter[key] = value
  }
  return { frontmatter, body, raw }
}

function stripVaultArtifacts(markdown) {
  // Defense in depth: Cultivate's own rule says a Garden piece should never
  // contain a vault-internal [[wikilink]], but if one slips through, don't
  // ship raw double brackets to subscribers -- just show the display text.
  return markdown
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
}

function setFrontmatterField(raw, key, value) {
  const re = new RegExp(`^(${key}:).*$`, "m")
  if (re.test(raw)) {
    return raw.replace(re, `$1 ${value}`)
  }
  // field didn't exist -- add it just before the closing ---
  return raw.replace(/^---\n([\s\S]*?)\n---/, (whole, block) => `---\n${block}\n${key}: ${value}\n---`)
}

async function createDraft(env, subject, body, slug) {
  const apiKey = env.BUTTONDOWN_API_KEY
  if (!apiKey) {
    throw new Error(
      "BUTTONDOWN_API_KEY is not set. Copy .env.example to .env and fill it in.",
    )
  }
  const res = await fetch("https://api.buttondown.com/v1/emails", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject,
      body,
      slug,
      status: "draft", // never auto-send -- see README.md
    }),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Buttondown API ${res.status}: ${text}`)
  }
  return JSON.parse(text)
}

async function main() {
  const env = loadEnv()
  let files
  try {
    files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"))
  } catch {
    console.error(`Could not read ${CONTENT_DIR} -- run bin/sync-garden.sh first.`)
    process.exit(1)
  }

  const eligible = []
  for (const file of files) {
    const path = join(CONTENT_DIR, file)
    const raw = readFileSync(path, "utf-8")
    const { frontmatter, body } = parseFrontmatter(raw)
    if (frontmatter.publish !== true) continue
    if (frontmatter.newsletter !== "draft") continue
    if (targetFilter) {
      const title = frontmatter.title || basename(file, ".md")
      if (!title.toLowerCase().includes(targetFilter.toLowerCase())) continue
    }
    eligible.push({ file, path, raw, frontmatter, body })
  }

  if (eligible.length === 0) {
    console.log("Nothing eligible: no content/*.md has both publish: true and newsletter: draft.")
    return
  }

  for (const piece of eligible) {
    const title = piece.frontmatter.title || basename(piece.file, ".md")
    const slug = basename(piece.file, ".md")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
    const emailBody = stripVaultArtifacts(piece.body.trim())

    console.log(`${dryRun ? "[dry-run] " : ""}Staging: "${title}" (slug: ${slug})`)

    if (dryRun) {
      console.log("  --- body preview (first 200 chars) ---")
      console.log("  " + emailBody.slice(0, 200).replace(/\n/g, "\n  "))
      continue
    }

    const result = await createDraft(env, title, emailBody, slug)
    console.log(`  Created Buttondown draft: ${result.id ?? "(no id returned)"}`)

    const updatedRaw = setFrontmatterField(piece.raw, "newsletter", "staged")
    writeFileSync(piece.path, updatedRaw, "utf-8")
    console.log(`  Marked newsletter: staged in ${piece.file}`)
  }

  if (!dryRun) {
    console.log("\nDone. Review each draft in your Buttondown dashboard and send it from there --")
    console.log("this script never sends on its own.")
  }
}

main().catch((err) => {
  console.error("Error:", err.message)
  process.exit(1)
})
