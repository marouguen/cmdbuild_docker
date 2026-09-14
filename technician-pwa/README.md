# Lamastore Technician PWA

Mobile-first Vue 3 / TypeScript interface to the existing openMAINT 2.4 / CMDBuild 4.2 REST API. openMAINT owns authentication, permissions, maintenance records, accounting, documents, knowledge, and workflow state.

**Status: locally tested integration milestone, not yet cleared for production rollout.**
Technician-account acceptance testing is blocked on credentials. Warehouse writes and preventive maintenance are not enabled.

## Run locally

Node 24 is the tested runtime. From this directory:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open `http://localhost:5173`. The development proxy targets the running Lamastore instance on port 8091. Sign in with your own openMAINT account. No credentials are embedded. For a production-build preview, run `npm.cmd run build`, then `npm.cmd run preview`, and open `http://localhost:4173`.

Copy `.env.example` to `.env.local` only if configuration needs changing. `VITE_API_BASE` is the browser REST path; `OPENMAINT_ORIGIN` is the development/preview proxy target. The tested fallback DMS category type is `AlfrescoCategory`; `VITE_DMS_CATEGORY_TYPE` can override it when the process does not specify a category type.

## Implemented and exercised

- Session login, current user, logout, expired-session handling, and permission errors.
- Paginated authorized corrective jobs, active/all filter, search of loaded jobs, equipment, location, priority, assignment, activity metadata, register, and history.
- Execution notes/dates, dynamic allowed actions and assignees, required-field validation, save progress, confirmation, and workflow advancement.
- Knowledge search/detail, existing topic linking, and copying content into work notes.
- Photo upload and authenticated document download using openMAINT DMS.
- Manual labour/accounting entry with explicit hours and hourly rate; backend enablement checks.
- Install manifest, generated PNG icons, responsive screens, and static-only service-worker caching.

All live acceptance results so far used **admin**, not a technician. Do not interpret a successful administrator test as proof of technician permissions. See [test results](docs/TEST_RESULTS.md) and [release blockers](docs/BLOCKERS.md).

## Verify

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Live browser tests require the preview server on port 4173 and Microsoft Edge installed. Set `OPENMAINT_USER` and `OPENMAINT_PASSWORD` in the test process environment, then run `npm.cmd run test:browser`. Traces are disabled to avoid recording credentials or authorization headers. The repeatable suite writes only to the explicitly named disposable fixture and leaves it in Execution. It skips the one-shot advancement test by default.

The one-shot advancement test was already run successfully. **Do not set `PWA_RUN_ADVANCE=yes` again** without deliberately preparing a new disposable scenario. It refuses to create a duplicate with the same subject.

For technician verification, use `node scripts/verify-technician.mjs` with the technician credentials in the environment. It authenticates as that user, reads job visibility/activity permissions, and logs out. It does not change maintenance records.

## Phone deployment

`localhost` on a phone refers to the phone. Serve `dist/` through an HTTPS origin reachable from the phone, with `/cmdbuild/services/rest/v3/` reverse-proxied to openMAINT. Browser requests must continue to carry each user's `Cmdbuild-Authorization` header; never inject a service/admin credential in the proxy.

The [Nginx example](deploy/nginx.conf) provides a same-origin static/API split, no-store API responses, no API access logs, and security headers. Its default backend address is for a Windows Docker host. It is a **deployment template**, not a deployed or validated TLS environment. Use trusted TLS termination and restrict backend access; do not expose the database or development server to technicians. Preserve older hashed build assets during upgrades until clients have closed the previous version.

On a supported browser, use Install; on iOS, use Share → Add to Home Screen. A reload requires signing in again because sessions are held only in memory. Offline mode opens the application shell, but never queues or claims to save maintenance updates. Offline data entry is not a supported workflow.

## Repository guide

- [Verified API contracts](docs/OPENMAINT_API.md)
- [Architecture and operational limits](docs/ARCHITECTURE.md)
- [Test results and disposable records](docs/TEST_RESULTS.md)
- [Remaining work](docs/BLOCKERS.md)
- [User-supplied baseline](docs/BASELINE.md)

The stack follows the official [Vue quick start](https://vuejs.org/guide/quick-start.html) and [Vite guide](https://vite.dev/guide/). TypeScript is held on 5.9 because the installed Vue type checker did not work with the registry's newer TypeScript package.
