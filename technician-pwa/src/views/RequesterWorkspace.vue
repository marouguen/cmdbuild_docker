<script setup lang="ts">
import { ref } from 'vue';
import type { Card } from '../types/api';
import RequestList from '../components/requester/RequestList.vue';
import NewRequest from '../components/requester/NewRequest.vue';
import RequestDetail from '../components/requester/RequestDetail.vue';

type Page = 'list' | 'new' | 'detail';
const page = ref<Page>('list');
const selected = ref<Card | null>(null);
const listKey = ref(0);
const notice = ref(false);

function open(card: Card) {
  selected.value = card;
  page.value = 'detail';
}
function created(request: Card) {
  notice.value = true;
  listKey.value++;
  selected.value = request;
  page.value = 'detail';
}
function showList() { selected.value = null; page.value = 'list'; }
</script>

<template>
  <p v-if="notice && page === 'list'" class="success" role="status">{{ $t('requester.createdNotice') }}</p>
  <RequestList v-if="page === 'list'" :key="listKey" @open="open" @create="page = 'new'; notice = false" />
  <NewRequest v-else-if="page === 'new'" @cancel="showList" @created="created" />
  <RequestDetail v-else-if="selected" :source="selected" @back="showList" />
</template>
