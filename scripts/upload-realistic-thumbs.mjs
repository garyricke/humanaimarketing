#!/usr/bin/env node
/**
 * Upload the realistic UI article thumbnails to Cloudinary.
 *
 * These replace the still-life photography set in place: each image reuses
 * its article's stable public_id under brand/articles/, with overwrite +
 * invalidate, so every page that references the URL updates automatically.
 *
 * The PNGs are rendered from an HTML mockup sheet via headless Chrome
 * (2544×1696, 3:2). Pass the directory containing them as argv[2].
 */

import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const ROOT = process.cwd();
const SRC_DIR = process.argv[2];
if (!SRC_DIR) {
  console.error("Usage: node scripts/upload-realistic-thumbs.mjs <dir-with-thumb-*.png>");
  process.exit(1);
}

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

const FILES = [
  { local: "thumb-api-keys.png",    id: "article-api-keys"           },
  { local: "thumb-claude-code.png", id: "article-claude-code"        },
  { local: "thumb-git.png",         id: "article-git"                },
  { local: "thumb-squarespace.png", id: "article-squarespace-pricing" },
];
const FOLDER = "brand/articles";

async function upload({ local, id }) {
  const path = join(SRC_DIR, local);
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
  console.log(`  ✓ ${id.padEnd(28)} ${sizeKB} KB → ${data.secure_url}`);
}

console.log(`\nUploading realistic article thumbnails  (cloud=${CLOUD}, folder=${FOLDER})\n`);
for (const f of FILES) await upload(f);
console.log("");
