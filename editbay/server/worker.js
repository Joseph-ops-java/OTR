/* Edit Bay — Claude proxy for self-hosted copies (Cloudflare Worker).
   The browser sends {prompt, images:[{media_type, data}]}; this calls the Claude API with your key and
   returns the JSON object Claude wrote. The key stays here as a secret and never reaches the browser. */
import Anthropic from "@anthropic-ai/sdk";

const MAX_BODY = 12 * 1024 * 1024; // 8 small preview frames plus the timeline description
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function cors(origin, allowed) {
  const ok = allowed === "*" || allowed.split(",").map((s) => s.trim()).includes(origin);
  return ok
    ? { "access-control-allow-origin": origin || "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", vary: "origin" }
    : null;
}

function reply(status, data, headers) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...headers } });
}

/* Claude is asked for JSON; take the outermost {...} so a code fence or a stray sentence doesn't break parsing. */
function parseJson(text) {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("no JSON object in the reply");
  return JSON.parse(text.slice(a, b + 1));
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin") || "";
    const h = cors(origin, env.ALLOWED_ORIGINS || "");
    if (!h) return new Response("Origin not allowed", { status: 403 });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    if (request.method !== "POST") return reply(405, { error: "POST only" }, h);
    if (+(request.headers.get("content-length") || 0) > MAX_BODY) return reply(413, { error: "Request too large" }, h);

    let body;
    try { body = await request.json(); } catch { return reply(400, { error: "Body must be JSON" }, h); }
    const prompt = typeof body.prompt === "string" ? body.prompt.slice(0, 200000) : "";
    if (!prompt) return reply(400, { error: "Missing prompt" }, h);
    const images = (Array.isArray(body.images) ? body.images : [])
      .filter((i) => i && IMAGE_TYPES.has(i.media_type) && typeof i.data === "string")
      .slice(0, 8);

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const content = [
      ...images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.media_type, data: i.data } })),
      { type: "text", text: prompt },
    ];

    try {
      const response = await client.beta.messages.create({
        model: env.CLAUDE_MODEL || "claude-opus-5-5",
        max_tokens: 16000,
        output_config: { effort: env.CLAUDE_EFFORT || "medium" },
        // If a safety classifier declines, the API retries on a suitable fallback model in the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: "You are the assistant editor inside Edit Bay, a video editor. Reply with a single JSON object only, exactly in the shape the request asks for.",
        messages: [{ role: "user", content }],
      });
      if (response.stop_reason === "refusal") return reply(422, { error: "Claude declined this request." }, h);
      const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      return reply(200, parseJson(text), h);
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) return reply(429, { error: "Busy, try again shortly" }, h);
      if (err instanceof Anthropic.APIConnectionError) return reply(502, { error: "Couldn't reach the Claude API" }, h);
      if (err instanceof Anthropic.APIError) return reply(502, { error: "Claude API error " + err.status }, h);
      return reply(502, { error: "Couldn't read Claude's reply" }, h);
    }
  },
};
