#!/usr/bin/env node
/**
 * End-to-end smoke test for the three shared API keys.
 *
 * Reads .env from the project root, then:
 *   1. Generates one image with Gemini (Nano Banana / gemini-2.5-flash-image)
 *   2. Generates one image with OpenAI (gpt-image-1)
 *   3. Uploads both to Cloudinary
 *   4. Prints the resulting Cloudinary URLs
 *
 * Run from the project root:    node scripts/test-apis.mjs
 *
 * Cost: roughly $0.05 per run (two image gens + two Cloudinary uploads).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Step 0: Load .env from the current working directory
// ---------------------------------------------------------------------------
const envPath = join(process.cwd(), ".env");
let envText;
try {
  envText = readFileSync(envPath, "utf-8");
} catch (e) {
  console.error(`\nERR: Could not read .env at ${envPath}`);
  console.error("     Make sure you're running from the project root and that .env exists.");
  process.exit(1);
}

const env = {};
for (const rawLine of envText.split("\n")) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;
  const idx = line.indexOf("=");
  if (idx < 0) continue;
  env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
}

const need = (k) => {
  if (!env[k] || env[k] === "") {
    console.error(`\nERR: ${k} is missing or blank in .env`);
    process.exit(1);
  }
};
need("GEMINI_API_KEY");
need("OPENAI_API_KEY");
need("CLOUDINARY_URL");

// Parse: cloudinary://<api_key>:<api_secret>@<cloud_name>
const cmatch = env.CLOUDINARY_URL.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
if (!cmatch) {
  console.error("\nERR: CLOUDINARY_URL is not in the expected format.");
  console.error("     Expected: cloudinary://<api_key>:<api_secret>@<cloud_name>");
  process.exit(1);
}
const [, CLOUD_KEY, CLOUD_SECRET, CLOUD_NAME] = cmatch;

console.log("\n.env loaded:");
console.log(`  GEMINI_API_KEY:  ${env.GEMINI_API_KEY.slice(0, 6)}…${env.GEMINI_API_KEY.slice(-4)}`);
console.log(`  OPENAI_API_KEY:  ${env.OPENAI_API_KEY.slice(0, 6)}…${env.OPENAI_API_KEY.slice(-4)}`);
console.log(`  CLOUDINARY:      cloud=${CLOUD_NAME}  key=${CLOUD_KEY.slice(0, 4)}…${CLOUD_KEY.slice(-4)}`);

const PROMPT =
  "A small hand-thrown ceramic mug holding warm tea, on a sunlit wooden table by a window. Cozy afternoon light, soft photographic style.";

// ---------------------------------------------------------------------------
// Step 1: Gemini (Nano Banana)
// ---------------------------------------------------------------------------
async function genGemini() {
  console.log("\n→ Gemini  (gemini-2.5-flash-image) — generating image…");
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=" +
    env.GEMINI_API_KEY;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API ${res.status}\n${body.slice(0, 600)}`);
  }
  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) {
    throw new Error(
      "Gemini returned no image. Full response:\n" +
        JSON.stringify(data, null, 2).slice(0, 800)
    );
  }
  console.log(`  OK — ${part.inlineData.mimeType}, ${Math.round(part.inlineData.data.length * 0.75 / 1024)} KB`);
  return { b64: part.inlineData.data, mime: part.inlineData.mimeType };
}

// ---------------------------------------------------------------------------
// Step 2: OpenAI (gpt-image-1)
// ---------------------------------------------------------------------------
async function genOpenAI() {
  console.log("\n→ OpenAI  (gpt-image-1) — generating image…");
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: PROMPT,
      n: 1,
      size: "1024x1024",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API ${res.status}\n${body.slice(0, 600)}`);
  }
  const data = await res.json();
  const item = data?.data?.[0];
  if (!item) {
    throw new Error("OpenAI returned no image: " + JSON.stringify(data).slice(0, 600));
  }
  if (item.b64_json) {
    console.log(`  OK — base64, ${Math.round(item.b64_json.length * 0.75 / 1024)} KB`);
    return { b64: item.b64_json, mime: "image/png" };
  }
  if (item.url) {
    console.log(`  OK — fetching from URL: ${item.url}`);
    const imgRes = await fetch(item.url);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    return { b64: buf.toString("base64"), mime: "image/png" };
  }
  throw new Error("OpenAI response had neither b64_json nor url");
}

// ---------------------------------------------------------------------------
// Step 3: Cloudinary upload (signed)
// ---------------------------------------------------------------------------
async function uploadToCloudinary(image, publicId) {
  console.log(`\n→ Cloudinary — uploading ${publicId}…`);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = "env-test";

  // Cloudinary signature: SHA1 of (params sorted alphabetically by key) + api_secret.
  // Excludes: file, cloud_name, resource_type, api_key, signature, file extension.
  const signParams = { folder, public_id: publicId, timestamp };
  const signStr = Object.keys(signParams)
    .sort()
    .map((k) => `${k}=${signParams[k]}`)
    .join("&");
  const signature = createHash("sha1").update(signStr + CLOUD_SECRET).digest("hex");

  const form = new FormData();
  form.append("file", `data:${image.mime};base64,${image.b64}`);
  form.append("api_key", CLOUD_KEY);
  form.append("timestamp", timestamp);
  form.append("folder", folder);
  form.append("public_id", publicId);
  form.append("signature", signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: form }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cloudinary API ${res.status}\n${body.slice(0, 600)}`);
  }
  const data = await res.json();
  console.log(`  OK — ${data.secure_url}`);
  return data.secure_url;
}

// ---------------------------------------------------------------------------
// Run all three
// ---------------------------------------------------------------------------
(async () => {
  try {
    const stamp = Date.now();

    const gemini = await genGemini();
    const geminiUrl = await uploadToCloudinary(gemini, `gemini-${stamp}`);

    const openai = await genOpenAI();
    const openaiUrl = await uploadToCloudinary(openai, `openai-${stamp}`);

    console.log("\n========================================");
    console.log("  ALL THREE APIS WORK");
    console.log("========================================");
    console.log(`\n  Gemini image:  ${geminiUrl}`);
    console.log(`  OpenAI image:  ${openaiUrl}\n`);
  } catch (err) {
    console.error("\nFAIL — " + err.message + "\n");
    process.exit(1);
  }
})();
