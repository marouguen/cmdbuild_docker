# Test results — 2026-09-14

Environment: local openMAINT 2.4 / CMDBuild 4.2, REST v3, Node 24.15.0, Windows,
Microsoft Edge 153 / Chromium with iPhone 13 viewport emulation (390px).

## Results

| Check | Result |
|---|---|
| Type checking | PASS (`vue-tsc --noEmit`) |
| Logic tests | PASS; initial 28 tests, subsequent metadata-hardening tests documented in final verification below |
| Production build | PASS; Vite output about 129 KB JS / 48 KB gzip before final metadata compatibility guard |
| Live browser suite | **7 / 7 PASS**, including one-shot workflow advance |
| Mobile layout | Inspected jobs, knowledge, execution screenshots; no horizontal overflow on tested knowledge screen |
| Login/current user/logout | PASS with admin |
| Real session revocation | PASS; HTTP 401 caused PWA return to login |
| Job details/knowledge | PASS against protected example, read-only |
| Execution save and action review | PASS on 436988 |
| PWA conclude | PASS on 438032, Execution → Accounting |
| Photo upload/download | PASS on 436988 |
| Labour creation | PASS on 436988; zero test rates |
| Static cache/offline boot | PASS; JS/CSS/manifest/icons cached, no API URLs in Cache Storage; offline login shell rendered |
| Technician account | NOT RUN — credentials missing |
| Change-assignee/reschedule advancement | NOT RUN; options and client validations tested |
| Warehouse consumption | NOT RUN — no consumable records/stock fixture |
| Physical phone install/camera and production TLS | NOT RUN |

## Disposable records left for review

| Record | Purpose / final state |
|---|---|
| **431763 / CM.000.000.002** | Protected original. Accounting, unchanged `_beginDate` `2026-09-14T00:42:18.638147Z`. No writes from this project. |
| **436988 / CM.000.000.003** | `PWA TEST - disposable technician integration`; remains Execution; team MAINT-01. Repeatable mobile save, knowledge, attachment, and labour fixture. |
| **438032 / CM.000.000.004** | `PWA TEST - one-shot workflow advancement`; concluded once through the PWA, now Accounting. Do not advance again. |
| **431233** | Existing KB topic, read and linked. Topic content itself not changed. |
| **437279** | MaintProcessTopic relation from 436988 to existing topic. |
| **437284** | REST labour fixture, 0.25 hours, zero rate. |

Fixture 436988 also holds `pwa-test.png`, `icon-192.png`, and two zero-rate browser labour
test entries. An early test checked for an existing labour row before its asynchronous load
finished and created a second test row; the suite now waits for data/permission loading.
These records are explicitly disposable, not actual maintenance or expense. No inventory was
changed. No cleanup of existing business records was attempted.

## Browser defects found and fixed

- Native browser fetch requires a valid receiver: replaced stored unbound fetch with a wrapper.
- Vite's `Vary: Origin` prevented cached cross-origin-mode static modules matching offline:
  ignored Vary only within the generated static asset allowlist.
- Fixed test selectors and readiness checks before repeated attachment/labour operations.
- Stacked datetime inputs on narrow screens after visual inspection showed clipped values.

## Reproduction

Run `npm.cmd ci`, `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run build`, then start
`npm.cmd run preview`. Set test credentials in `OPENMAINT_USER` / `OPENMAINT_PASSWORD` and
run `npm.cmd run test:browser`. This runs six repeatable live tests and skips the one-shot
advancement test. Never enable one-shot advancement just to improve a test count.

Unit tests cover authentication state, expiry, transport/envelope errors, no automatic write
retries, cross-session response rejection, job mapping/narrowing, filtered actions, required
Execution payload fields, date order, forbidden fields, stale state, labour validation, and
knowledge copy behavior. API responses used for metadata fixtures came from this instance.

Live traces are disabled; screenshots and raw investigation files are ignored by Git.
Test-generated sessions are revoked at the end of successful test flows; local credentials
are not written into application source or checked-in test files.

## Final verification

See the final run recorded below after metadata compatibility hardening.
