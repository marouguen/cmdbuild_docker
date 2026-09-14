# Verified openMAINT REST contracts

Verified on the running Lamastore instance on **2026-09-14**, using admin unless stated otherwise.
Base: `http://localhost:8091/cmdbuild/services/rest/v3/`.
All authenticated requests use `Cmdbuild-Authorization: <session ID>`.
JSON responses use `{success, data, meta?: {total}}`; HTTP 200 alone does not establish success.
Raw responses and extracted installed frontend code are local-only under ignored `investigation/`.
Technician and other unverified behavior is tracked in [BLOCKERS.md](BLOCKERS.md).

## Authentication

| Method / endpoint | Request / purpose | Important response / observed result |
|---|---|---|
| POST `sessions?scope=service&returnId=true` | Unauthenticated JSON `{username,password}` | HTTP 200; `data._id`, username, role, availableRoles, rolePrivileges. Session authenticated subsequent requests. |
| GET `sessions/current` | Current session with authorization header | HTTP 200; username, userDescription, role, availableRoles, rolePrivileges. |
| DELETE `sessions/{sessionId}` | Revoke the caller's test session | HTTP 200 success. Subsequent authenticated GET with revoked token returned HTTP 401. |
| GET `classes` with no authorization | Authentication boundary check | HTTP 401. |

Browser tests also revoked a live PWA session and confirmed return to login with job views removed.

## Corrective jobs and workflow

| Method / endpoint | Query / purpose | Important response / observed result |
|---|---|---|
| GET `processes` | Process discovery | HTTP 200; five process definitions in initial snapshot. |
| GET `processes/CorrectiveMaint` | Process and permission metadata | HTTP 200; `_can_start`, `_attachment_access_read`, `_attachment_access_write`, `_relation_access_write`, dmsCategory, dmsCategories, attributes/groups, activities. |
| GET `processes/CorrectiveMaint/attributes` | Attribute definitions | HTTP 200; name/type, mandatory, writable, lookupType/targetClass, validationRules, metadata. |
| GET `processes/CorrectiveMaint/instances?limit=25&start=0` | Paged jobs under caller's permissions | HTTP 200; `data[]`, `meta.total`. No added assignment filter. |
| GET `processes/CorrectiveMaint/instances/{id}` | Complete job | HTTP 200. Fields below. |
| GET `processes/CorrectiveMaint/instances/{id}/activities` | Current activities | HTTP 200; `_id`, `_definition`, description, writable, performer. |
| GET `processes/CorrectiveMaint/instances/{id}/activities/{activityId}` | Current form contract | HTTP 200; attributes contain `_id`, mandatory, writable, and nested `detail`; widgets and formStructure also present. |
| GET `processes/CorrectiveMaint/start_activities` | New corrective form | HTTP 200; CM-Opening; required Requester, ShortDescr, Type, Site, Priority. |
| POST `processes/CorrectiveMaint/instances` | Disposable creation with `_activity`, `_advance:false`, ShortDescr, ProcessNotes, Requester, Type, Site, Priority, CI, Category, Subcategory | HTTP 200 success; fixture 436988 / CM.000.000.003 created at CM-Opening. Same contract created fixture 438032. |
| PUT `processes/CorrectiveMaint/instances/{id}` | `_activity:<current ID>, _advance:true` on fully populated disposable Opening | HTTP 200; Opening → Assignment. |
| PUT same | Assignment: `_activity`, `_advance:true`, dynamically resolved CM-Assignment_Advance Action, Team, ExpExecStartDate | HTTP 200; Assignment → Execution for disposable fixtures. |
| PUT same | Execution save: `_activity`, `_advance:false`, ProcessNotes, optional ExecStartDate | HTTP 200; notes persisted; activity remained Execution. Also tested through PWA browser. |
| PUT same | Execution conclude: `_activity`, `_advance:true`, Action, Outcome, ExecStartDate, ExecEndDate, ProcessNotes | PWA browser advanced **438032 from Execution to Accounting**, HTTP success and subsequent GET confirmed state. |
| GET `processes/CorrectiveMaint/instances/{id}/history?limit=20` | Activity history | HTTP 200; `_beginDate`, `_endDate`, `_historyType`, `_activity_description`, `_activity_performer`, `_user`, `__user_description`. |

