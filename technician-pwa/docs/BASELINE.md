# User-supplied verified baseline

Local openMAINT 2.4 / CMDBuild 4.2: http://localhost:8091/cmdbuild/;
REST `/services/rest/v3/`. Docker containers `lamastore_openmaint_app`,
`lamastore_openmaint_db`, `lamastore_openmaint_pgadmin`. PostgreSQL DMS enabled.

Authentication: POST `sessions?scope=service&returnId=true`, username/password JSON;
subsequent requests use `Cmdbuild-Authorization` session ID. No application credentials embedded.

Verified GET: classes, processes, CorrectiveMaint instances, instance activities,
activity details, `lookup_types/Process%20-%20Action/values`.

Protected existing process: 431763, CM.000.000.002, “Main hydraulic pump not working”.
Equipment LAM-EXT-01-PR01 Extrusion Press; HYD / NO-START; MAINT-01.
Already advanced from CM-Execution to CM-Accounting. Never reuse old activity
v1kpapz96flwnvgzi8w8cyub or advance this process for testing.

Proven PUT `processes/CorrectiveMaint/instances/431763`: `_activity`, `_advance:true`,
Action 261335, Outcome 261326, ISO ExecStartDate/ExecEndDate, ProcessNotes.
Execution actions: CM-Execution_Advance (Conclude activity), _Return (Change assignee),
_Back (Reschedule activity). Resolve current IDs from lookups.
Activity metadata is authoritative for writability/mandatory/validation.
Execution requires Action, ExecStartDate, ExecEndDate; conclude additionally requires Outcome.
Writable fields include those fields, ProcessNotes and Assignee.

Widgets: accountingmovements, wrhmovements, createReport, knowledgebase,
openAttachment, manageEmail, selectfrommap, linkCards. KB widget has
domainName MaintProcessTopic and ciArgument 422825. Widget endpoints remain to investigate.

Technician nekraj / EMP-NEK Hicham Nekraj, security group Team, operational MAINT-01.
Employee.Login links user; Team includes Employee creates Map_TeamsEmployees and
Map_TeamUser. Supervisor is not membership. Desktop visibility already proven.
Verify REST visibility using technician credentials; do not implement substitute authorization.

Existing KB topic: Hydraulic pump does not start; HYD / NO-START; Troubleshooting; Draft.
Existing UI can link topic and copy troubleshooting content into process register.
Preserve existing asset hierarchy and maintenance logic. No database writes.
