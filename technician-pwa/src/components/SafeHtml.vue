<script setup lang="ts">
import { computed } from 'vue';
import DOMPurify from 'dompurify';
const props = defineProps<{content: unknown}>();
const clean = computed(() => DOMPurify.sanitize(String(props.content ?? ''), {ALLOWED_TAGS:['p','br','b','strong','em','i','ul','ol','li','div','span','h2','h3','h4','blockquote'],ALLOWED_ATTR:[]}));
</script>
<template><div class="prose" v-html="clean"></div></template>
