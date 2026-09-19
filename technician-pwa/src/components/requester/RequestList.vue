<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { listRequests } from '../../api/requester';
import { translateError } from '../../i18n/errors';
import type { Card } from '../../types/api';
import { formatDateTime } from '../../i18n/date';

const emit = defineEmits<{open: [card: Card]; create: []}>();
const cards = ref<Card[]>([]), total = ref(0), busy = ref(false), error = ref(''), query = ref('');
const label = (card: Card, key: string) => String(card[`_${key}_description_translation`] ?? card[`_${key}_description`] ?? card[`_${key}_code`] ?? '');
const location = (card: Card) => [label(card, 'Site'), label(card, 'Floor'), label(card, 'Room')].filter(Boolean).join(' · ');
const requestText = (card: Card) => [card.Number, card.ShortDescr, label(card,'Priority'), label(card,'ProcessStatus'), label(card,'CI'), location(card)].join(' ');
const shown = computed(() => { const term = query.value.trim().toLocaleLowerCase(); return cards.value.filter(card => !term || requestText(card).toLocaleLowerCase().includes(term)); });

async function load(more = false) {
  if (busy.value) return;
  busy.value = true; error.value = '';
  try { const response = await listRequests(more ? cards.value.length : 0); cards.value = more ? [...cards.value, ...response.data] : response.data; total.value = response.meta?.total ?? cards.value.length; }
  catch (reason) { error.value = translateError((reason as Error).message); }
  finally { busy.value = false; }
}
onMounted(() => load());
</script>

<template>
  <div class="page-title"><div><p class="eyebrow">{{ $t('requester.eyebrow') }}</p><h1>{{ $t('requester.myRequests') }} <span class="count">{{ shown.length }}</span></h1></div><button class="icon-button" :aria-label="$t('requester.refresh')" :disabled="busy" @click="load()">↻</button></div>
  <p class="muted">{{ $t('requester.listSubtitle') }}</p>
  <button class="primary wide request-create" @click="emit('create')">{{ $t('requester.newRequest') }}</button>
  <label><span class="sr-only">{{ $t('requester.search') }}</span><input v-model="query" class="search" type="search" :placeholder="$t('requester.searchPlaceholder')"></label>
  <p v-if="cards.length < total" class="hint">{{ $t('requester.loadedOfTotal', {loaded: cards.length, total}) }}</p>
  <p v-if="error" class="error" role="alert">{{ error }} <button class="text-button" @click="load()">{{ $t('jobs.retry') }}</button></p>
  <p v-if="busy && !cards.length" class="skeleton" role="status">{{ $t('requester.loading') }}</p>
  <section v-else-if="!shown.length" class="empty panel"><h2>{{ $t('requester.empty') }}</h2><p>{{ query ? $t('requester.emptySearch') : $t('requester.emptyDefault') }}</p></section>
  <div class="jobs"><button v-for="card in shown" :key="card._id" class="job-card" @click="emit('open', card)"><div class="section-heading"><span class="job-number">{{ card.Number || card._id }}</span><span class="priority">{{ label(card, 'Priority') || $t('jobs.noPriority') }}</span></div><h2>{{ card.ShortDescr || card.Description }}</h2><p class="equipment">{{ label(card, 'CI') || $t('jobs.equipmentUnknown') }}</p><p class="location">{{ location(card) || $t('jobs.locationUnknown') }}</p><div class="card-footer"><span class="badge">{{ label(card, 'ProcessStatus') }}</span><span class="muted">{{ formatDateTime(card.OpeningDate) }}</span><span aria-hidden="true">→</span></div></button></div>
  <button v-if="cards.length < total" class="secondary wide" :disabled="busy" @click="load(true)">{{ busy ? $t('jobs.loadingMore') : $t('jobs.loadMore') }}</button>
</template>
