# Status_page (Pulse)

Read `README.md` first. What matters when editing:

- **The Supabase checks are the point.** They're the keep-alive preventing
  free-tier pausing; the uptime page is a bonus. Never turn them into plain
  pings — the REST select is what registers as project activity. And a missing
  secret must stay reported as DOWN, never skipped.
- **Zero dependencies is deliberate** (the Poker_ledger school). `check.mjs`
  uses only Node built-ins; `index.html` is self-contained vanilla. No
  package.json, ever.
- **Alerting is the workflow exit code.** `check.mjs` exits 1 if anything is
  down; the workflow re-raises that *after* committing the status files, so
  the page updates even on a bad run. GitHub's failure email is the alert —
  don't add an email service.
- `status.json` and `history.json` are **written by CI**. Local runs of
  `check.mjs` overwrite them; don't commit local results, and expect rebase
  noise on them if you do (the workflow does `git pull --rebase` before push).
- History entries are keyed by target `id` in `targets.json`. Renaming an id
  orphans that target's history; add new targets with new ids instead.
- The repo is **public** (free GitHub Pages requires it). Nothing secret goes
  in it — the four Supabase values stay in Actions secrets even though anon
  keys are public by design.
