<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { searchTopics, getTopic, relations, linkTopic, copyTopic } from '../api/knowledge';
import type { Card } from '../types/api';
import SafeHtml from './SafeHtml.vue';
import DOMPurify from 'dompurify';
const props=defineProps<{job:Card;canEdit:boolean}>();
const emit=defineEmits<{use:[content:string]}>();
const topics=ref<Card[]>([]), topic=ref<Card|null>(null), linked=ref<number[]>([]), query=ref(''), relevant=ref(true), loading=ref(false), busy=ref(false),error=ref(''),notice=ref(''),total=ref(0);
async function search(more=false){loading.value=true;error.value='';try{const result=await searchTopics(props.job,query.value,relevant.value,more?topics.value.length:0);topics.value=more?[...topics.value,...result.data]:result.data;total.value=result.meta?.total??topics.value.length;}catch(e){error.value=(e as Error).message;}finally{loading.value=false;}}
async function open(id:number){busy.value=true;error.value='';try{topic.value=await getTopic(id);}catch(e){error.value=(e as Error).message;}finally{busy.value=false;}}
async function link(){if(!topic.value||busy.value)return;busy.value=true;try{await linkTopic(props.job._id,topic.value._id);linked.value.push(topic.value._id);notice.value='Topic linked to this job.';}catch(e){error.value=(e as Error).message;}finally{busy.value=false;}}
function use(){if(!topic.value)return;const html=copyTopic(topic.value,String(props.job.ProcessNotes??''));const doc=new DOMParser().parseFromString(DOMPurify.sanitize(html).replace(/<\/(p|li|div|h[1-6])>/gi,'</$1>\n'),'text/html');emit('use',doc.body.textContent??'');}
onMounted(async()=>{await search();try{linked.value=(await relations(props.job._id)).filter(r=>r._type==='MaintProcessTopic').map(r=>Number(r._destinationId));}catch(e){error.value=(e as Error).message;}});
</script>
<template><section class="panel"><p class="eyebrow">Knowledge</p><h2>What should I check?</h2><p class="muted">Troubleshooting from openMAINT.</p>
  <form class="search-row" @submit.prevent="search()"><label class="grow"><span class="sr-only">Search knowledge</span><input v-model="query" type="search" placeholder="Search troubleshooting…"></label><button class="secondary" :disabled="loading">Search</button></form>
  <label class="check"><input v-model="relevant" type="checkbox" @change="search()">Match this job’s category and subcategory</label>
  <p v-if="loading" role="status">Finding topics…</p><p v-else-if="!topics.length" class="empty">No matching topics. Try a broader search.</p>
  <button v-for="t in topics" :key="t._id" class="topic-card" :disabled="busy" @click="open(t._id)"><span><strong>{{ t.Title || t.Description }}</strong><small>{{ t._Type_description }} · {{ t._State_description }}<span v-if="linked.includes(t._id)"> · Linked</span></small></span><span aria-hidden="true">↗</span></button>
  <button v-if="topics.length<total" class="secondary wide" :disabled="loading" @click="search(true)">More topics</button>
  <article v-if="topic" class="topic-content"><div class="section-heading"><h3>{{ topic.Title }}</h3><button class="text-button" @click="topic=null">Close</button></div><p class="badge">{{ topic._State_description }}</p><SafeHtml :content="topic.Content"/><div v-if="canEdit" class="button-row"><button class="secondary" :disabled="busy || linked.includes(topic._id)" @click="link">{{ linked.includes(topic._id)?'Linked':'Link to job' }}</button><button class="primary" @click="use">Add as reference to notes</button></div></article>
  <p v-if="notice" class="success" role="status">{{ notice }}</p><p v-if="error" class="error" role="alert">{{ error }}</p>
</section></template>
