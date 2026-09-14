<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { getActivities,getActivity,getJob,mapJob } from '../api/processes';
import { api } from '../api/client';
import { translateError } from '../i18n/errors';
import type { Activity,Card } from '../types/api';
import SafeHtml from '../components/SafeHtml.vue';
import ExecutionPane from '../components/ExecutionPane.vue';
import KnowledgePane from '../components/KnowledgePane.vue';
import PhotosPane from '../components/PhotosPane.vue';
import ResourcesPane from '../components/ResourcesPane.vue';
const {t}=useI18n();
const props=defineProps<{id:number}>();const emit=defineEmits<{back:[]}>();
const job=ref<Card|null>(null),activity=ref<Activity|null>(null),busy=ref(false),error=ref(''),notice=ref(''),tab=ref('overview'),dirty=ref(false),copiedNotes=ref<string>(),history=ref<Card[]>([]),historyError=ref(''),historyBusy=ref(false),historyLoaded=ref(false);
const mapped=computed(()=>job.value?mapJob(job.value):null);
const canEdit=computed(()=>activity.value?.writable===true&&activity.value?._definition==='CM-Execution');
const tabs=computed(()=>[{id:'overview',label:t('job.tabOverview')},{id:'knowledge',label:t('job.tabKnowledge')},{id:'work',label:t('job.tabWork')},{id:'photos',label:t('job.tabPhotos')},{id:'resources',label:t('job.tabResources')}]);
async function load(){busy.value=true;error.value='';try{const result=await getJob(props.id);const activities=await getActivities(props.id);const candidates=activities.filter(a=>a.writable&&a._definition==='CM-Execution');const candidate=candidates.length===1?candidates[0]:activities.length===1?activities[0]:null;activity.value=candidate?await getActivity(props.id,candidate._id):null;job.value=result;dirty.value=false;historyLoaded.value=false;}catch(e){error.value=translateError((e as Error).message);}finally{busy.value=false;}}
function leave(){return !dirty.value||window.confirm(t('job.discardConfirm'));}
function select(value:string){if(value!==tab.value&&!leave())return;dirty.value=false;tab.value=value;}
function back(){if(leave())emit('back');}
async function saved(){notice.value=t('job.savedNotice');copiedNotes.value=undefined;await load();if(!canEdit.value)tab.value='overview';}
function useNotes(content:string){if(!leave())return;copiedNotes.value=content;tab.value='work';dirty.value=true;}
async function loadHistory(event:Event){if(!(event.target as HTMLDetailsElement).open||historyLoaded.value)return;historyBusy.value=true;historyError.value='';try{history.value=await api.data<Card[]>(`processes/CorrectiveMaint/instances/${props.id}/history?limit=20`);historyLoaded.value=true;}catch(e){historyError.value=translateError((e as Error).message);}finally{historyBusy.value=false;}}
function beforeUnload(event:BeforeUnloadEvent){if(dirty.value){event.preventDefault();event.returnValue='';}}
onMounted(()=>{load();window.addEventListener('beforeunload',beforeUnload);});onBeforeUnmount(()=>window.removeEventListener('beforeunload',beforeUnload));
</script>
<template><div class="section-heading"><button class="text-button" @click="back">← {{ $t('job.back') }}</button><button class="icon-button" :aria-label="$t('job.refresh')" :disabled="busy" @click="leave()&&load()">↻</button></div><p v-if="busy" class="skeleton" role="status">{{ $t('job.loading') }}</p><p v-if="error" class="error" role="alert">{{ error }}</p><template v-if="job&&mapped&&!busy"><header class="job-header"><div class="section-heading"><p class="eyebrow">{{ mapped.number }}</p><span class="priority">{{ mapped.priority }}</span></div><h1>{{ mapped.subject }}</h1><span class="badge">{{ mapped.status }}</span></header><p v-if="notice" class="success" role="status">{{ notice }}</p><nav class="tabs" aria-label="Job sections"><button v-for="item in tabs" :key="item.id" :aria-current="tab===item.id?'page':undefined" :class="{selected:tab===item.id}" @click="select(item.id)">{{ item.label }}</button></nav>
<template v-if="tab==='overview'"><section class="panel"><p class="eyebrow">{{ $t('job.equipmentLocationEyebrow') }}</p><h2>{{ mapped.equipment || $t('job.equipmentUnknown') }}</h2><p class="location">{{ mapped.location || $t('job.locationUnknown') }}</p><dl class="facts"><div><dt>{{ $t('job.category') }}</dt><dd>{{ mapped.category||$t('job.dash') }}</dd></div><div><dt>{{ $t('job.problem') }}</dt><dd>{{ mapped.subcategory||$t('job.dash') }}</dd></div><div><dt>{{ $t('job.team') }}</dt><dd>{{ mapped.team||$t('job.dash') }}</dd></div><div><dt>{{ $t('job.assignee') }}</dt><dd>{{ mapped.assignee||$t('job.unassigned') }}</dd></div></dl><button class="primary wide" @click="select('knowledge')">{{ $t('job.findTroubleshooting') }}</button></section><section class="panel"><h2>{{ $t('job.currentActivity') }}</h2><p>{{ activity?.description || mapped.status }} <span v-if="activity?._performer_description">· {{ activity._performer_description }}</span></p><button v-if="canEdit" class="primary wide" @click="select('work')">{{ $t('job.recordWork') }}</button><p v-else class="hint">{{ $t('job.noExecutionAction') }}</p></section><details class="panel"><summary>{{ $t('job.processRegister') }}</summary><SafeHtml :content="job.Register || t('job.noRegisterEntries')"/></details><details class="panel" @toggle="loadHistory"><summary>{{ $t('job.activityHistory') }}</summary><p v-if="historyBusy" role="status">{{ $t('job.loadingHistory') }}</p><p v-if="historyError" class="error">{{ historyError }}</p><article v-for="row in history" :key="String(row._id)+row._beginDate" class="resource-card"><strong>{{ row._activity_description || row._historyType }}</strong><p>{{ row._beginDate }} · {{ row.__user_description || row._user }}</p></article><small v-if="history.length===20">{{ $t('job.historyShowing') }}</small></details></template>
<KnowledgePane v-if="tab==='knowledge'" :job="job" :can-edit="canEdit" @use="useNotes"/>
<template v-if="tab==='work'"><ExecutionPane v-if="canEdit&&activity" :key="job._beginDate" :job="job" :activity="activity" :copied-notes="copiedNotes" @dirty="dirty=$event" @saved="saved"/><section v-else class="panel"><h2>{{ mapped.status }}</h2><p>{{ $t('job.noWritableActivity') }}</p></section></template>
<PhotosPane v-if="tab==='photos'" :id="id" :can-edit="canEdit"/>
<ResourcesPane v-if="tab==='resources'" :id="id" :can-edit="canEdit"/>
</template></template>
