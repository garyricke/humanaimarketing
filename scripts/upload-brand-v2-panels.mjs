#!/usr/bin/env node
/**
 * Upload the three brand-v2 hero-panel images to Cloudinary.
 *
 * Picks the three newest nano-banana outputs in generation order:
 *   1. apprentice + shopkeeper at the table
 *   2. community workshop
 *   3. downtown intergenerational walk
 *
 * Stored under brand/v2/ with stable public_ids so the v2 preview page can
 * reference them by name without versioning.
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

// Three newest, oldest-first within the batch — matches generation order.
const newest = readdirSync(GEN_DIR)
  .filter((f) => f.startsWith("generated-") && f.endsWith(".png"))
  .map((f) => ({ f, t: statSync(join(GEN_DIR, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t)
  .slice(0, 3)
  .reverse()
  .map((x) => x.f);

const FILES = [
  { local: newest[0], id: "panel-apprentice-shopkeeper" },
  { local: newest[1], id: "panel-community-workshop"    },
  { local: newest[2], id: "panel-downtown-walk"         },
];
// IMPORTANT: avoid folder names matching /^v\d+$/ — Cloudinary parses those
// as version segments in delivery URLs (e.g. "v2" becomes <version=2>), which
// causes 400s when the URL omits an explicit version. Hence "panels" instead
// of "v2".
const FOLDER = "brand/panels";

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
  console.log(`  ✓ ${id.padEnd(30)} ${sizeKB} KB → ${data.secure_url}`);
}

console.log(`\nUploading brand v2 panels  (cloud=${CLOUD}, folder=${FOLDER})\n`);
for (const f of FILES) await upload(f);
console.log("");
