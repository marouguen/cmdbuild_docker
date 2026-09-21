<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { downloadAttachment } from '../../api/attachments';
import { getOriginalRequestNotes, getRequest, getRequestActivities, getRequestActivity, getRequestAttachments, getRequestHistory, isRequesterDetailReadOnly } from '../../api/requester';
import { translateError } from '../../i18n/errors';
import type { Activity, Attachment, Card, Lookup } from '../../types/api';
import { formatDateTime } from '../../i18n/date';
import { approvalActions, approvalActivity, approvalAttribute, findVisibleRequest, isWritableApproval, issueSolved, resolveIssueSolved } from '../../api/requesterApproval';
import SafeHtml from '../SafeHtml.vue';

const props = defineProps<{source: Card}>();
const emit = defineEmits<{back: []}>();
const request = ref<Card | null>(null), activity = ref<Activity | null>(null), history = ref<Card[]>([]), attachments = ref<Attachment[]>([]);
const originalNotes = ref<string | null>(null);
const loading = ref(true), busy = ref(false), error = ref('');
const action = ref<Lookup|null>(null), closingNote = ref(''), attempted = ref(false), confirmed = ref(false);
const canApprove = computed(() => !loading.value && !busy.value && !attempted.value && isWritableApproval(activity.value) && Boolean(action.value));
const notesAttribute = computed(() => activity.value ? approvalAttribute(activity.value,'ProcessNotes') : undefined);
const readOnly = computed(() => isRequesterDetailReadOnly(activity.value));
const label = (card: Card, key: string) => String(card[`_${key}_description_translation`] ?? card[`_${key}_description`] ?? card[`_${key}_code`] ?? '');
const location = computed(() => request.value ? [label(request.value,'Site'),label(request.value,'Floor'),label(request.value,'Room')].filter(Boolean).join(' · ') : '');

