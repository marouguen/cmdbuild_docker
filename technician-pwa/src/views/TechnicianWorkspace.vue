<script setup lang="ts">
import { ref } from 'vue';
import JobsView from './JobsView.vue';
import JobView from './JobView.vue';

const jobId = ref<number | null>(null);
</script>

<template>
  <JobView v-if="jobId" :key="jobId" :id="jobId" @back="jobId = null" />
  <JobsView v-else @open="jobId = $event" />
</template>
