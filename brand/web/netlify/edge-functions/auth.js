/**
 * Cookie-based gate for the intern handbook.
 *
 *   GET  /handbook/login → passes through to the branded login page
 *                          (auto-redirects to /handbook/ if already signed in)
 *   POST /handbook/login → verifies password, sets handbook_session cookie,
 *                          redirects to ?next= (or /handbook/)
 *   any other /handbook/* → requires a valid cookie, else redirects to login
 *
 * Set HANDBOOK_PASSWORD in Netlify dashboard → Site config → Environment
 * variables. Share the password with the team via 1Password.
 */
const COOKIE_NAME = "handbook_session";
const COOKIE_DAYS = 30;
const SECONDS_PER_DAY = 24 * 60 * 60;

const enc = new TextEncoder();

async function hmacKey(password) {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function toB64Url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64Url(str) {
  const padded =
    str.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (str.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function signToken(expires, password) {
  const key = await hmacKey(password);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(String(expires)));
  return `${expires}.${toB64Url(sig)}`;
}

async function verifyToken(token, password) {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const expiresStr = token.slice(0, dot);
  const sigStr = token.slice(dot + 1);
  const expires = parseInt(expiresStr, 10);
  if (!expires || expires < Date.now()) return false;

  try {
    const key = await hmacKey(password);
    return await crypto.subtle.verify(
      "HMAC",
      key,
      fromB64Url(sigStr),
      enc.encode(expiresStr)
    );
  } catch {
    return false;
  }
}

function getCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq) === name) {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return null;
}

export default async (request, context) => {
  const url = new URL(request.url);
  const password = Deno.env.get("HANDBOOK_PASSWORD");

  if (!password) {
    return new Response(
      "Handbook is not configured. Set HANDBOOK_PASSWORD in Netlify env vars.",
      { status: 500, headers: { "Content-Type": "text/plain" } }
    );
  }

  const isLoginPage =
    url.pathname === "/handbook/login" || url.pathname === "/handbook/login/";

  // Handle password submission.
  if (isLoginPage && request.method === "POST") {
    const form = await request.formData();
    const submitted = String(form.get("password") || "");
    const rawNext = String(form.get("next") || "/handbook/");
    const next = rawNext.startsWith("/handbook/") ? rawNext : "/handbook/";

    if (submitted !== password) {
      const back = `/handbook/login/?err=1&next=${encodeURIComponent(next)}`;
      return Response.redirect(new URL(back, url), 303);
    }

    const expires = Date.now() + COOKIE_DAYS * SECONDS_PER_DAY * 1000;
    const token = await signToken(expires, password);

    return new Response(null, {
      status: 303,
      headers: {
        Location: next,
        "Set-Cookie":
          `${COOKIE_NAME}=${token}; Path=/; Max-Age=${COOKIE_DAYS * SECONDS_PER_DAY};` +
          ` HttpOnly; Secure; SameSite=Lax`,
      },
    });
  }

  // GET on the login page → if already signed in, send them straight in.
  if (isLoginPage) {
    const token = getCookie(request, COOKIE_NAME);
    if (await verifyToken(token, password)) {
      return Response.redirect(new URL("/handbook/", url), 303);
    }
    return context.next();
  }

  // Every other /handbook/* path requires a valid cookie.
  const token = getCookie(request, COOKIE_NAME);
  if (!(await verifyToken(token, password))) {
    const returnTo = encodeURIComponent(url.pathname + url.search);
    return Response.redirect(
      new URL(`/handbook/login/?next=${returnTo}`, url),
      303
    );
  }

  return context.next();
};

export const config = { path: ["/handbook", "/handbook/*"] };
