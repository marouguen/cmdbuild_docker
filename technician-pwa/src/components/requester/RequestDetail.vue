<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { downloadAttachment } from '../../api/attachments';
import { getOriginalRequestNotes, getRequest, getRequestActivities, getRequestActivity, getRequestAttachments, getRequestHistory, isRequesterDetailReadOnly } from '../../api/requester';
import { translateError } from '../../i18n/errors';
import type { Activity, Attachment, Card } from '../../types/api';
import { formatDateTime } from '../../i18n/date';

const props = defineProps<{source: Card}>();
const emit = defineEmits<{back: []}>();
const request = ref<Card | null>(null), activity = ref<Activity | null>(null), history = ref<Card[]>([]), attachments = ref<Attachment[]>([]);
const originalNotes = ref<string | null>(null);
const loading = ref(true), busy = ref(false), error = ref('');
const readOnly = computed(() => isRequesterDetailReadOnly(activity.value));
const label = (card: Card, key: string) => String(card[`_${key}_description_translation`] ?? card[`_${key}_description`] ?? card[`_${key}_code`] ?? '');
const location = computed(() => request.value ? [label(request.value,'Site'),label(request.value,'Floor'),label(request.value,'Room')].filter(Boolean).join(' · ') : '');

async function load() {
  loading.value=true;error.value='';
  try {
    const [card, activities, rows, files] = await Promise.all([getRequest(props.source._id),getRequestActivities(props.source._id),getRequestHistory(props.source._id),getRequestAttachments(props.source._id)]);
    request.value=card;history.value=rows;attachments.value=files;
    originalNotes.value=await getOriginalRequestNotes(props.source._id,rows);
    activity.value=activities.length===1?await getRequestActivity(props.source._id,activities[0]._id):null;
  } catch(reason){error.value=translateError((reason as Error).message);}
  finally{loading.value=false;}
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
  <div class="section-heading"><button class="text-button" @click="emit('back')">← {{ $t('requester.backToRequests') }}</button><button class="icon-button" :aria-label="$t('requester.refreshDetail')" :disabled="loading" @click="load">↻</button></div>
  <p v-if="loading" class="skeleton" role="status">{{ $t('requester.loadingDetail') }}</p>
  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <template v-if="request && !loading">
    <header class="job-header"><p class="eyebrow">{{ request.Number }}</p><h1>{{ request.ShortDescr }}</h1><span class="badge">{{ label(request,'ProcessStatus') }}</span></header>
    <section class="panel"><div class="section-heading"><h2>{{ $t('requester.currentStatus') }}</h2><span class="badge">{{ activity?.description || label(request,'ProcessStatus') }}</span></div><p v-if="activity?._performer_description" class="muted">{{ $t('requester.responsible') }}: {{ activity._performer_description }}</p><p v-if="readOnly" class="hint">{{ $t('requester.readOnly') }}</p></section>
    <section class="panel"><h2>{{ $t('requester.requestDetails') }}</h2><dl class="facts request-facts"><div><dt>{{ $t('requester.priority') }}</dt><dd>{{ label(request,'Priority') || '—' }}</dd></div><div><dt>{{ $t('requester.type') }}</dt><dd>{{ label(request,'Type') || '—' }}</dd></div><div><dt>{{ $t('requester.requester') }}</dt><dd>{{ label(request,'Requester') || '—' }}</dd></div><div><dt>{{ $t('requester.openingDate') }}</dt><dd>{{ formatDateTime(request.OpeningDate) || '—' }}</dd></div><div><dt>{{ $t('requester.siteLocation') }}</dt><dd>{{ location || '—' }}</dd></div><div><dt>{{ $t('requester.equipment') }}</dt><dd>{{ label(request,'CI') || '—' }}</dd></div><div><dt>{{ $t('requester.category') }}</dt><dd>{{ label(request,'Category') || '—' }}</dd></div><div><dt>{{ $t('requester.subcategory') }}</dt><dd>{{ label(request,'Subcategory') || '—' }}</dd></div></dl><h3>{{ $t('requester.originalNotes') }}</h3><p class="hint">{{ $t('requester.originalNotesHint') }}</p><p class="prose">{{ originalNotes || $t('requester.noNotes') }}</p></section>
    <section class="panel"><h2>{{ $t('requester.history') }}</h2><p v-if="!history.length" class="empty">{{ $t('requester.noHistory') }}</p><article v-for="row in history" :key="String(row._id)+row._beginDate" class="resource-card"><strong>{{ row._activity_description || row._historyType }}</strong><p>{{ formatDateTime(row._beginDate) }}<template v-if="row._endDate"> → {{ formatDateTime(row._endDate) }}</template> · {{ row.__user_description || row._user }}</p></article></section>
    <section class="panel"><h2>{{ $t('requester.attachments') }}</h2><p v-if="!attachments.length" class="empty">{{ $t('requester.noAttachments') }}</p><button v-for="item in attachments" :key="item._id" class="topic-card" :disabled="busy" @click="download(item)"><span><strong>{{ item.name }}</strong><small>{{ item._category_description }}</small></span><span aria-hidden="true">↓</span></button></section>
  </template>
</template>
