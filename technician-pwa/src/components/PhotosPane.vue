<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { attachmentList, photoCategories, uploadPhoto, downloadAttachment, type DmsCategory } from '../api/attachments';
import { translateError } from '../i18n/errors';
import type { Attachment } from '../types/api';
import { ApiError } from '../api/client';
const {t}=useI18n();
const props=defineProps<{id:number;canEdit:boolean}>();
const items=ref<Attachment[]>([]),categories=ref<DmsCategory[]>([]),category=ref<number>(),file=ref<File|null>(null),description=ref(''),error=ref(''),notice=ref(''),loading=ref(true),busy=ref(false),uncertain=ref(false),input=ref<HTMLInputElement>();
async function load(){try{items.value=await attachmentList(props.id);if(props.canEdit){categories.value=await photoCategories();category.value=categories.value.find(c=>c.code==='Photo')?._id ?? categories.value[0]?._id;}}catch(e){error.value=translateError((e as Error).message);}finally{loading.value=false;}}
onMounted(load);
async function upload(){const c=categories.value.find(c=>c._id===category.value);if(!file.value||!c||busy.value||uncertain.value)return;busy.value=true;error.value='';try{await uploadPhoto(props.id,file.value,c,description.value);file.value=null;description.value='';if(input.value)input.value.value='';notice.value=t('photos.savedNotice');await load();}catch(e){error.value=translateError((e as Error).message);uncertain.value=e instanceof ApiError&&e.uncertain;}finally{busy.value=false;}}
async function download(item:Attachment){busy.value=true;error.value='';try{const blob=await downloadAttachment(props.id,item);const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=item.name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){error.value=translateError((e as Error).message);}finally{busy.value=false;}}
</script>
<template><section class="panel"><p class="eyebrow">{{ $t('photos.eyebrow') }}</p><h2>{{ $t('photos.title') }}</h2><p v-if="loading" role="status">{{ $t('photos.loading') }}</p><p v-else-if="!items.length" class="empty">{{ $t('photos.empty') }}</p>
<button v-for="item in items" :key="item._id" class="topic-card" :disabled="busy" @click="download(item)"><span><strong>{{ item.name }}</strong><small>{{ item._category_description }}</small></span><span aria-hidden="true">↓</span></button>
<form v-if="canEdit && categories.length" @submit.prevent="upload"><fieldset :disabled="busy||uncertain"><legend class="sr-only">Add photo</legend><label>{{ $t('photos.addPhoto') }}<input ref="input" type="file" accept="image/jpeg,image/png,image/webp" @change="file=($event.target as HTMLInputElement).files?.[0]??null"></label><small>{{ $t('photos.fileHint') }}</small><label>{{ $t('photos.category') }}<select v-model="category"><option v-for="c in categories" :key="c._id" :value="c._id">{{ c.description }}</option></select></label><label>{{ $t('photos.caption') }}<input v-model="description" :placeholder="$t('photos.captionPlaceholder')"></label><button class="primary wide" :disabled="!file">{{ busy?$t('photos.uploading'):$t('photos.upload') }}</button></fieldset></form>
<p v-if="notice" class="success" role="status">{{ notice }}</p><p v-if="error" class="error" role="alert">{{ error }}</p></section></template>
