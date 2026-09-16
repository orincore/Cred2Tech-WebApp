// The dev API's first DB query after a fresh process/connection can fail
// transiently (Prisma's initial connect to the shared dev Postgres flakes
// roughly half the time — a known issue, not the server being down; a
// retried query on the same process always goes through). A one-shot fetch
// on mount has no way to recover from that: it silently lands in a .catch,
// and whatever state it was populating (e.g. per-API credit costs) is left
// at its initial default forever — which for a cost display means a DSA
// sees "0 Cr" and can't tell that's a failed fetch rather than a real price.
//
// withRetry re-runs `fn` a few times with a short backoff before giving up,
// so a transient first-query failure resolves itself instead of leaving the
// UI stuck on a default that looks like real data.
export async function withRetry(fn, { retries = 2, delayMs = 800 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}
