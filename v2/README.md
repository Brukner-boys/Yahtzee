# Yatzi v2 — Multiplayer Server

Multiplayer Yatzi (Israeli multi-column variant) over WebSocket.
Authoritative server holds the engine; clients send intents and receive state.

## Local development

```bash
cd v2
npm install --ignore-scripts
node server/index.js
# server listens on http://localhost:8080
```

Open http://localhost:8080 in two browser windows (or one normal + one private).

The single-player v1 game is also served at http://localhost:8080/v1/.

## Smoke test

With the server running:

```bash
node server/smoke-ws.js
```

This exercises room creation, joining, starting a game, rolling, and confirms
the server rejects out-of-turn moves.

## Deployment to fly.io (free tier)

One-time setup:

```bash
# 1. Install the CLI
brew install flyctl

# 2. Sign up / log in (free tier requires card for verification but does not charge)
fly auth signup    # or `fly auth login`

# 3. From the repo root (where fly.toml lives), launch the app
fly launch --no-deploy
#   - Confirm app name (e.g. "yatzi-yourname")
#   - Choose region: fra (Frankfurt) or cdg (Paris) for IL latency
#   - Skip Postgres / Redis
#   - Skip auto-deploy on first run

# 4. Set the HMAC secret (used to sign session tokens)
fly secrets set HMAC_SECRET=$(openssl rand -hex 32)

# 5. Deploy
fly deploy
```

After deploy:

- Open `https://<app-name>.fly.dev` — the game loads over HTTPS.
- WebSocket connects automatically via `wss://`.
- View logs with `fly logs` (no IPs, nicknames, or tokens are logged — only event names).
- Stop the app temporarily: `fly scale count 0`. Restart: `fly scale count 1`.
- Tear it down entirely: `fly destroy <app-name>`.

### Updating

After making changes locally:

```bash
fly deploy
```

That's the whole loop.

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `HMAC_SECRET` | Sign session tokens (required in prod) | dev random (ephemeral) |
| `PORT` | TCP port to listen on | `8080` |
| `HOST` | Bind address | `0.0.0.0` |
| `TRUST_PROXY` | Set to `1` behind a reverse proxy | `0` |

## Security model (summary)

What the server defends against:
- **In-game cheating** — server rolls dice and validates moves; client can only send intents.
- **API-key theft / credential exfil** — no secrets stored, no outbound HTTP calls.
- **Confidential data leaks** — only nickname (chosen ad-hoc) lives in memory; no logs of PII.
- **XSS leading to token theft** — strict CSP, `textContent` everywhere, validated nicknames.
- **Buffer/memory disclosure** — `ws` upgraded past the GHSA-58qx-3vcg-4xpx fix.
- **Malformed messages** — strict JSON validation + 4KB `maxPayload` on the WS server.

What the server intentionally does NOT defend against:
- DDoS / temporary unavailability (acceptable; managed PaaS isolates the host).
- Brute-forcing room codes (729M space, no lockout — by design).

See `../docs` or the plan file for the full threat model.
