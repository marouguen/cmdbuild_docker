<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { downloadAttachment } from '../../api/attachments';
import { assignmentAttribute, assignmentChoices, assignToTeam, isAssignmentReadOnly, resolveAssignAction, type AssignmentDraft, type AssignmentQueueItem } from '../../api/manager';
import { getOriginalRequestNotes, getRequest, getRequestActivities, getRequestActivity, getRequestAttachments, getRequestHistory } from '../../api/requester';
import { translateError } from '../../i18n/errors';
import { formatDateTime } from '../../i18n/date';
import type { Activity, Attachment, Card, Lookup } from '../../types/api';

const props=defineProps<{source:AssignmentQueueItem}>();
const emit=defineEmits<{back:[refresh?:boolean]}>();
const request=ref<Card|null>(null),activity=ref<Activity|null>(null),action=ref<Lookup|null>(null),history=ref<Card[]>([]),attachments=ref<Attachment[]>([]),originalNotes=ref<string|null>(null);
const categories=ref<(Lookup|Card)[]>([]),subcategories=ref<(Lookup|Card)[]>([]),sites=ref<(Lookup|Card)[]>([]),teams=ref<(Lookup|Card)[]>([]),assignees=ref<(Lookup|Card)[]>([]);
const draft=reactive<AssignmentDraft>({});
const loading=ref(true),busy=ref(false),error=ref(''),success=ref(''),resultActivity=ref<Activity|null>(null),initializing=ref(false);
const readOnly=computed(()=>isAssignmentReadOnly(activity.value,action.value)||Boolean(resultActivity.value));
const label=(card:Card,key:string)=>String(card[`_${key}_description_translation`]??card[`_${key}_description`]??card[`_${key}_code`]??'');
const optionLabel=(item:Lookup|Card)=>{const value=item as Record<string,unknown>;return String(value._description_translation??value.description??value.Description??value._description??value.Code??value.code??value._id);};
const attr=(id:string)=>activity.value?assignmentAttribute(activity.value,id):undefined;
const location=computed(()=>request.value?[label(request.value,'Site'),label(request.value,'Floor'),label(request.value,'Room')].filter(Boolean).join(' · '):'');
const localDate=(value:unknown)=>{if(!value)return '';const date=new Date(String(value));if(!Number.isFinite(date.getTime()))return '';const offset=date.getTimezoneOffset()*60000;return new Date(date.getTime()-offset).toISOString().slice(0,16);};

