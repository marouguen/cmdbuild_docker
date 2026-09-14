<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { getActivities,getActivity,getJob,mapJob } from '../api/processes';
import { api } from '../api/client';
import type { Activity,Card } from '../types/api';
import SafeHtml from '../components/SafeHtml.vue';
import ExecutionPane from '../components/ExecutionPane.vue';
import KnowledgePane from '../components/KnowledgePane.vue';
import PhotosPane from '../components/PhotosPane.vue';
import ResourcesPane from '../components/ResourcesPane.vue';
const props=defineProps<{id:number}>();const emit=defineEmits<{back:[]}>();
const job=ref<Card|null>(null),activity=ref<Activity|null>(null),busy=ref(false),error=ref(''),notice=ref(''),tab=ref('overview'),dirty=ref(false),copiedNotes=ref<string>(),history=ref<Card[]>([]),historyError=ref(''),historyBusy=ref(false),historyLoaded=ref(false);
const mapped=computed(()=>job.value?mapJob(job.value):null);
const canEdit=computed(()=>activity.value?.writable===true&&activity.value?._definition==='CM-Execution');
async function load(){busy.value=true;error.value='';try{const result=await getJob(props.id);const activities=await getActivities(props.id);const candidates=activities.filter(a=>a.writable&&a._definition==='CM-Execution');const candidate=candidates.length===1?candidates[0]:activities.length===1?activities[0]:null;activity.value=candidate?await getActivity(props.id,candidate._id):null;job.value=result;dirty.value=false;historyLoaded.value=false;}catch(e){error.value=(e as Error).message;}finally{busy.value=false;}}
function leave(){return !dirty.value||window.confirm('Discard unsaved execution notes?');}
function select(value:string){if(value!==tab.value&&!leave())return;dirty.value=false;tab.value=value;}
function back(){if(leave())emit('back');}
async function saved(){notice.value='Saved to openMAINT.';copiedNotes.value=undefined;await load();if(!canEdit.value)tab.value='overview';}
function useNotes(content:string){if(!leave())return;copiedNotes.value=content;tab.value='work';dirty.value=true;}
async function loadHistory(event:Event){if(!(event.target as HTMLDetailsElement).open||historyLoaded.value)return;historyBusy.value=true;historyError.value='';try{history.value=await api.data<Card[]>(`processes/CorrectiveMaint/instances/${props.id}/history?limit=20`);historyLoaded.value=true;}catch(e){historyError.value=(e as Error).message;}finally{historyBusy.value=false;}}
function beforeUnload(event:BeforeUnloadEvent){if(dirty.value){event.preventDefault();event.returnValue='';}}
onMounted(()=>{load();window.addEventListener('beforeunload',beforeUnload);});onBeforeUnmount(()=>window.removeEventListener('beforeunload',beforeUnload));
</script>
<template><div class="section-heading"><button class="text-button" @click="back">← My jobs</button><button class="icon-button" aria-label="Refresh job" :disabled="busy" @click="leave()&&load()">↻</button></div><p v-if="busy" class="skeleton" role="status">Loading job…</p><p v-if="error" class="error" role="alert">{{ error }}</p><template v-if="job&&mapped&&!busy"><header class="job-header"><div class="section-heading"><p class="eyebrow">{{ mapped.number }}</p><span class="priority">{{ mapped.priority }}</span></div><h1>{{ mapped.subject }}</h1><span class="badge">{{ mapped.status }}</span></header><p v-if="notice" class="success" role="status">{{ notice }}</p><nav class="tabs" aria-label="Job sections"><button v-for="item in [{id:'overview',label:'Details'},{id:'knowledge',label:'Knowledge'},{id:'work',label:'Work'},{id:'photos',label:'Photos'},{id:'resources',label:'Resources'}]" :key="item.id" :aria-current="tab===item.id?'page':undefined" :class="{selected:tab===item.id}" @click="select(item.id)">{{ item.label }}</button></nav>
<template v-if="tab==='overview'"><section class="panel"><p class="eyebrow">Equipment & location</p><h2>{{ mapped.equipment || 'Equipment not specified' }}</h2><p class="location">{{ mapped.location || 'Location not specified' }}</p><dl class="facts"><div><dt>Category</dt><dd>{{ mapped.category||'—' }}</dd></div><div><dt>Problem</dt><dd>{{ mapped.subcategory||'—' }}</dd></div><div><dt>Team</dt><dd>{{ mapped.team||'—' }}</dd></div><div><dt>Assignee</dt><dd>{{ mapped.assignee||'Unassigned' }}</dd></div></dl><button class="primary wide" @click="select('knowledge')">Find troubleshooting</button></section><section class="panel"><h2>Current activity</h2><p>{{ activity?.description || mapped.status }} <span v-if="activity?._performer_description">· {{ activity._performer_description }}</span></p><button v-if="canEdit" class="primary wide" @click="select('work')">Record work</button><p v-else class="hint">No technician Execution action is currently available to your account.</p></section><details class="panel"><summary>Process register</summary><SafeHtml :content="job.Register || 'No register entries yet.'"/></details><details class="panel" @toggle="loadHistory"><summary>Activity history</summary><p v-if="historyBusy" role="status">Loading history…</p><p v-if="historyError" class="error">{{ historyError }}</p><article v-for="row in history" :key="String(row._id)+row._beginDate" class="resource-card"><strong>{{ row._activity_description || row._historyType }}</strong><p>{{ row._beginDate }} · {{ row.__user_description || row._user }}</p></article><small v-if="history.length===20">Showing the latest returned 20 entries.</small></details></template>
<KnowledgePane v-if="tab==='knowledge'" :job="job" :can-edit="canEdit" @use="useNotes"/>
<template v-if="tab==='work'"><ExecutionPane v-if="canEdit&&activity" :key="job._beginDate" :job="job" :activity="activity" :copied-notes="copiedNotes" @dirty="dirty=$event" @saved="saved"/><section v-else class="panel"><h2>{{ mapped.status }}</h2><p>This job has no writable technician Execution activity for your account.</p></section></template>
<PhotosPane v-if="tab==='photos'" :id="id" :can-edit="canEdit"/>
<ResourcesPane v-if="tab==='resources'" :id="id" :can-edit="canEdit"/>
</template></template>
