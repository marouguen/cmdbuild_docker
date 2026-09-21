<script setup lang="ts">
import { ref } from 'vue';
import type { AssignmentQueueItem } from '../api/manager';
import AssignmentQueue from '../components/manager/AssignmentQueue.vue';
import AssignmentDetail from '../components/manager/AssignmentDetail.vue';
import AccountingDetail from '../components/manager/AccountingDetail.vue';

const selected = ref<AssignmentQueueItem | null>(null);
const queueKey = ref(0);
const mode = ref<'assignment'|'accounting'>('assignment');
function back(refresh = false) {
  selected.value = null;
  if (refresh) queueKey.value++;
}
</script>

<template>
  <nav v-if="!selected" class="section-heading" :aria-label="$t('manager.workQueues')">
    <button type="button" :class="mode==='assignment'?'primary':'text-button'" :aria-pressed="mode==='assignment'" @click="mode='assignment'">{{ $t('manager.queue') }}</button>
    <button type="button" :class="mode==='accounting'?'primary':'text-button'" :aria-pressed="mode==='accounting'" @click="mode='accounting'">{{ $t('manager.accounting.queue') }}</button>
  </nav>
  <AssignmentQueue v-if="!selected" :key="mode+queueKey" :mode="mode" @open="selected = $event" />
  <AccountingDetail v-else-if="mode==='accounting'" :source="selected" @back="back" />
  <AssignmentDetail v-else :source="selected" @back="back" />
</template>
