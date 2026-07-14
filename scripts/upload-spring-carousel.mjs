#!/usr/bin/env node
/**
 * Upload the five spring carousel images to Cloudinary.
 *
 * Picks the five newest nano-banana outputs in generation order:
 *   1. blossoms over Wilson Street
 *   2. Fox River kayakers
 *   3. Saturday farmers market
 *   4. Bloom & Vine garden shop opening
 *   5. patio gathering under string lights
 *
 * Stored under brand/panels/spring-* with stable public_ids.
 *
 * NOTE: see cloudinary-pipeline memory — folder names matching /^v\d+$/
 * (e.g. "v2") break version-less delivery URLs. We use "brand/panels"
 * deliberately.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const ROOT = process.cwd();
const GEN_DIR = join(ROOT, "generated_imgs");

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

const newest = readdirSync(GEN_DIR)
  .filter((f) => f.startsWith("generated-") && f.endsWith(".png"))
  .map((f) => ({ f, t: statSync(join(GEN_DIR, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t)
  .slice(0, 5)
  .reverse()
  .map((x) => x.f);

const FILES = [
  { local: newest[0], id: "spring-blossoms" },
  { local: newest[1], id: "spring-river"    },
  { local: newest[2], id: "spring-market"   },
  { local: newest[3], id: "spring-garden"   },
  { local: newest[4], id: "spring-patio"    },
];
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
  console.log(`  ✓ ${id.padEnd(20)} ${sizeKB} KB → ${data.secure_url}`);
}

console.log(`\nUploading spring carousel  (cloud=${CLOUD}, folder=${FOLDER})\n`);
for (const f of FILES) await upload(f);
console.log("");
