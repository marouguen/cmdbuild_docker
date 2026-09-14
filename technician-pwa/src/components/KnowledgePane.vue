<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { searchTopics, getTopic, relations, linkTopic, copyTopic } from '../api/knowledge';
import { translateError } from '../i18n/errors';
import type { Card } from '../types/api';
import SafeHtml from './SafeHtml.vue';
import DOMPurify from 'dompurify';
const {t}=useI18n();
const props=defineProps<{job:Card;canEdit:boolean}>();
const emit=defineEmits<{use:[content:string]}>();
const topics=ref<Card[]>([]), topic=ref<Card|null>(null), linked=ref<number[]>([]), query=ref(''), relevant=ref(true), loading=ref(false), busy=ref(false),error=ref(''),notice=ref(''),total=ref(0);
async function search(more=false){loading.value=true;error.value='';try{const result=await searchTopics(props.job,query.value,relevant.value,more?topics.value.length:0);topics.value=more?[...topics.value,...result.data]:result.data;total.value=result.meta?.total??topics.value.length;}catch(e){error.value=translateError((e as Error).message);}finally{loading.value=false;}}
async function open(id:number){busy.value=true;error.value='';try{topic.value=await getTopic(id);}catch(e){error.value=translateError((e as Error).message);}finally{busy.value=false;}}
async function link(){if(!topic.value||busy.value)return;busy.value=true;try{await linkTopic(props.job._id,topic.value._id);linked.value.push(topic.value._id);notice.value=t('knowledge.topicLinkedNotice');}catch(e){error.value=translateError((e as Error).message);}finally{busy.value=false;}}
function use(){if(!topic.value)return;const html=copyTopic(topic.value,String(props.job.ProcessNotes??''));const doc=new DOMParser().parseFromString(DOMPurify.sanitize(html).replace(/<\/(p|li|div|h[1-6])>/gi,'</$1>\n'),'text/html');emit('use',doc.body.textContent??'');}
onMounted(async()=>{await search();try{linked.value=(await relations(props.job._id)).filter(r=>r._type==='MaintProcessTopic').map(r=>Number(r._destinationId));}catch(e){error.value=translateError((e as Error).message);}});
</script>
<template><section class="panel"><p class="eyebrow">{{ $t('knowledge.eyebrow') }}</p><h2>{{ $t('knowledge.title') }}</h2><p class="muted">{{ $t('knowledge.subtitle') }}</p>
  <form class="search-row" @submit.prevent="search()"><label class="grow"><span class="sr-only">{{ $t('knowledge.search') }}</span><input v-model="query" type="search" :placeholder="$t('knowledge.searchPlaceholder')"></label><button class="secondary" :disabled="loading">{{ $t('knowledge.searchButton') }}</button></form>
  <label class="check"><input v-model="relevant" type="checkbox" @change="search()">{{ $t('knowledge.matchCategory') }}</label>
  <p v-if="loading" role="status">{{ $t('knowledge.finding') }}</p><p v-else-if="!topics.length" class="empty">{{ $t('knowledge.noMatches') }}</p>
  <button v-for="item in topics" :key="item._id" class="topic-card" :disabled="busy" @click="open(item._id)"><span><strong>{{ item.Title || item.Description }}</strong><small>{{ item._Type_description }} · {{ item._State_description }}<span v-if="linked.includes(item._id)"> · {{ $t('knowledge.linked') }}</span></small></span><span aria-hidden="true">↗</span></button>
  <button v-if="topics.length<total" class="secondary wide" :disabled="loading" @click="search(true)">{{ $t('knowledge.moreTopics') }}</button>
  <article v-if="topic" class="topic-content"><div class="section-heading"><h3>{{ topic.Title }}</h3><button class="text-button" @click="topic=null">{{ $t('knowledge.close') }}</button></div><p class="badge">{{ topic._State_description }}</p><SafeHtml :content="topic.Content"/><div v-if="canEdit" class="button-row"><button class="secondary" :disabled="busy || linked.includes(topic._id)" @click="link">{{ linked.includes(topic._id)?$t('knowledge.linked'):$t('knowledge.linkToJob') }}</button><button class="primary" @click="use">{{ $t('knowledge.addReference') }}</button></div></article>
  <p v-if="notice" class="success" role="status">{{ notice }}</p><p v-if="error" class="error" role="alert">{{ error }}</p>
</section></template>
