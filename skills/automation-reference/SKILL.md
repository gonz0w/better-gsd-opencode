---
name: automation-reference
description: CLI and service automation patterns — what agents must automate vs what needs human action, service CLI commands, environment variable automation, dev server lifecycle, CLI installation handling, and pre-checkpoint automation failure recovery.
type: shared
agents: [executor, planner, github-ci]
sections: [golden-rule, service-cli, env-vars, dev-server, cli-install, pre-checkpoint-failures, automatable-reference]
---

## Purpose

Codifies the automation-first principle: if it has a CLI or API, the agent does it. Humans only perform truly manual actions (visual checks, email verification, 2FA). This reference ensures agents never ask users to run commands they could automate, and provides the specific CLI commands for common services.

## Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| (none) | This skill uses no placeholders | — |

## Content

<!-- section: golden-rule -->
### The Golden Rule

**If it has CLI/API, the agent does it. Never ask the human to perform automatable work.**

Users NEVER run CLI commands. Users ONLY:
- Visit URLs and evaluate visuals
- Click UI elements
- Provide secrets (API keys, credentials)
- Perform 2FA/email verification
<!-- /section -->

<!-- section: service-cli -->
### Service CLI Reference

| Service | CLI | Key Commands | Auth Gate |
|---------|-----|--------------|-----------|
| Vercel | `vercel` | `--yes`, `env add`, `--prod`, `ls` | `vercel login` |
| Railway | `railway` | `init`, `up`, `variables set` | `railway login` |
| Fly | `fly` | `launch`, `deploy`, `secrets set` | `fly auth login` |
| Stripe | `stripe` + API | `listen`, `trigger`, API calls | API key in .env |
| Supabase | `supabase` | `init`, `link`, `db push`, `gen types` | `supabase login` |
| Upstash | `upstash` | `redis create`, `redis get` | `upstash auth login` |
| PlanetScale | `pscale` | `database create`, `branch create` | `pscale auth login` |
| GitHub | `gh` | `repo create`, `pr create`, `secret set` | `gh auth login` |
| Convex | `npx convex` | `dev`, `deploy`, `env set`, `env get` | `npx convex login` |
<!-- /section -->

<!-- section: env-vars -->
### Environment Variable Automation

**Local env files:** Use Write/Edit tools. Never ask human to create .env manually.

**Platform env vars via CLI:**

| Platform | Command | Example |
|----------|---------|---------|
| Convex | `npx convex env set` | `npx convex env set OPENAI_API_KEY sk-...` |
| Vercel | `vercel env add` | `vercel env add STRIPE_KEY production` |
| Railway | `railway variables set` | `railway variables set API_KEY=value` |
| Fly | `fly secrets set` | `fly secrets set DATABASE_URL=...` |
| Supabase | `supabase secrets set` | `supabase secrets set MY_SECRET=value` |

**Secret collection pattern:** Ask user for the value, then add it via CLI. Never ask user to navigate dashboards.
<!-- /section -->

<!-- section: dev-server -->
### Dev Server Lifecycle

| Framework | Start Command | Ready Signal | Default URL |
|-----------|---------------|--------------|-------------|
| Next.js | `npm run dev` | "Ready in" | http://localhost:3000 |
| Vite | `npm run dev` | "ready in" | http://localhost:5173 |
| Convex | `npx convex dev` | "Convex functions ready" | N/A |
| Express | `npm start` | "listening on port" | http://localhost:3000 |

```bash
# Run in background, wait for ready
npm run dev &
DEV_SERVER_PID=$!
timeout 30 bash -c 'until curl -s localhost:3000 > /dev/null 2>&1; do sleep 1; done'
```

**Port conflicts:** Kill stale process (`lsof -ti:3000 | xargs kill`) or use alternate port.

**Server stays running** through checkpoints. Only kill when plan complete or port needed elsewhere.
<!-- /section -->

<!-- section: cli-install -->
### CLI Installation Handling

| CLI | Auto-install? | Command |
|-----|---------------|---------|
| vercel | Yes | `npm i -g vercel` |
| gh | Yes | `brew install gh` or `apt install gh` |
| stripe | Yes | `npm i -g stripe` |
| supabase | Yes | `npm i -g supabase` |
| convex | No — use npx | `npx convex` |
| fly | Yes | `brew install flyctl` |
| railway | Yes | `npm i -g @railway/cli` |

**Protocol:** Try command → "not found" → auto-installable? → yes: install, retry → no: checkpoint.
<!-- /section -->

<!-- section: pre-checkpoint-failures -->
### Pre-Checkpoint Automation Failures

| Failure | Response |
|---------|----------|
| Server won't start | Fix issue, retry (don't proceed to checkpoint) |
| Port in use | Kill stale process or use alternate port |
| Missing dependency | `npm install`, retry |
| Build error | Fix error first |
| Auth error | Create auth gate checkpoint |
| Network timeout | Retry with backoff, then checkpoint if persistent |

**Never present a checkpoint with broken verification environment.** If `curl localhost:3000` fails, don't ask user to visit localhost:3000.
<!-- /section -->

<!-- section: automatable-reference -->
### Quick Automatable Reference

| Action | Automatable? | Agent does it? |
|--------|-------------|----------------|
| Deploy to Vercel | Yes (`vercel`) | YES |
| Create Stripe webhook | Yes (API) | YES |
| Write .env file | Yes (Write tool) | YES |
| Run tests | Yes (`npm test`) | YES |
| Start dev server | Yes (`npm run dev`) | YES |
| Add env vars to platform | Yes (CLI) | YES |
| Seed database | Yes (CLI/API) | YES |
| Click email verification | No | NO |
| Enter credit card 3DS | No | NO |
| Complete OAuth in browser | No | NO |
| Visually verify UI | No | NO |
<!-- /section -->

## Cross-references

- <skill:checkpoint-protocol /> — Checkpoint handling uses automation patterns
- <skill:planner-checkpoints /> — Planning checkpoints follows automation-first

## Examples

See `references/checkpoints.md` `<automation_reference>` section and `references/ui-brand.md` for the original sources.
