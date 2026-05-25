#!/usr/bin/env node
/**
 * Upload the three matched-set article thumbnails to Cloudinary.
 *
 * Each handbook article gets a stable public_id under brand/articles/ so
 * the home-page <img srcset> URLs never change.
 *
 * Order matters: the array below is sorted by article number (1, 2, 3) and
 * paired with the newest three nano-banana outputs in matching order.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const ROOT = process.cwd();
const GEN_DIR = join(ROOT, "generated_imgs");

// --- Load .env ---
const envText = readFileSync(join(ROOT, ".env"), "utf-8");
const env = {};
for (const line of envText.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}
const [, KEY, SECRET, CLOUD] = env.CLOUDINARY_URL.match(
  /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/
);

// Pick the three newest nano-banana outputs. They were generated in this
// order: api-keys, claude-code, git. The script reverses readdir's
// newest-first to oldest-first so the mapping below is correct.
const newest = readdirSync(GEN_DIR)
  .filter((f) => f.startsWith("generated-") && f.endsWith(".png"))
  .map((f) => ({ f, t: statSync(join(GEN_DIR, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t)
  .slice(0, 3)
  .reverse()                       // oldest-first within the batch
  .map((x) => x.f);

const FILES = [
  { local: newest[0], id: "article-api-keys"    },
  { local: newest[1], id: "article-claude-code" },
  { local: newest[2], id: "article-git"         },
];
const FOLDER = "brand/articles";

async function upload({ local, id }) {
  const path = join(GEN_DIR, local);
  const bytes = readFileSync(path);
  const sizeKB = Math.round(statSync(path).size / 1024);
  const ts = Math.floor(Date.now() / 1000).toString();

  const params = {
    folder: FOLDER,
    invalidate: "true",
    overwrite: "true",
    public_id: id,
    timestamp: ts,
  };
  const signStr = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  const signature = createHash("sha1").update(signStr + SECRET).digest("hex");

  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "image/png" }), local);
  form.append("api_key", KEY);
  form.append("folder", FOLDER);
  form.append("invalidate", "true");
  form.append("overwrite", "true");
  form.append("public_id", id);
  form.append("timestamp", ts);
  form.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`Cloudinary ${res.status} for ${id}\n${(await res.text()).slice(0, 500)}`);
  const data = await res.json();
  console.log(`  ✓ ${id.padEnd(22)} ${sizeKB} KB → ${data.secure_url}`);
}

console.log(`\nUploading article thumbnails  (cloud=${CLOUD}, folder=${FOLDER})\n`);
for (const f of FILES) await upload(f);
console.log("");
