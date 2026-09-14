<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { listJobs,mapJob,visibleJobs } from '../api/processes';
import { translateError } from '../i18n/errors';
import type { Card } from '../types/api';
const {t}=useI18n();
const emit=defineEmits<{open:[id:number]}>();
const cards=ref<Card[]>([]),query=ref(''),active=ref(true),busy=ref(false),error=ref(''),total=ref(0);
const jobs=computed(()=>visibleJobs(cards.value,query.value,active.value).map(mapJob));
async function load(more=false){if(busy.value)return;busy.value=true;error.value='';try{const result=await listJobs(more?cards.value.length:0);cards.value=more?[...cards.value,...result.data]:result.data;total.value=result.meta?.total??cards.value.length;}catch(e){error.value=translateError((e as Error).message);}finally{busy.value=false;}}
onMounted(()=>load());
</script>
<template><div class="page-title"><div><p class="eyebrow">{{ $t('jobs.eyebrow') }}</p><h1>{{ $t('jobs.title') }}<span class="count">{{ jobs.length }}</span></h1></div><button class="icon-button" :aria-label="$t('jobs.refresh')" :disabled="busy" @click="load()">↻</button></div><p class="muted">{{ $t('jobs.subtitle') }}</p><label><span class="sr-only">{{ $t('jobs.search') }}</span><input v-model="query" class="search" type="search" :placeholder="$t('jobs.searchPlaceholder')"></label><div class="filter-row"><button :class="['chip',{selected:active}]" @click="active=true">{{ $t('jobs.active') }}</button><button :class="['chip',{selected:!active}]" @click="active=false">{{ $t('jobs.allAuthorized') }}</button></div><p v-if="cards.length<total" class="hint">{{ t('jobs.loadedOfTotal',{loaded:cards.length,total}) }}</p>
<p v-if="error" class="error" role="alert">{{ error }} <button class="text-button" @click="load()">{{ $t('jobs.retry') }}</button></p><div v-if="busy&&!cards.length" class="skeleton" role="status">{{ $t('jobs.loading') }}</div><div v-else-if="!jobs.length" class="empty panel"><h2>{{ $t('jobs.empty') }}</h2><p>{{ query?$t('jobs.emptySearch'):$t('jobs.emptyDefault') }}</p></div>
<div class="jobs"><button v-for="job in jobs" :key="job.id" class="job-card" @click="emit('open',job.id)"><div class="section-heading"><span class="job-number">{{ job.number }}</span><span class="priority" :class="{high:job.priority==='High'}">{{ job.priority || $t('jobs.noPriority') }}</span></div><h2>{{ job.subject }}</h2><p class="equipment">{{ job.equipment || $t('jobs.equipmentUnknown') }}</p><p class="location">{{ job.location || $t('jobs.locationUnknown') }}</p><div class="card-footer"><span class="badge">{{ job.status }}</span><span class="muted">{{ job.team }}</span><span aria-hidden="true">→</span></div></button></div><button v-if="cards.length<total" class="secondary wide" :disabled="busy" @click="load(true)">{{ busy?$t('jobs.loadingMore'):$t('jobs.loadMore') }}</button></template>
