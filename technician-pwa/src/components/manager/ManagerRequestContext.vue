<script setup lang="ts">
import { computed } from 'vue';
import { formatDateTime } from '../../i18n/date';
import SafeHtml from '../SafeHtml.vue';
import type { Card, Attachment } from '../../types/api';
const props=defineProps<{request:Card; originalNotes:string|null; history:Card[]; attachments:Attachment[]; busy:boolean; execution?:boolean}>();
defineEmits<{download:[item:Attachment]}>();
const label=(card:Card,key:string)=>String(card[`_${key}_description_translation`]??card[`_${key}_description`]??card[`_${key}_code`]??'');
const location=computed(()=>[label(props.request,'Site'),label(props.request,'Floor'),label(props.request,'Room')].filter(Boolean).join(' · '));
</script>
<template>
    <section class="panel"><h2>{{ $t('manager.requestDetails') }}</h2><dl class="facts request-facts"><div><dt>{{ $t('manager.priority') }}</dt><dd>{{ label(request,'Priority')||'—' }}</dd></div><div><dt>{{ $t('manager.type') }}</dt><dd>{{ label(request,'Type')||'—' }}</dd></div><div><dt>{{ $t('manager.requester') }}</dt><dd>{{ label(request,'Requester')||'—' }}</dd></div><div><dt>{{ $t('manager.openingDate') }}</dt><dd>{{ formatDateTime(request.OpeningDate)||'—' }}</dd></div><div><dt>{{ $t('manager.siteLocation') }}</dt><dd>{{ location||'—' }}</dd></div><div><dt>{{ $t('manager.equipment') }}</dt><dd>{{ label(request,'CI')||'—' }}</dd></div><div><dt>{{ $t('manager.category') }}</dt><dd>{{ label(request,'Category')||'—' }}</dd></div><div><dt>{{ $t('manager.subcategory') }}</dt><dd>{{ label(request,'Subcategory')||'—' }}</dd></div></dl><h3>{{ $t('manager.originalNotes') }}</h3><p class="prose">{{ originalNotes||$t('manager.noNotes') }}</p></section>
    <section v-if="execution" class="panel"><h2>{{ $t('manager.accounting.execution') }}</h2><dl class="facts request-facts"><div><dt>{{ $t('manager.team') }}</dt><dd>{{ label(request,'Team') || '—' }}</dd></div><div><dt>{{ $t('manager.accounting.outcome') }}</dt><dd>{{ label(request,'Outcome') || '—' }}</dd></div><div><dt>{{ $t('manager.accounting.start') }}</dt><dd>{{ formatDateTime(request.ExecStartDate) || '—' }}</dd></div><div><dt>{{ $t('manager.accounting.end') }}</dt><dd>{{ formatDateTime(request.ExecEndDate) || '—' }}</dd></div></dl><SafeHtml v-if="request.Register" :content="request.Register" /></section>
    <slot />
    <section class="panel"><h2>{{ $t('manager.history') }}</h2><p v-if="!history.length" class="empty">{{ $t('manager.noHistory') }}</p><article v-for="row in history" :key="String(row._id)+row._beginDate" class="resource-card"><strong>{{ row._activity_description||row._historyType }}</strong><p>{{ formatDateTime(row._beginDate) }}<template v-if="row._endDate"> → {{ formatDateTime(row._endDate) }}</template> · {{ row.__user_description||row._user }}</p></article></section>
    <section class="panel"><h2>{{ $t('manager.attachments') }}</h2><p v-if="!attachments.length" class="empty">{{ $t('manager.noAttachments') }}</p><button v-for="item in attachments" :key="item._id" type="button" class="topic-card" :disabled="busy" @click="$emit('download',item)"><span><strong>{{ item.name }}</strong><small>{{ item._category_description }}</small></span><span aria-hidden="true">↓</span></button></section>
</template>