Job fields used: Number, ShortDescr, Priority, Site, Floor, Room, CI, Category, Subcategory,
Team, Assignee, ProcessStatus, FlowStatus, ExecStartDate, ExecEndDate, ProcessNotes, Register.
Display labels are `_<field>_description_translation`, `_<field>_description`, and `_<field>_code`.
`_FlowStatus_code` was `open.running` for running jobs. `_beginDate` changes after job writes.

Protected job **431763 / CM.000.000.002** stayed at CM-Accounting, activity
`pat5j28kh4590aojasopekti`, performer MaintOffice. Its `_beginDate` remained
`2026-09-14T00:42:18.638147Z` throughout verification. These are observations, never cached action IDs.

### Dynamic choices and validation

GET `lookup_types/Process%20-%20Action/values` returns `_id`, code, description, active.
To get current allowed actions, use the live Action attribute's `detail.ecqlFilter.id`:

```json
{"ecql":{"id":"<metadata filter ID>","context":{"server":{"Id":436988},"client":{}}}}
```

URL-encode that object in `filter=` on the same lookup endpoint. Verified result during Execution:

| Code | Observed ID | Description |
|---|---:|---|
| CM-Execution_Advance | 261335 | Conclude activity |
| CM-Execution_Return | 384552 | Change assignee |
| CM-Execution_Back | 261336 | Reschedule activity |

Outcome values come from GET `lookup_types/MaintProcess%20-%20Outcome/values`.
Assignee choices use GET `classes/Employee/cards?limit=100&filter=<ECQL JSON>` with the
Assignee metadata filter ID and `context:{server:{},client:{"Team.Id":427035}}`.
The verified result contained **427188 / EMP-NEK**.

Execution writable fields: Action, Outcome, ExecStartDate, ExecEndDate, ProcessNotes, Assignee.
Mandatory: Action, ExecStartDate, ExecEndDate. Observed validation additionally requires Outcome
for Conclude, Assignee for Change assignee, and end date >= start date. Rule strings are nested
under `attributes[].detail.validationRules`. The application never evaluates those scripts.

## Knowledge and relations

Installed source: downloaded `components/widget/385144/default` (ZIP) and inspected
knowledgebase Mixins.js, RelatedGridController.js, and search models.

| Method / endpoint | Request / purpose | Observed result |
|---|---|---|
| GET `classes/Topic/attributes` | Topic schema | HTTP 200; Title, Content, Category, Subcategory, Type, State and inherited fields. |
| GET `classes/Topic/cards?limit=20&start=0&filter=<JSON>` | Search | HTTP 200; existing troubleshooting topic returned with both text and category/subcategory searches. |
| GET `classes/Topic/cards/431233` | Topic detail | HTTP 200; “Hydraulic pump does not start”, State Draft, Type Troubleshooting, content HTML. |
| GET `processes/CorrectiveMaint/instances/{id}/relations` | Job relations | HTTP 200; `_type`, `_sourceType/Id`, `_destinationType/Id/Description`, `_is_direct`. |
| GET `processes/MaintProcess/cards/{id}/relations` | Endpoint used by installed KB widget | HTTP 200. |
| POST same | JSON shown below | HTTP 200; relation **437279** linked fixture 436988 to topic 431233; GET of corrective relations confirmed it. |

Search filter shape:

```json
{"query":"hydraulic","attribute":{"and":[{"simple":{"attribute":"Category","operator":"equal","value":[426578]}},{"simple":{"attribute":"Subcategory","operator":"equal","value":[428139]}}]}}
```

Verified link payload:

```json
{"_type":"MaintProcessTopic","_sourceType":"MaintProcess","_sourceId":436988,"_destinationType":"Topic","_destinationId":431233,"_is_direct":true}
```

The installed widget's “copy content” concatenates Description + Content + prior ProcessNotes
in memory and saves through the normal process request. There is no separate copy-content
endpoint in that implementation. The PWA uses editable plain text converted from sanitized content.

## Attachments / photos

Endpoint and multipart names came from installed `util.api.Processes` and
`util.File.uploadFileWithMetadata` in `/ui/openmaint/app.js`.

