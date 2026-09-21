<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { accountingActions, approveAccounting, resolveApproveAction } from '../../api/managerAccounting';
import { assignmentAttribute, isWritableAccounting, type AssignmentQueueItem } from '../../api/manager';
import { getRequest, getRequestActivities, getRequestActivity, getRequestHistory, getRequestAttachments, getOriginalRequestNotes } from '../../api/requester';
import { downloadAttachment } from '../../api/attachments';
import { translateError } from '../../i18n/errors';
import type { Activity, Attachment, Card, Lookup } from '../../types/api';
import ManagerRequestContext from './ManagerRequestContext.vue';

const props=defineProps<{source:AssignmentQueueItem}>();
const emit=defineEmits<{back:[refresh?:boolean]}>();
const request=ref<Card|null>(null),activity=ref<Activity|null>(null),action=ref<Lookup|null>(null);
const history=ref<Card[]>([]),attachments=ref<Attachment[]>([]),originalNotes=ref<string|null>(null);
const loading=ref(true),busy=ref(false),attempted=ref(false),confirmed=ref(false),error=ref(''),notes=ref('');
const canApprove=computed(()=>!loading.value&&!busy.value&&!attempted.value&&isWritableAccounting(activity.value)&&Boolean(action.value));
const notesAttribute=computed(()=>activity.value?assignmentAttribute(activity.value,'ProcessNotes'):undefined);
const status=computed(()=>activity.value?.description||String(request.value?._ProcessStatus_description??''));
async function load(){
  if(busy.value)return;
  loading.value=true;error.value='';action.value=null;activity.value=null;request.value=null;confirmed.value=false;
  try{
    const id=props.source.card._id;
    const card=await getRequest(id),current=await getRequestActivities(id);
    request.value=card;
    if(current.length===1){
      const detail=await getRequestActivity(id,current[0]._id);
      activity.value=detail;
      if(detail._id===current[0]._id&&isWritableAccounting(current[0])&&isWritableAccounting(detail)) action.value=resolveApproveAction(detail,await accountingActions(detail,card));
    }
    [history.value,attachments.value]=await Promise.all([getRequestHistory(id),getRequestAttachments(id)]);
    originalNotes.value=await getOriginalRequestNotes(id,history.value);
    notes.value='';attempted.value=false;
  }catch(reason){action.value=null;error.value=translateError((reason as Error).message);}
  finally{loading.value=false;}
}
async function submit(){
  if(!canApprove.value||!request.value||!activity.value||!action.value)return;
  busy.value=true;attempted.value=true;error.value='';
  try{
    const result=await approveAccounting(request.value,activity.value,action.value,notes.value);
    request.value=result.card;activity.value=result.activity;action.value=null;confirmed.value=true;
    // Read-only context refresh. A failure here must never re-enable submission.
    history.value=await getRequestHistory(result.card._id);
  }catch(reason){error.value=translateError((reason as Error).message);}
  finally{busy.value=false;}
}
async function download(item:Attachment){
  busy.value=true;error.value='';
  try{const blob=await downloadAttachment(props.source.card._id,item);const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=item.name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  catch(reason){error.value=translateError((reason as Error).message);}
  finally{busy.value=false;}
}
onMounted(load);
</script>

<template>
  <div class="section-heading"><button type="button" class="text-button" :disabled="busy" @click="emit('back',true)">← {{ $t('manager.accounting.backToQueue') }}</button><button type="button" class="icon-button" :aria-label="$t('manager.accounting.refreshDetail')" :disabled="loading||busy" @click="load">↻</button></div>
  <p v-if="loading" class="skeleton" role="status">{{ $t('manager.accounting.loadingDetail') }}</p>
  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <template v-if="request&&!loading">
    <header class="job-header"><p class="eyebrow">{{ request.Number }}</p><h1>{{ request.ShortDescr }}</h1><span class="badge">{{ status }}</span></header>
    <p v-if="confirmed" class="success" role="status">{{ $t('manager.accounting.confirmed',{state:status,performer:activity?._performer_description||activity?.performer}) }}</p>
    <section class="panel"><h2>{{ $t('manager.currentActivity') }}</h2><p>{{ status }}</p><p>{{ $t('manager.responsible') }}: {{ activity?._performer_description||activity?.performer||'—' }}</p><p v-if="!action&&!confirmed" class="hint">{{ $t('manager.accounting.unavailable') }}</p></section>
    <form v-if="action&&!confirmed" class="panel request-form" @submit.stop.prevent="submit">
      <h2>{{ action.description }}</h2><p>{{ $t('manager.accounting.hint') }}</p>
      <fieldset :disabled="!canApprove"><label v-if="notesAttribute?.writable">{{ $t('manager.accounting.note') }}<textarea v-model="notes" :required="notesAttribute.mandatory" rows="4"></textarea></label><button type="submit" class="primary wide">{{ busy?$t('manager.accounting.approving'):action.description }}</button></fieldset>
    </form>
    <p v-if="attempted&&!confirmed&&!busy" class="hint">{{ $t('manager.accounting.checkBeforeRetry') }}</p>
    <ManagerRequestContext :request="request" :original-notes="originalNotes" :history="history" :attachments="attachments" :busy="busy" execution @download="download" />
  </template>
</template>
