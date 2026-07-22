// Pulse checker. Plain Node 20+, built-in fetch, zero dependencies.
//
// Reads targets.json, checks every target concurrently, writes status.json
// (latest run) and history.json (rolling window), prints one line per target,
// and exits 1 if anything is down — the exit code is what makes the GitHub
// Actions run fail, which is what triggers the alert email.
//
// A Supabase target issues a real REST select, not a ping: the query is the
// keep-alive that stops the free-tier project from pausing.

import { readFileSync, writeFileSync } from "node:fs";

const TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 10_000;
const HISTORY_DAYS = 30;

const here = (f) => new URL(f, import.meta.url);
const targets = JSON.parse(readFileSync(here("./targets.json"), "utf8"));

function requestFor(t) {
  if (t.supabase) {
    const base = process.env[t.supabase.urlEnv];
    const key = process.env[t.supabase.keyEnv];
    if (!base || !key) {
      return { missing: `${t.supabase.urlEnv} / ${t.supabase.keyEnv} not set` };
    }
    return {
      url: `${base.replace(/\/+$/, "")}/rest/v1/${t.supabase.table}?select=id&limit=1`,
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      okBelow: 300, // the select must actually succeed
    };
  }
  return { url: t.url, headers: {}, okBelow: t.okBelow ?? 400 };
}

async function attempt(req) {
  const started = Date.now();
  try {
    const res = await fetch(req.url, {
      headers: req.headers,
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { up: res.status < req.okBelow, code: res.status, ms: Date.now() - started };
  } catch (err) {
    const error =
      err.name === "TimeoutError" ? "timeout" : err.cause?.code ?? err.message;
    return { up: false, code: null, ms: Date.now() - started, error };
  }
}

async function check(t) {
  const req = requestFor(t);
  // A missing secret is reported as down, never silently skipped — a
  // misconfigured keep-alive that looks green is the worst failure mode.
  if (req.missing) {
    return { id: t.id, group: t.group, name: t.name, up: false, code: null, ms: null, error: req.missing };
  }
  let result = await attempt(req);
  if (!result.up) {
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    result = { ...(await attempt(req)), retried: true };
  }
  return { id: t.id, group: t.group, name: t.name, ...result };
}

const results = await Promise.all(targets.map(check));
const now = new Date().toISOString();

writeFileSync(
  here("./status.json"),
  JSON.stringify({ generatedAt: now, targets: results }, null, 2) + "\n"
);

// history.json: [{ at, r: { id: [up01, ms|null] } }], pruned to HISTORY_DAYS.
let history = [];
try {
  history = JSON.parse(readFileSync(here("./history.json"), "utf8"));
} catch {
  // first run, or the file is corrupt — either way start fresh
}
history.push({
  at: now,
  r: Object.fromEntries(results.map((x) => [x.id, [x.up ? 1 : 0, x.ms]])),
});
const cutoff = Date.now() - HISTORY_DAYS * 86_400_000;
history = history.filter((h) => Date.parse(h.at) >= cutoff);
writeFileSync(here("./history.json"), JSON.stringify(history) + "\n");

for (const x of results) {
  console.log(
    `${x.up ? "UP  " : "DOWN"}  ${x.group} / ${x.name}` +
      `  ${x.code ?? "-"} ${x.ms ?? "-"}ms` +
      (x.error ? `  ${x.error}` : "") +
      (x.retried ? "  (retried)" : "")
  );
}
process.exit(results.some((x) => !x.up) ? 1 : 0);
