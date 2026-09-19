# Release gates and remaining work

1. **Technician credentials required.** Requested nekraj's password; it has not been supplied.
   Do not reset it or use admin impersonation as a substitute. Run the read-only technician
   verification, then browser acceptance as Hicham. Verify server-visible jobs, direct detail
   authorization, writable Execution, filtered assignees, Topic access, DMS, and LabourAccMov.
   Also test a user without the operational team and confirm denied data is not returned.
2. **Spare-part consumption unverified.** `classes/Consumable/cards` returned total 0.
   No warehouse writes were attempted. A dedicated stock-backed fixture is needed to test
   the installed `utils_consumable_quantity_get` checks, movement/row writes, insufficient
   stock, concurrency, and partial failure. Do not create real stock merely to pass tests.
3. **Phone delivery pending.** Choose an internal reachable hostname and trusted TLS setup,
   validate the reverse proxy, then test installation and camera upload on physical devices.
   Local browser emulation is not evidence of native iOS/Android installation.
4. **Concurrent workflow writes.** The read-before-write guard is tested; a server atomic
   conditional-write contract has not been found/verified. Define acceptance before multi-user
   production rollout. Ambiguous writes are never automatically retried.
5. **Workflow coverage.** Conclude was tested through the PWA. Change assignee and reschedule
   choices/validation were tested without advancing either branch. Their resulting business
   behavior remains unexercised in this milestone. Non-Execution stages are read-only.
6. **Preventive maintenance deferred.** Do not enable until corrective technician acceptance
   is solid; checklist/task widgets require separate REST investigation.
7. **Requester direct-read grants require review.** Under the verified `Requester` session,
   `GET processes/CorrectiveMaint/instances` returned only that employee's request, but direct
   GETs for three known unrelated CorrectiveMaint IDs returned HTTP 200. The PWA only opens IDs
   obtained from the server-filtered list and offers no arbitrary-ID navigation, but this is not
   a security boundary. Correct the openMAINT row/direct-read grants before relying on request
   confidentiality.

Optional follow-up: price-list-based labour entry, relevant linked topics outside the selected
category, CI-specific KB filtering, installed-mode session convenience, richer attachment models,
and resource pagination above 100 rows.
