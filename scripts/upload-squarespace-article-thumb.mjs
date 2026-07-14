#!/usr/bin/env node
/**
 * Upload the Squarespace-pricing article thumbnail to Cloudinary.
 *
 * Stable public_id under brand/articles/ so the home-page <img srcset>
 * URLs never change. Re-running overwrites in place (overwrite +
 * invalidate), which is how every image on this site is updated.
 */

import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const ROOT = process.cwd();
const LOCAL = join(ROOT, "generated_imgs", "article-squarespace-pricing.png");
const FOLDER = "brand/articles";
const PUBLIC_ID = "article-squarespace-pricing";

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

const bytes = readFileSync(LOCAL);
const sizeKB = Math.round(statSync(LOCAL).size / 1024);
const ts = Math.floor(Date.now() / 1000).toString();

const params = {
  folder: FOLDER,
  invalidate: "true",
  overwrite: "true",
  public_id: PUBLIC_ID,
  timestamp: ts,
};
const signStr = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
const signature = createHash("sha1").update(signStr + SECRET).digest("hex");

const form = new FormData();
form.append("file", new Blob([bytes], { type: "image/png" }), `${PUBLIC_ID}.png`);
form.append("api_key", KEY);
for (const [k, v] of Object.entries(params)) form.append(k, v);
form.append("signature", signature);

console.log(`\nUploading article thumbnail  (cloud=${CLOUD}, folder=${FOLDER})\n`);

const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
  method: "POST",
  body: form,
});
if (!res.ok) {
  throw new Error(`Cloudinary ${res.status} for ${PUBLIC_ID}\n${(await res.text()).slice(0, 500)}`);
}
const data = await res.json();
console.log(`  ✓ ${PUBLIC_ID.padEnd(28)} ${sizeKB} KB → ${data.secure_url}\n`);
