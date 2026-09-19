<script setup lang="ts">
import { ref } from 'vue';
import type { AssignmentQueueItem } from '../api/manager';
import AssignmentQueue from '../components/manager/AssignmentQueue.vue';
import AssignmentDetail from '../components/manager/AssignmentDetail.vue';

const selected = ref<AssignmentQueueItem | null>(null);
const queueKey = ref(0);
function back(refresh = false) {
  selected.value = null;
  if (refresh) queueKey.value++;
}
</script>

<template>
  <AssignmentQueue v-if="!selected" :key="queueKey" @open="selected = $event" />
  <AssignmentDetail v-else :source="selected" @back="back" />
</template>
