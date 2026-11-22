// Builds the "set this up with an AI coding agent" prompt shown on the API docs tab. Pure (no React, no browser globals except in copyText), so it can be
// tested with node. Everything factual in it (base URL, field list, error codes) comes from the same server document the docs page is rendered from, so the
// prompt cannot disagree with the API. It never contains a real key: the agent is told to read it from an environment variable.

const typeOf = (v) => (v.enum ? v.enum.map((x) => `"${x}"`).join(' | ') : Array.isArray(v.type) ? v.type.join(' | ') : v.type || 'object');

export function buildAgentPrompt(d) {
  const req = d.openapi.components.schemas.EligibilityRequest;
  const required = new Set(req.required || []);
  const fields = Object.entries(req.properties || {})
    .map(([k, v]) => `- \`${k}\` (${typeOf(v)}${required.has(k) ? ', required' : ', optional'})${v.description ? `: ${v.description}` : ''}`)
    .join('\n');
  const resp = d.openapi.components.schemas.EligibilityResponse;
  const respFields = Object.keys((resp && resp.properties) || {}).join(', ');
  // Only transient errors are worth an automatic retry. A 402 (no balance, credit limit, overdue invoice) needs a person to act, so it is never retried in a loop.
  const retryable = d.errors.filter((e) => e.retry && e.status !== 402).map((e) => `${e.status} ${e.code}`).join(', ');
  const payment = d.errors.filter((e) => e.status === 402).map((e) => e.code).join(', ');
  const terminal = d.errors.filter((e) => !e.retry && e.status !== 402).map((e) => `${e.status} ${e.code}`).join(', ');
  const base = d.api_base;

  return `You are integrating the Cred2Tech ESR API into my existing project. Work in my codebase, follow its conventions, and keep changes small and reviewable.

# What the API does
Eligibility as a service for Indian lending. I send an applicant's RAW financial facts (ITR figures, GST sales, bank balances, salary slips, existing loans) and get back, for each lender, whether the applicant is eligible, for how much, at what rate, tenure and EMI. The API assesses ONLY two products: Home Loan ("HL") and Loan Against Property ("LAP"). Never send a computed income, only raw facts. Results are indicative, not a sanction or an offer.

# Connection
- Base URL: ${base}
- Auth: header \`X-API-Key: <key>\`. Test keys start with \`c2t_uat_\`, production keys with \`c2t_live_\`; a key only works in its own environment.
- The call MUST come from a server whose public IP is on my allow-list in the Cred2Tech dashboard (Keys & IP addresses). Call the API from my BACKEND only, never from browser or mobile code: the key is a secret and the API intentionally has no CORS.
- Read the key from the environment variable \`C2T_API_KEY\` (and the base URL from \`C2T_API_BASE_URL\`, default ${base}). NEVER hard-code a key, log it, or commit it. Add both to the project's env example file and to its secrets/config documentation. Ask me for the key value; do not invent one.

# Endpoints
- POST ${base}/eligibility: run an assessment (this is the main call).
- POST ${base}/eligibility/validate: validate a request body WITHOUT running the engine or charging. Use it in tests and before going live.
- GET ${base}/lenders: the lenders you can assess against.
- GET ${base}/schema: the authoritative JSON Schema of the request (needs the key). Fetch it and generate/validate types from it rather than guessing.
- GET ${base}/requests/{request_id}: fetch a past result.
- GET ${base}/usage, GET ${base}/health.

# Request body (POST /eligibility), top-level fields
${fields}

Notes:
- \`as_of\` is accepted ONLY with a test key (UAT). Do not send it in production: the server uses today's date (IST) and refuses the field.
- Large bodies may be gzip-compressed (\`Content-Encoding: gzip\`); there is no size limit on applicant data.
- Content-Type must be \`application/json\`.
- Dates are ISO \`YYYY-MM-DD\`. Money is a plain number in rupees (no strings, no commas).

# Response (200)
Top-level fields: ${respFields}. \`summary.eligible_lenders\` and \`summary.best_offer\` give the headline; \`lenders[]\` has one entry per lender and product with \`status\` ("eligible" | "not_eligible"), \`amount\`, \`roi_percent\`, \`tenure_months\`, \`emi\` and, when not eligible, \`reasons[]\`. \`data_gaps\` lists facts that would sharpen the result. Always show \`disclaimer\` wherever results are displayed.

# Idempotency, retries and timeouts (important, this costs money in production)
- Production calls MUST send an \`Idempotency-Key\` header (8 to 128 chars: letters, digits, . _ : -). Generate ONE key per logical assessment (for example a UUID stored with the application) and REUSE THE SAME KEY when you retry that assessment. Same key + same body returns the original result and is charged once. Same key + different body is refused.
- A production call is charged only when it succeeds; failed calls are never charged.
- Retry with exponential backoff and jitter (max 3-5 attempts, honour the \`Retry-After\` header) ONLY for: ${retryable}, and network timeouts. Never retry the rest: ${terminal}.
- HTTP 402 (${payment}) means the account has no balance or credit, or an invoice is overdue. Do NOT retry in a loop: stop, raise a clear alert to the developer/operator ("Cred2Tech account needs a top-up or payment"), and fail the assessment gracefully so the user sees a sensible message. Nothing was charged.
- Use a generous client timeout (120 seconds) for /eligibility; large requests can take a while.
- On any error the body is \`{ "error": { "code", "message", "request_id", "fields"? } }\`. Log \`request_id\` (never the key or the applicant's personal data) so I can quote it to Cred2Tech support. \`error.fields\` lists every validation problem with a path: surface them to the developer.

# What to build
1. Inspect my project first (language, framework, HTTP client, config and secrets handling, test setup, where applicant data lives) and tell me your plan in a few lines before changing code.
2. Add ONE small, well-named API client module (for example \`cred2techEligibility\`) that: builds the request from my applicant data, calls POST /eligibility with the headers above, handles errors and retries as described, and returns a typed result. Keep secrets and base URL in env config.
3. Add a mapper from my own data model to the request body. Where my data lacks a required fact, do not guess: leave it out if optional, or tell me what is missing.
4. Wire it into the place in my app where an eligibility check is needed, behind a feature flag so I can switch it off.
5. Add tests: unit tests with the HTTP layer mocked (success, 4xx validation error, 429/503 retry with the SAME Idempotency-Key, timeout), plus one opt-in integration test that calls /eligibility/validate with a TEST key.
6. Add a short README section: required env vars, how to add the server's IP to the allow-list, test vs production keys.

# Rules
- Test with a test key (\`c2t_uat_...\`) first, using /eligibility/validate and then /eligibility. Do not use a production key until I say so.
- Do not send real customers' personal data (PAN, Aadhaar, mobile, account numbers) in tests, logs or fixtures; use obviously fake data.
- Never expose the key to a browser, a mobile app, logs, error messages or version control.
- If something in this prompt conflicts with ${base}/schema, trust the schema and tell me.

Start by asking me for: the language/framework if you cannot tell, and my test key (or confirm it is set in the environment).`;
}

/** Copies text to the clipboard, with the same fallback the app's CopyButton uses. Returns true on success. */
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  try {
    const el = document.createElement('textarea');
    el.value = text; el.style.position = 'fixed'; el.style.opacity = '0';
    document.body.appendChild(el); el.select();
    const ok = document.execCommand('copy');
    el.remove();
    return ok;
  } catch { return false; }
}
