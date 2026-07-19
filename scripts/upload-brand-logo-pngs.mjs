#!/usr/bin/env node
/**
 * Upload the PNG logo kit (rendered from the /brand/mark/ SVGs) to Cloudinary.
 * Source PNGs are rendered locally into generated_imgs/brand-logo/ via
 * headless Chrome; stable public_ids under brand/logo so the brand guide can
 * link fl_attachment download URLs by name.
 */

import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, "generated_imgs", "brand-logo");

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
  "ham-mark",
  "ham-mark-reverse",
  "ham-app-icon",
  "ham-lockup-horizontal",
  "ham-lockup-stacked",
];
const FOLDER = "brand/logo";

async function upload(id) {
  const path = join(SRC_DIR, `${id}.png`);
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
  form.append("file", new Blob([bytes], { type: "image/png" }), `${id}.png`);
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
  console.log(`  ✓ ${id.padEnd(24)} ${sizeKB} KB → ${data.secure_url}`);
}

console.log(`\nUploading brand logo PNG kit  (cloud=${CLOUD}, folder=${FOLDER})\n`);
for (const f of FILES) await upload(f);
console.log("");
