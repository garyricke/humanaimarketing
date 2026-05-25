#!/usr/bin/env node
/**
 * Upload the portrait "before/after" demo trio to Cloudinary:
 *   - original selfie (sample input)
 *   - Gemini (nano-banana) edit
 *   - OpenAI (gpt-image-1) edit
 *
 * All three go to brand/placeholders/ with stable public IDs so the
 * handbook slideshow URLs never change.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const ROOT = process.cwd();
const GEN_DIR = join(ROOT, "generated_imgs");
const ORIGINAL = "/Users/garyricke/Downloads/gary-ricke-sample-image.jpeg";

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

// nano-banana edits are named edited-<timestamp>-<id>.png; pick the newest.
const newestEdit = readdirSync(GEN_DIR)
  .filter((f) => f.startsWith("edited-") && f.endsWith(".png"))
  .map((f) => ({ f, t: statSync(join(GEN_DIR, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t)[0].f;

const FILES = [
  { path: ORIGINAL,                                  id: "portrait-original", mime: "image/jpeg" },
  { path: join(GEN_DIR, newestEdit),                 id: "portrait-gemini",   mime: "image/png"  },
  { path: join(GEN_DIR, "gary-portrait-openai.png"), id: "portrait-openai",   mime: "image/png"  },
];
const FOLDER = "brand/placeholders";

async function upload({ path, id, mime }) {
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
  form.append("file", new Blob([bytes], { type: mime }), id);
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
  console.log(`  ✓ ${id.padEnd(20)} ${sizeKB} KB → ${data.secure_url}`);
}

console.log(`\nUploading portrait trio to Cloudinary  (cloud=${CLOUD}, folder=${FOLDER})\n`);
for (const f of FILES) await upload(f);
console.log("");
