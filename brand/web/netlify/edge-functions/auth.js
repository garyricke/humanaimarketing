/**
 * HTTP Basic Auth gate for the intern handbook.
 * Set HANDBOOK_PASSWORD in Netlify dashboard → Site config → Environment variables.
 * Username is fixed as "intern"; share both with the team via 1Password (or similar).
 */
export default async (request, context) => {
  const password = Deno.env.get("HANDBOOK_PASSWORD");

  if (!password) {
    return new Response(
      "Handbook is not configured. Set HANDBOOK_PASSWORD in Netlify env vars.",
      { status: 500, headers: { "Content-Type": "text/plain" } }
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const expected = "Basic " + btoa(`intern:${password}`);

  if (authHeader !== expected) {
    return new Response("Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Human AI Intern Handbook"',
        "Content-Type": "text/plain",
        "Cache-Control": "no-store",
      },
    });
  }

  return context.next();
};

export const config = { path: ["/handbook", "/handbook/*"] };
