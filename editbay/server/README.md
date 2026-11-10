# Edit Bay Claude proxy

Use this only if you want Claude's features (Create, Claude chat, Review, Smart Auto Cut) in a self-hosted copy of Edit Bay. Without it, the hosted copy still edits, grades, mixes and exports. Only the AI features are off.

It's a small Cloudflare Worker. The browser sends it the edit request and up to eight small preview frames. The worker calls the Claude API with your key and returns Claude's JSON reply. **The API key stays on the worker and never reaches the browser.**

## Deploy

You need a Cloudflare account (the free plan is enough) and a Claude API key from https://platform.claude.com.

```bash
cd editbay/server
npm install
```

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

```bash
npx wrangler deploy
```

`deploy` prints the worker's URL, for example `https://editbay-claude.<your-name>.workers.dev`. Put that URL in `editbay/config.js`:

```js
claudeProxy:"https://editbay-claude.<your-name>.workers.dev"
```

## Settings (`wrangler.toml`)

| Setting | What it does |
|---|---|
| `ALLOWED_ORIGINS` | Sites allowed to call the proxy, comma-separated. Keep it to your own site. Other sites get a 403. |
| `CLAUDE_MODEL` | Optional. Defaults to `claude-opus-5-5`. |
| `CLAUDE_EFFORT` | Optional. `low`, `medium` (default), `high`, `xhigh` or `max`. Higher is slower and costs more. |

If Claude declines a request, the API retries it on a suitable fallback model (`fallbacks: "default"`).

## Costs and limits

Every Claude request is billed to your API key. Anyone who can open your hosted page can use the proxy, so:

- **Spend limit:** set a monthly spend limit for the key in the Claude Console.
- **Rate limit:** add a Cloudflare rate-limiting rule on the worker route, for example 20 requests per minute per IP.
- **Origins:** keep `ALLOWED_ORIGINS` to your own site. This stops other websites from using your proxy, but it doesn't stop scripts.
