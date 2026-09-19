<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { listAssignmentQueue, type AssignmentQueueItem } from '../../api/manager';
import { translateError } from '../../i18n/errors';
import { formatDateTime } from '../../i18n/date';

const emit = defineEmits<{open: [item: AssignmentQueueItem]}>();
const items = ref<AssignmentQueueItem[]>([]), query = ref(''), busy = ref(false), error = ref('');
const label = (card: AssignmentQueueItem['card'], key: string) => String(card[`_${key}_description_translation`] ?? card[`_${key}_description`] ?? card[`_${key}_code`] ?? '');
const location = (item: AssignmentQueueItem) => [label(item.card,'Site'),label(item.card,'Floor'),label(item.card,'Room')].filter(Boolean).join(' · ');
const searchable = (item: AssignmentQueueItem) => [item.card.Number,item.card.ShortDescr,label(item.card,'Priority'),label(item.card,'Type'),label(item.card,'Requester'),label(item.card,'CI'),location(item),item.activity.description].join(' ').toLocaleLowerCase();
const shown = computed(() => { const term=query.value.trim().toLocaleLowerCase(); return items.value.filter(item=>!term||searchable(item).includes(term)); });

async function load() {
  if (busy.value) return;
  busy.value=true;error.value='';
  try { items.value=await listAssignmentQueue(); }
  catch(reason){error.value=translateError((reason as Error).message);}
  finally{busy.value=false;}
}
onMounted(load);
</script>

<template>
  <div class="page-title"><div><p class="eyebrow">{{ $t('manager.eyebrow') }}</p><h1>{{ $t('manager.queue') }} <span class="count">{{ shown.length }}</span></h1></div><button type="button" class="icon-button" :aria-label="$t('manager.refreshQueue')" :disabled="busy" @click="load">↻</button></div>
  <p class="muted">{{ $t('manager.queueSubtitle') }}</p>
  <label><span class="sr-only">{{ $t('manager.search') }}</span><input v-model="query" class="search" type="search" :placeholder="$t('manager.searchPlaceholder')"></label>
  <p v-if="error" class="error" role="alert">{{ error }} <button type="button" class="text-button" @click="load">{{ $t('jobs.retry') }}</button></p>
  <p v-if="busy && !items.length" class="skeleton" role="status">{{ $t('manager.loadingQueue') }}</p>
  <section v-else-if="!shown.length" class="empty panel"><h2>{{ $t('manager.emptyQueue') }}</h2><p>{{ query ? $t('manager.emptySearch') : $t('manager.emptyQueueBody') }}</p></section>
  <div v-else class="jobs"><button v-for="item in shown" :key="item.card._id" type="button" class="job-card" @click="emit('open',item)"><div class="section-heading"><span class="job-number">{{ item.card.Number || item.card._id }}</span><span class="priority">{{ label(item.card,'Priority') || $t('jobs.noPriority') }}</span></div><h2>{{ item.card.ShortDescr || item.card.Description }}</h2><p class="equipment">{{ label(item.card,'CI') || $t('jobs.equipmentUnknown') }}</p><p class="location">{{ location(item) || $t('jobs.locationUnknown') }}</p><p class="muted">{{ $t('manager.requester') }}: {{ label(item.card,'Requester') || '—' }} · {{ label(item.card,'Type') || '—' }}</p><div class="card-footer"><span class="badge">{{ item.activity.description }}</span><span class="muted">{{ formatDateTime(item.card.OpeningDate) }}</span><span aria-hidden="true">→</span></div></button></div>
</template>