| Method / endpoint | Request / purpose | Observed result |
|---|---|---|
| GET `dms/categories` | DMS category types | HTTP 200; AlfrescoCategory and Building - DMSCategory. |
| GET `dms/categories/_ALL/values` | Category values | HTTP 200; `_id`, `_type`, code, active, modelClass, allowedExtensions, maxFileSize, checkCount. |
| GET `classes/BaseDocument/attributes` | DMS metadata model | HTTP 200; no writable mandatory metadata fields in the tested model. |
| GET `processes/CorrectiveMaint/instances/{id}/attachments` | Existing documents | HTTP 200; `_id`, name, category, description, version, author. Protected example already had its activity PDF. |
| POST same | Multipart `file` (binary with filename), `attachment` (JSON Blob: `{category,description}`) | HTTP 200 success; uploaded `pwa-test.png` to fixture 436988, ID **uvjps89dy8z5berkq5jfgon8**. Browser separately uploaded icon-192.png. |
| GET `.../attachments/{attachmentId}/{encodedFilename}` | Authenticated binary download | Browser successfully downloaded icon-192.png with correct filename. |

Process metadata allowed Document, Image, Photo, Signature for admin. In this installation,
the Photo category under AlfrescoCategory had ID **390625** and modelClass BaseDocument.
Names/types are used to resolve categories; the application does not embed that ID. An attempt
to upload the same filename again was rejected by openMAINT, without replacing the existing file.

## Labour and warehouse reads

Installed source: widget ZIPs `components/widget/287036/default` and `components/widget/287057/default`.

| Method / endpoint | Request / purpose | Observed result |
|---|---|---|
| GET `classes/LabourAccMov` | Current class create permission | HTTP 200; `_can_create` used by browser labour entry. |
| GET `classes/LabourAccMov/attributes` | Labour schema | HTTP 200; Description, Date, Quantity, UnitPrice mandatory writable; MaintProcess, Site, Type, State, ManualQuantity, Notes available. |
| GET `classes/AccountingMov/cards?limit=100&filter=<JSON>` | Process accounting | HTTP 200; server filter below constrained records to fixture. |
| GET `classes/LabourAccMov/cards?filter=<JSON>` | Verify created labour | HTTP 200; created quantity and zero test amount returned. |
| GET `functions/wf_maintprocess_accmov_enabled/outputs?parameters=<JSON>` | Widget enablement; parameters `{"process_id":436988}` | HTTP 200; `data[0].outcome:true`. |
| GET `lookup_types/AccountingMov%20-%20Type/values` | Cost type | HTTP 200; dynamic `code:Cost` resolved. |
| GET `lookup_types/AccountingMov%20-%20State/values` | Accounting state | HTTP 200; dynamic `code:Actual` matched widget CostState. |
| POST `classes/LabourAccMov/cards` | JSON below | HTTP 200; **437284**, Quantity 0.25, TotalAmount 0. Browser labour creation also verified. |
| GET `classes/WrhMovement/attributes` | Movement schema | HTTP 200. |
| GET `classes/WrhMovementRow/attributes` | Row schema | HTTP 200; required Consumable, Quantity, WrhMovement. |
| GET `classes/WrhMovement/cards?limit=100&filter=<JSON>` | Job's warehouse movements | HTTP 200; empty for fixture. |
| GET `classes/WrhMovementRow/cards?limit=1` | Existing rows | HTTP 200; empty. |
| GET `classes/Consumable/cards?limit=10` | Existing consumables | HTTP 200; `meta.total:0`. |

Movement filter: `{"attribute":{"simple":{"attribute":"MaintProcess","operator":"equal","value":[436988]}}}`.

Verified labour payload (Type and State resolved dynamically):

```json
{"Description":"PWA TEST - labour validation","Date":"2026-09-14","MaintProcess":436988,"Site":420913,"Type":"<Cost lookup ID>","State":"<Actual lookup ID>","ManualQuantity":true,"Quantity":0.25,"UnitPrice":0,"Notes":"Disposable integration fixture; not real labour or cost."}
```

IDs in the actual JSON request were numbers. The zero rate was deliberate **test data**, not
an application default. Real labour entry requires the user to enter an agreed rate.

## Discovery provenance

GET `classes`, `components/widget`, `components/widget/385144` returned HTTP 200.
Widget ZIP download route `components/widget/{id}/default` was derived from installed REST
WidgetWs annotations (`javap`) before calling it. Only installed frontend/library files were read;
no openMAINT code was changed and no database query or write was needed.
