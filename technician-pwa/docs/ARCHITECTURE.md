# Architecture

Browser → same-origin reverse proxy → openMAINT REST v3 → existing openMAINT services.
No maintenance database, SQL writes, new backend workflow, or openMAINT source modification.

## Application structure

`src/api` contains the REST boundary. `stores/auth.ts` holds the active session in memory.
`views` contain the authorized job list and detail shell. `components` contain execution,
knowledge, DMS, and accounting interfaces. API errors are rendered as text. Knowledge and
register HTML use DOMPurify with a small formatting-only allowlist; remote images, links,
styles, scripts, embedded forms, and event handlers are not rendered.

Vue is the UI runtime; DOMPurify is the only additional browser runtime dependency.
Vite, TypeScript, Vitest, and Playwright are build/test dependencies. No router or replicated
data store is required for this milestone. Desktop and mobile use the same simple card UI.

## Sessions and authorization

Login obtains a user-scoped session. Every REST call uses that session's authorization header.
No cookies, credential-bearing URLs, localStorage, IndexedDB, or persisted sessions are used.
Logout attempts server revocation then clears local state even if the server is unreachable.
401 clears the current session and removes mounted job views; 403 is an operation-level error.
Responses started under an older session are rejected after logout/re-login.

The server's default role is used. Role switching, SSO, MFA, and password-change flows are
not implemented. Reloading requires login. Browser closure cannot guarantee session revocation;
the server's configured session lifetime remains relevant. Idle-timeout duration has not been
measured; explicit revocation/401 handling has been tested.

My Jobs lists only records returned under the active user session. Search and active/all filters
only narrow that result; they are not an authorization mechanism. Job pagination is 25 records,
and search explicitly applies to loaded records. Technician permission acceptance remains a
release gate until tested as nekraj. No inferred employee/team filter replaces backend grants.

## Workflow

Only writable `CM-Execution` activities expose editing. All actions and reference options come
from live activity metadata and lookup/card requests, including the metadata-provided ECQL
filter ID and context bindings. No action IDs are embedded in application code.

The technician UI treats Conclude as the primary path (a "Complete job" control with Outcome)
and demotes Change assignee/Reschedule into a collapsed "Can't complete this job?" section, since
those are supervisor/planner concerns that the API happens to expose on the same activity. This
is presentation-only: `mapActions` and the write payload are unchanged, and both remain available
to whichever account openMAINT's own permissions allow.

Conclude additionally requires Outcome; Change assignee requires Assignee. Date ordering and
mandatory/writable attributes are checked. These UX validations implement the observed
Execution contract, not a replacement process engine. Unknown changed validation rules or
required widgets block editing. The observed rule strings in `src/config/execution-rules.json`
are a compatibility check and are never executed. New process configurations need review.

Before PUT, the client reloads the job, active activity, metadata, and allowed actions. It blocks
an observed `_beginDate`/activity mismatch. **This is not atomic compare-and-swap**: no REST
ETag/If-Match contract has been verified. A concurrent update between final read and write
remains a limitation. The server owns the actual transition and resulting records/reports.

Writes are single-flight in each form and are never automatically retried. Transport failures
and malformed write responses are marked uncertain: users must refresh/check the server
before retrying. No unsupported idempotency header is invented. API actions require connectivity.

## Knowledge, DMS, and accounting

Topic search uses category/subcategory and optional text. This is clearly a relevance filter;
the installed widget's additional CI-specific ECQL search is not yet reproduced. Existing linked
topics remain in openMAINT relations. Copying a topic appends it after any existing `ProcessNotes`
text under a labelled "Reference only, not performed work" separator, rather than overwriting or
prepending ahead of it; openMAINT has only the single `ProcessNotes` field, so this is a UI
convention, not a stored distinction. It does not save until the normal execution save.
Draft/published state is shown exactly as returned by the API.

Photo categories are constrained by process category permissions and the configured category
type. Only the verified BaseDocument model is offered. JPEG/PNG/WebP are accepted up to
10 MB. The server still validates category-specific limits; other DMS models are not supported.
Downloads use authenticated fetch → Blob URL, never a session ID in a download URL.

Labour uses manual quantity and an explicitly entered hourly rate. No currency is invented.
The accounting enablement function, active widget CostState, class create permission, and
current writable Execution are checked before creating LabourAccMov. Advanced price lists,
overnight calculated time, VAT selection, and accounting edits/deletes are outside this version.

Warehouse movements are readable. Writes are disabled because consumables/stock are absent
and the installed widget's multi-request stock checking and partial-failure behavior need testing.
The PWA does not substitute its own inventory ledger or optimistic stock decrement.

## PWA and delivery

Build-time service worker precaches a content-versioned allowlist of static app files only.
Requests with query strings, cross-origin requests, API URLs, and all writes bypass that cache.
Static cache matches ignore Vary because the Vite preview adds `Vary: Origin` to identical
public assets; this exception is limited to the generated static allowlist. Activation removes
old static caches from previous versions. There is no background sync or offline maintenance queue.

Updates wait for old clients to close; no forced activation interrupts work. Deploy at the
dedicated origin root and retain prior hashed assets during rollout. The local preview is not a
production HTTPS service. Trusted phone HTTPS, installed-mode Safari, camera capture,
TLS/proxy configuration, device policy, and load/concurrency acceptance remain unverified.
