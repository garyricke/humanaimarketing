#!/usr/bin/env node
/**
 * Upload the three hero slideshow images to Cloudinary.
 *
 * Reads .env (CLOUDINARY_URL), uploads each JPG under the
 * `human-ai-marketing/hero/` folder with stable public_ids:
 *   batavia, geneva, st-charles
 *
 * Run from project root:    node scripts/upload-hero-images.mjs
 */

import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, basename } from "node:path";

const ROOT = process.cwd();
const HERO_DIR = join(ROOT, "brand/web/assets/hero");

// ---------------------------------------------------------------------------
// Load .env
// ---------------------------------------------------------------------------
let envText;
try {
  envText = readFileSync(join(ROOT, ".env"), "utf-8");
} catch {
  console.error("ERR: Could not read .env at project root.");
  process.exit(1);
}
const env = {};
for (const line of envText.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}
if (!env.CLOUDINARY_URL) {
  console.error("ERR: CLOUDINARY_URL missing in .env");
  process.exit(1);
}
const m = env.CLOUDINARY_URL.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
if (!m) {
  console.error("ERR: CLOUDINARY_URL format invalid");
  process.exit(1);
}
const [, KEY, SECRET, CLOUD] = m;

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------
const FILES = [
  { local: "batavia.jpg",   id: "batavia"    },
  { local: "geneva.jpg",    id: "geneva"     },
  { local: "st-charles.jpg",id: "st-charles" },
];
const FOLDER = "human-ai-marketing/hero";

async function upload({ local, id }) {
  const path = join(HERO_DIR, local);
  const bytes = readFileSync(path);
  const sizeKB = Math.round(statSync(path).size / 1024);
  const ts = Math.floor(Date.now() / 1000).toString();

  // Signature: sort, join, sha1 with secret. Overwrite + invalidate so we can re-run.
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
  form.append("file", new Blob([bytes], { type: "image/jpeg" }), basename(local));
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
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cloudinary API ${res.status} for ${id}\n${body.slice(0, 500)}`);
  }
  const data = await res.json();
  console.log(`  ✓ ${id.padEnd(12)} ${sizeKB} KB → ${data.secure_url}`);
  return data;
}

(async () => {
  console.log(`\nUploading to Cloudinary  (cloud=${CLOUD}, folder=${FOLDER})\n`);
  const results = [];
  for (const f of FILES) {
    results.push(await upload(f));
  }
  console.log("\n--- Public IDs ready for delivery ---");
  for (const r of results) {
    console.log(`  ${r.public_id}`);
  }
  console.log(`\nDelivery URL pattern:`);
  console.log(`  https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,w_<W>/<public_id>.jpg`);
  console.log("");
})().catch((e) => {
  console.error("\nFAIL — " + e.message + "\n");
  process.exit(1);
});