async function loadChoices(field:string){return activity.value&&request.value?assignmentChoices(activity.value,field,request.value,draft):[];}
async function load() {
  loading.value=true;error.value='';success.value='';resultActivity.value=null;
  try {
    const [card,activities,rows,files]=await Promise.all([getRequest(props.source.card._id),getRequestActivities(props.source.card._id),getRequestHistory(props.source.card._id),getRequestAttachments(props.source.card._id)]);
    request.value=card;history.value=rows;attachments.value=files;originalNotes.value=await getOriginalRequestNotes(card._id,rows);
    const assignment=activities.filter(item=>item._definition==='CM-Assignment');
    activity.value=assignment.length===1?await getRequestActivity(card._id,assignment[0]._id):null;
    action.value=null;
    if(activity.value?.writable){const actionChoices=await loadChoices('Action') as Lookup[];action.value=resolveAssignAction(activity.value,actionChoices);}
    initializing.value=true;
    draft.Site=Number(card.Site)||undefined;draft.Category=Number(card.Category)||undefined;draft.Subcategory=Number(card.Subcategory)||undefined;draft.Team=Number(card.Team)||undefined;draft.Assignee=Number(card.Assignee)||undefined;draft.ProcessNotes='';draft.ExpExecStartDate=localDate(card.ExpExecStartDate)||localDate(new Date());
    if(activity.value){[sites.value,categories.value]=await Promise.all([loadChoices('Site'),loadChoices('Category')]);subcategories.value=draft.Category?await loadChoices('Subcategory'):[];teams.value=draft.Site&&draft.Category&&draft.Subcategory?await loadChoices('Team'):[];assignees.value=draft.Team?await loadChoices('Assignee'):[];}
  }catch(reason){error.value=translateError((reason as Error).message);}
  finally{initializing.value=false;loading.value=false;}
}
watch(()=>draft.Category,async(value,old)=>{if(initializing.value||value===old)return;draft.Subcategory=undefined;draft.Team=undefined;draft.Assignee=undefined;subcategories.value=value?await loadChoices('Subcategory'):[];teams.value=[];assignees.value=[];});
watch(()=>draft.Subcategory,async(value,old)=>{if(initializing.value||value===old)return;draft.Team=undefined;draft.Assignee=undefined;teams.value=value&&draft.Site?await loadChoices('Team'):[];assignees.value=[];});
watch(()=>draft.Site,async(value,old)=>{if(initializing.value||value===old)return;draft.Team=undefined;draft.Assignee=undefined;teams.value=value&&draft.Category&&draft.Subcategory?await loadChoices('Team'):[];assignees.value=[];});
watch(()=>draft.Team,async(value,old)=>{if(initializing.value||value===old)return;draft.Assignee=undefined;assignees.value=value?await loadChoices('Assignee'):[];});
async function submit(){if(!request.value||!activity.value||busy.value||readOnly.value)return;busy.value=true;error.value='';try{const result=await assignToTeam(request.value,activity.value,draft);request.value=result.card;resultActivity.value=result.activity;success.value=String(result.activity?.description||label(result.card,'ProcessStatus'));}catch(reason){error.value=translateError((reason as Error).message);}finally{busy.value=false;}}
async function download(item:Attachment){busy.value=true;error.value='';try{const blob=await downloadAttachment(props.source.card._id,item);const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=item.name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(reason){error.value=translateError((reason as Error).message);}finally{busy.value=false;}}
onMounted(load);
</script>

<template>
  <div class="section-heading"><button type="button" class="text-button" :disabled="busy" @click="emit('back',Boolean(resultActivity))">← {{ $t('manager.backToQueue') }}</button><button type="button" class="icon-button" :aria-label="$t('manager.refreshDetail')" :disabled="loading||busy" @click="load">↻</button></div>
  <p v-if="loading" class="skeleton" role="status">{{ $t('manager.loadingDetail') }}</p><p v-if="error" class="error" role="alert">{{ error }}</p>
  <template v-if="request&&!loading">
    <header class="job-header"><p class="eyebrow">{{ request.Number }}</p><h1>{{ request.ShortDescr }}</h1><span class="badge">{{ resultActivity?.description||activity?.description||label(request,'ProcessStatus') }}</span></header>
    <p v-if="success" class="success" role="status">{{ $t('manager.assignmentConfirmed',{state:success,performer:resultActivity?._performer_description||resultActivity?.performer||'—'}) }}</p>
    <section class="panel"><div class="section-heading"><h2>{{ $t('manager.currentActivity') }}</h2><span class="badge">{{ resultActivity?.description||activity?.description||label(request,'ProcessStatus') }}</span></div><p class="muted">{{ $t('manager.responsible') }}: {{ resultActivity?._performer_description||resultActivity?.performer||activity?._performer_description||activity?.performer||'—' }}</p><p v-if="readOnly&&!resultActivity" class="hint">{{ $t('manager.readOnly') }}</p></section>
    <section class="panel"><h2>{{ $t('manager.requestDetails') }}</h2><dl class="facts request-facts"><div><dt>{{ $t('manager.priority') }}</dt><dd>{{ label(request,'Priority')||'—' }}</dd></div><div><dt>{{ $t('manager.type') }}</dt><dd>{{ label(request,'Type')||'—' }}</dd></div><div><dt>{{ $t('manager.requester') }}</dt><dd>{{ label(request,'Requester')||'—' }}</dd></div><div><dt>{{ $t('manager.openingDate') }}</dt><dd>{{ formatDateTime(request.OpeningDate)||'—' }}</dd></div><div><dt>{{ $t('manager.siteLocation') }}</dt><dd>{{ location||'—' }}</dd></div><div><dt>{{ $t('manager.equipment') }}</dt><dd>{{ label(request,'CI')||'—' }}</dd></div><div><dt>{{ $t('manager.category') }}</dt><dd>{{ label(request,'Category')||'—' }}</dd></div><div><dt>{{ $t('manager.subcategory') }}</dt><dd>{{ label(request,'Subcategory')||'—' }}</dd></div></dl><h3>{{ $t('manager.originalNotes') }}</h3><p class="prose">{{ originalNotes||$t('manager.noNotes') }}</p></section>
    <form v-if="!readOnly&&activity&&action" class="panel request-form" @submit.stop.prevent="submit"><h2>{{ action.description }}</h2><p class="hint">{{ $t('manager.liveMetadataHint') }}</p><fieldset :disabled="busy">
      <label v-if="attr('Site')?.writable">{{ $t('manager.site') }}<select v-model="draft.Site" required><option :value="undefined" disabled>{{ $t('manager.choose') }}</option><option v-for="item in sites" :key="item._id" :value="item._id">{{ optionLabel(item) }}</option></select></label>
      <div class="field-pair"><label v-if="attr('Category')?.writable">{{ $t('manager.category') }}<select v-model="draft.Category" required><option :value="undefined" disabled>{{ $t('manager.choose') }}</option><option v-for="item in categories" :key="item._id" :value="item._id">{{ optionLabel(item) }}</option></select></label><label v-if="attr('Subcategory')?.writable">{{ $t('manager.subcategory') }}<select v-model="draft.Subcategory" :disabled="!draft.Category" required><option :value="undefined" disabled>{{ $t('manager.choose') }}</option><option v-for="item in subcategories" :key="item._id" :value="item._id">{{ optionLabel(item) }}</option></select></label></div>
      <label v-if="attr('ExpExecStartDate')?.writable">{{ $t('manager.expectedDate') }}<input v-model="draft.ExpExecStartDate" type="datetime-local"></label>
      <label v-if="attr('Team')?.writable">{{ $t('manager.team') }}<select v-model="draft.Team" :disabled="!draft.Site||!draft.Category||!draft.Subcategory" required><option :value="undefined" disabled>{{ $t('manager.choose') }}</option><option v-for="item in teams" :key="item._id" :value="item._id">{{ optionLabel(item) }}</option></select></label>
      <label v-if="attr('Assignee')?.writable">{{ $t('manager.assignee') }}<select v-model="draft.Assignee" :disabled="!draft.Team"><option :value="undefined">{{ $t('manager.none') }}</option><option v-for="item in assignees" :key="item._id" :value="item._id">{{ optionLabel(item) }}</option></select></label>
      <label v-if="attr('ProcessNotes')?.writable">{{ $t('manager.notes') }}<textarea v-model="draft.ProcessNotes" rows="4"></textarea></label>
      <button type="submit" class="primary wide">{{ busy?$t('manager.assigning'):$t('manager.assign') }}</button>
    </fieldset></form>
    <section class="panel"><h2>{{ $t('manager.history') }}</h2><p v-if="!history.length" class="empty">{{ $t('manager.noHistory') }}</p><article v-for="row in history" :key="String(row._id)+row._beginDate" class="resource-card"><strong>{{ row._activity_description||row._historyType }}</strong><p>{{ formatDateTime(row._beginDate) }}<template v-if="row._endDate"> → {{ formatDateTime(row._endDate) }}</template> · {{ row.__user_description||row._user }}</p></article></section>
    <section class="panel"><h2>{{ $t('manager.attachments') }}</h2><p v-if="!attachments.length" class="empty">{{ $t('manager.noAttachments') }}</p><button v-for="item in attachments" :key="item._id" type="button" class="topic-card" :disabled="busy" @click="download(item)"><span><strong>{{ item.name }}</strong><small>{{ item._category_description }}</small></span><span aria-hidden="true">↓</span></button></section>
  </template>
</template>
