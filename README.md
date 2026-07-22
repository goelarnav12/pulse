# Pulse

A personal status page for my deployed apps — and, more importantly, the
**keep-alive that stops the free-tier Supabase projects from pausing** (they
pause after ~7 days without API activity and paused projects are eventually
deleted).

Every 30 minutes a GitHub Actions cron runs `check.mjs`, which:

1. pings every deployed surface (Vercel apps, GitHub Pages, Cloudflare Worker),
2. issues a **real REST select** against both Supabase projects — that query is
   the keep-alive,
3. commits `status.json` + `history.json` back to this repo, and
4. exits non-zero if anything is down, which fails the workflow — and GitHub
   emails me on workflow failure. That's the whole alerting stack: no
   third-party email service, no accounts, no cost.

`index.html`, served by GitHub Pages from this repo, reads those two JSON files
and renders the green/red page with a 24 h tick strip and 30-day uptime per
target.

## What's watched

See `targets.json` — Poker Ledger (Vercel + GitHub Pages + Supabase), Iron Log
(Vercel + Supabase), Tally (Vercel + Cloudflare Worker; D1 never pauses so a
liveness ping is enough).

## Run it locally

No dependencies, Node 20+:

```sh
export POKER_SUPABASE_URL=... POKER_SUPABASE_KEY=...
export IRONLOG_SUPABASE_URL=... IRONLOG_SUPABASE_KEY=...
node check.mjs                 # writes status.json + history.json, exits 1 if anything is down
python3 -m http.server 8000    # open http://localhost:8000 for the page
```

The four values live in the repo's Actions secrets under the same names.
They're Supabase anon/publishable keys — public by design, protected by RLS —
kept out of the repo anyway because there's no reason to publish them here.

## Design notes

- **A missing secret reports as DOWN, never skipped.** A keep-alive that
  silently stops keeping alive is the worst failure mode this project has.
- Each check retries once after 10 s so a single network blip doesn't email me.
- The workflow's own status commits count as repo activity, which stops GitHub
  from disabling the cron after 60 days of inactivity — the monitor keeps
  itself alive too.
- The page shows a yellow "stale" banner if the newest result is older than
  90 minutes: that means the *checker* is broken, which no green row can be
  trusted through.
- No build step, no framework, no dependencies — one script, one page.