async function load() {
  if(busy.value)return;
  loading.value=true;error.value='';action.value=null;activity.value=null;request.value=null;confirmed.value=false;
  try {
    if(!await findVisibleRequest(props.source._id))throw new Error('This request is no longer available in My Requests.');
    const [card, activities, rows, files] = await Promise.all([getRequest(props.source._id),getRequestActivities(props.source._id),getRequestHistory(props.source._id),getRequestAttachments(props.source._id)]);
    request.value=card;history.value=rows;attachments.value=files;
    originalNotes.value=await getOriginalRequestNotes(props.source._id,rows);
    activity.value=activities.length===1?await getRequestActivity(props.source._id,activities[0]._id):null;
    const eligible=approvalActivity(activities);
    if(eligible&&activity.value?._id===eligible._id&&isWritableApproval(activity.value))action.value=resolveIssueSolved(activity.value,await approvalActions(activity.value,card));
    closingNote.value='';attempted.value=false;
  } catch(reason){action.value=null;error.value=translateError((reason as Error).message);}
  finally{loading.value=false;}
}
async function submitApproval(){
  if(!canApprove.value||!request.value||!activity.value||!action.value)return;
  busy.value=true;attempted.value=true;error.value='';
  try{
    request.value=await issueSolved(request.value,activity.value,action.value,closingNote.value);
    activity.value=null;action.value=null;confirmed.value=true;
    history.value=await getRequestHistory(request.value._id);
  }catch(reason){error.value=translateError((reason as Error).message);}
  finally{busy.value=false;}
}
async function download(item: Attachment) {
  busy.value=true;error.value='';
  try { const blob=await downloadAttachment(props.source._id,item);const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=item.name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
  catch(reason){error.value=translateError((reason as Error).message);}
  finally{busy.value=false;}
}
onMounted(load);
</script>

<template>
  <div class="section-heading"><button type="button" class="text-button" :disabled="busy" @click="emit('back')">← {{ $t('requester.backToRequests') }}</button><button type="button" class="icon-button" :aria-label="$t('requester.refreshDetail')" :disabled="loading||busy" @click="load">↻</button></div>
  <p v-if="loading" class="skeleton" role="status">{{ $t('requester.loadingDetail') }}</p>
  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <template v-if="request && !loading">
    <header class="job-header"><p class="eyebrow">{{ request.Number }}</p><h1>{{ request.ShortDescr }}</h1><span class="badge">{{ label(request,'ProcessStatus') }}</span></header>
    <p v-if="confirmed" class="success" role="status">{{ $t('requester.approval.completed') }}</p>
    <p v-if="isWritableApproval(activity)&&!action" class="hint">{{ $t('requester.approval.unavailable') }}</p>
    <section class="panel"><div class="section-heading"><h2>{{ $t('requester.currentStatus') }}</h2><span class="badge">{{ activity?.description || label(request,'ProcessStatus') }}</span></div><p v-if="activity?._performer_description" class="muted">{{ $t('requester.responsible') }}: {{ activity._performer_description }}</p><p v-if="readOnly" class="hint">{{ $t('requester.readOnly') }}</p></section>
    <section class="panel"><h2>{{ $t('requester.requestDetails') }}</h2><dl class="facts request-facts"><div><dt>{{ $t('requester.priority') }}</dt><dd>{{ label(request,'Priority') || '—' }}</dd></div><div><dt>{{ $t('requester.type') }}</dt><dd>{{ label(request,'Type') || '—' }}</dd></div><div><dt>{{ $t('requester.requester') }}</dt><dd>{{ label(request,'Requester') || '—' }}</dd></div><div><dt>{{ $t('requester.openingDate') }}</dt><dd>{{ formatDateTime(request.OpeningDate) || '—' }}</dd></div><div><dt>{{ $t('requester.siteLocation') }}</dt><dd>{{ location || '—' }}</dd></div><div><dt>{{ $t('requester.equipment') }}</dt><dd>{{ label(request,'CI') || '—' }}</dd></div><div><dt>{{ $t('requester.category') }}</dt><dd>{{ label(request,'Category') || '—' }}</dd></div><div><dt>{{ $t('requester.subcategory') }}</dt><dd>{{ label(request,'Subcategory') || '—' }}</dd></div></dl><h3>{{ $t('requester.originalNotes') }}</h3><p class="hint">{{ $t('requester.originalNotesHint') }}</p><p class="prose">{{ originalNotes || $t('requester.noNotes') }}</p></section>
    <section v-if="request.ExecStartDate||request.ExecEndDate||request.Register" class="panel"><h2>{{ $t('requester.approval.execution') }}</h2><dl class="facts request-facts"><div><dt>{{ $t('requester.approval.team') }}</dt><dd>{{ label(request,'Team') || '\u2014' }}</dd></div><div><dt>{{ $t('requester.approval.outcome') }}</dt><dd>{{ label(request,'Outcome') || '\u2014' }}</dd></div><div><dt>{{ $t('requester.approval.start') }}</dt><dd>{{ formatDateTime(request.ExecStartDate) || '\u2014' }}</dd></div><div><dt>{{ $t('requester.approval.end') }}</dt><dd>{{ formatDateTime(request.ExecEndDate) || '\u2014' }}</dd></div></dl><h3 v-if="request.Register">{{ $t('requester.approval.register') }}</h3><SafeHtml v-if="request.Register" :content="request.Register" /></section>
    <form v-if="action&&!confirmed" class="panel request-form" @submit.stop.prevent="submitApproval"><h2>{{ action.description }}</h2><p>{{ $t('requester.approval.hint') }}</p><fieldset :disabled="!canApprove"><label v-if="notesAttribute?.writable">{{ $t('requester.approval.note') }}<textarea v-model="closingNote" :required="notesAttribute.mandatory" rows="4"></textarea></label><button type="submit" class="primary wide">{{ busy?$t('requester.approval.submitting'):action.description }}</button></fieldset></form>
    <p v-if="attempted&&!confirmed&&!busy" class="hint">{{ $t('requester.approval.checkBeforeRetry') }}</p>
    <section class="panel"><h2>{{ $t('requester.history') }}</h2><p v-if="!history.length" class="empty">{{ $t('requester.noHistory') }}</p><article v-for="row in history" :key="String(row._id)+row._beginDate" class="resource-card"><strong>{{ row._activity_description || row._historyType }}</strong><p>{{ formatDateTime(row._beginDate) }}<template v-if="row._endDate"> → {{ formatDateTime(row._endDate) }}</template> · {{ row.__user_description || row._user }}</p></article></section>
    <section class="panel"><h2>{{ $t('requester.attachments') }}</h2><p v-if="!attachments.length" class="empty">{{ $t('requester.noAttachments') }}</p><button type="button" v-for="item in attachments" :key="item._id" class="topic-card" :disabled="busy" @click="download(item)"><span><strong>{{ item.name }}</strong><small>{{ item._category_description }}</small></span><span aria-hidden="true">↓</span></button></section>
  </template>
</template>
