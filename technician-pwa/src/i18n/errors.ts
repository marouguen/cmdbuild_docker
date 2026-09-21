import { i18n } from './index';
// Maps the exact, stable English text thrown by src/api/*.ts and src/stores/auth.ts to a
// translation key. Those modules stay framework-agnostic (no vue-i18n import, no behavior
// change) and always throw plain English; this is presentation-only translation applied where
// components display the caught message. Anything that doesn't match — including text
// openMAINT itself returned dynamically — passes through untouched, in whatever language the
// server produced it.
const matchers: {test: RegExp; key: string; group?: string}[] = [
  {test: /^This request is no longer awaiting your approval\. Refresh it to see its current state\.$/, key: 'errors.approvalUnavailable'},
  {test: /^This request is no longer available in My Requests\.$/, key: 'errors.requestNotVisible'},
  {test: /^The request list changed or could not be verified\. Refresh My Requests\.$/, key: 'errors.requestListUnverified'},
  {test: /^Issue solved is not currently allowed by openMAINT\.$/, key: 'errors.issueSolvedUnavailable'},
  {test: /^Request approval is already in progress\.$/, key: 'errors.approvalPending'},
  {test: /^openMAINT did not confirm that the request completed\. Refresh before taking any further action\.$/, key: 'errors.completionUnconfirmed'},
  {test: /^This request is no longer available for Accounting\. Refresh it to see its current state\.$/, key: 'errors.accountingUnavailable'},
  {test: /^Approve is not currently allowed by openMAINT\.$/, key: 'errors.approveNotAllowed'},
  {test: /^Accounting approval is already in progress\.$/, key: 'errors.accountingPending'},
  {test: /^openMAINT did not confirm Approval for Requester\. Refresh before taking any further action\.$/, key: 'errors.accountingUnconfirmed'},
  {test: /^The queue changed while loading\. Refresh it\.$/, key: 'errors.queueChanged'},
  {test: /^Invalid API path$/, key: 'errors.invalidApiPath'},
  {test: /^Connection interrupted\. The server may have saved this change\. Refresh and check before retrying\.$/, key: 'errors.connectionInterrupted'},
  {test: /^Cannot reach openMAINT\. Check your connection and retry\.$/, key: 'errors.unreachable'},
  {test: /^Session changed\. Please reload your jobs\.$/, key: 'errors.sessionChanged'},
  {test: /^Your session has ended\. Please sign in again\.$/, key: 'errors.sessionEnded'},
  {test: /^openMAINT has not granted permission for this operation\.$/, key: 'errors.forbidden'},
  {test: /^openMAINT could not complete this request \((\d+)\)\.$/, key: 'errors.requestFailed', group: 'status'},
  {test: /^Unexpected response from openMAINT\.$/, key: 'errors.unexpectedResponse'},
  {test: /^openMAINT rejected this request\.$/, key: 'errors.rejected'},
  {test: /^openMAINT did not return a usable session\.$/, key: 'errors.noSession'},
  {test: /^Your session expired\. Sign in to continue\.$/, key: 'errors.sessionExpiredNotice'},
  {test: /^Signed out on this device\. The server could not confirm session revocation\.$/, key: 'errors.logoutUnconfirmed'},
  {test: /^Action metadata is unavailable\.$/, key: 'errors.actionMetadataUnavailable'},
  {test: /^This request is no longer available for assignment\. Refresh it to see its current state\.$/, key: 'errors.assignmentUnavailable'},
  {test: /^Assign to team is not currently allowed by openMAINT\.$/, key: 'errors.assignNotAllowed'},
  {test: /^This request changed\. Refresh it before assigning\.$/, key: 'errors.assignmentChanged'},
  {test: /^(.+) is no longer an available choice\. Refresh and select again\.$/, key: 'errors.choiceUnavailable', group: 'field'},
  {test: /^Enter a valid expected execution date\.$/, key: 'errors.invalidExpectedDate'},
  {test: /^openMAINT did not confirm that the request left Assignment\. Refresh before taking any further action\.$/, key: 'errors.assignmentUnconfirmed'},
  {test: /^openMAINT validation for (.+) changed\. This activity needs integration review before editing\.$/, key: 'errors.validationChanged', group: 'field'},
  {test: /^This activity requires a widget submission that this PWA has not verified\.$/, key: 'errors.widgetUnverified'},
  {test: /^This activity is not available for technician execution\.$/, key: 'errors.activityNotAvailable'},
  {test: /^(.+) is not writable in this activity\.$/, key: 'errors.fieldNotWritable', group: 'field'},
  {test: /^Enter valid execution dates\.$/, key: 'errors.invalidExecutionDates'},
  {test: /^End time must be after start time\.$/, key: 'errors.endBeforeStart'},
  {test: /^Outcome is required to conclude activity\.$/, key: 'errors.outcomeRequired'},
  {test: /^Assignee is required to change assignee\.$/, key: 'errors.assigneeRequired'},
  {test: /^(.+) is required\.$/, key: 'errors.fieldRequired', group: 'field'},
  {test: /^Select an action currently allowed by openMAINT\.$/, key: 'errors.selectAllowedAction'},
  {test: /^This job changed\. Refresh it before saving\.$/, key: 'errors.jobChanged'},
  {test: /^Linking knowledge is available during writable Execution\.$/, key: 'errors.linkingUnavailable'},
  {test: /^Describe the labour performed\.$/, key: 'errors.describeLabour'},
  {test: /^Enter a valid work date\.$/, key: 'errors.invalidWorkDate'},
  {test: /^Hours must be greater than zero and no more than 24\.$/, key: 'errors.hoursRange'},
  {test: /^Enter a valid hourly rate\.$/, key: 'errors.invalidRate'},
  {test: /^openMAINT does not enable labour entry for this job\.$/, key: 'errors.labourNotEnabled'},
  {test: /^Accounting configuration is unavailable\.$/, key: 'errors.accountingConfigUnavailable'},
  {test: /^Accounting lookups are unavailable\.$/, key: 'errors.accountingLookupsUnavailable'},
  {test: /^Choose a JPEG, PNG, or WebP photo\.$/, key: 'errors.invalidPhotoType'},
  {test: /^Choose a photo smaller than 10 MB\.$/, key: 'errors.photoTooLarge'},
  {test: /^Photo upload is not permitted for this activity\.$/, key: 'errors.photoUploadNotPermitted'},
  {test: /^This category does not accept that file extension\.$/, key: 'errors.extensionNotAccepted'},
  {test: /^Choose an attachment smaller than 10 MB\.$/, key: 'errors.attachmentTooLarge'},
  {test: /^Attachments can only be added during writable Opening\.$/, key: 'errors.openingAttachmentOnly'},
  {test: /^openMAINT did not resolve exactly one requester for this account\.$/, key: 'errors.requesterNotResolved'},
];
export function translateError(message: string): string {
  for (const {test, key, group} of matchers) {
    const match = message.match(test);
    if (match) return i18n.global.t(key, group ? {[group]: match[1]} : {});
  }
  return message;
}
