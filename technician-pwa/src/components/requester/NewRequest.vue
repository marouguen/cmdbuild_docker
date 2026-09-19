<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { getOpeningContract, openingAttribute, openingChoices, requestAttachmentCategories, RequestSubmissionError, submitRequest, type RequestDraft } from '../../api/requester';
import { translateError } from '../../i18n/errors';
import { recordRequesterStage } from '../../api/requesterDiagnostics';
import type { Activity, Card, Lookup } from '../../types/api';
import type { DmsCategory } from '../../api/attachments';

const emit = defineEmits<{cancel: []; created: [request: Card]}>();
const opening = ref<Activity | null>(null);
const requesters = ref<(Lookup|Card)[]>([]), types = ref<(Lookup|Card)[]>([]), priorities = ref<(Lookup|Card)[]>([]), sites = ref<(Lookup|Card)[]>([]);
const floors = ref<(Lookup|Card)[]>([]), rooms = ref<(Lookup|Card)[]>([]), equipment = ref<(Lookup|Card)[]>([]), categories = ref<(Lookup|Card)[]>([]), subcategories = ref<(Lookup|Card)[]>([]);
const dmsCategories = ref<DmsCategory[]>([]), dmsCategory = ref<number>(), files = ref<File[]>([]), fileInput = ref<HTMLInputElement>();
const draft = reactive<RequestDraft>({ShortDescr:'', ProcessNotes:''});
const loading = ref(true), busy = ref(false), error = ref(''), recovery = ref('');
const requester = computed(() => requesters.value[0]);
const optionId = (item: Lookup|Card) => item._id;
const optionLabel = (item: Lookup|Card) => { const value=item as Record<string,unknown>; return String(value._description_translation ?? value.description ?? value.Description ?? value._description ?? value.Code ?? value.code ?? value._id); };
const attr = (id: string) => opening.value ? openingAttribute(opening.value, id) : undefined;

async function loadChoices(id: string, values: Partial<RequestDraft> = {}) {
  const attribute = attr(id);
  return attribute ? openingChoices(attribute, values) : [];
}
async function load() {
  loading.value = true; error.value = '';
  try {
    const contract = await getOpeningContract(); opening.value = contract.opening;
    const attachmentEnabled=contract.opening.widgets?.some(widget=>widget._active&&widget._type==='openAttachment')===true;
    [requesters.value, types.value, priorities.value, sites.value, categories.value, dmsCategories.value] = await Promise.all([
      loadChoices('Requester'), loadChoices('Type'), loadChoices('Priority'), loadChoices('Site'), loadChoices('Category'), attachmentEnabled?requestAttachmentCategories(contract.process):Promise.resolve([])
    ]);
    if (requesters.value.length !== 1) throw new Error('openMAINT did not resolve exactly one requester for this account.');
    draft.Requester = requesters.value[0]._id;
    dmsCategory.value = dmsCategories.value.find(item => item.code === 'Photo')?._id ?? dmsCategories.value[0]?._id;
  } catch (reason) { error.value = translateError((reason as Error).message); }
  finally { loading.value = false; }
}
watch(() => draft.Site, async () => { draft.Floor=undefined;draft.Room=undefined;draft.CI=undefined;rooms.value=[];equipment.value=[];floors.value=draft.Site?await loadChoices('Floor',draft):[];equipment.value=draft.Site?await loadChoices('CI',draft):[]; });
watch(() => draft.Floor, async () => { draft.Room=undefined;draft.CI=undefined;rooms.value=draft.Site?await loadChoices('Room',draft):[];equipment.value=draft.Site?await loadChoices('CI',draft):[]; });
watch(() => draft.Room, async () => { draft.CI=undefined;equipment.value=draft.Site?await loadChoices('CI',draft):[]; });
watch(() => draft.Category, async () => { draft.Subcategory=undefined;subcategories.value=draft.Category?await loadChoices('Subcategory',draft):[]; });
function pickFiles(event: Event) { files.value = Array.from((event.target as HTMLInputElement).files ?? []); }
async function submit() {
  if (!opening.value || busy.value || recovery.value) return;
  busy.value=true;error.value='';
  try {
    const category=dmsCategories.value.find(item=>item._id===dmsCategory.value);
    const created=await submitRequest(opening.value,draft,files.value,category);
    emit('created',created);
  } catch (reason) {
    const failure=reason as Error;
    error.value=translateError(failure.message);
    if (failure instanceof RequestSubmissionError && (failure.uncertain || failure.request)) recovery.value=failure.request ? String(failure.request.Number || failure.request._id) : 'unknown';
  } finally {busy.value=false;}
}
onMounted(() => { recordRequesterStage('idle'); void load(); });
</script>

<template>
  <div class="section-heading"><button type="button" class="text-button" :disabled="busy" @click="emit('cancel')">← {{ $t('requester.backToRequests') }}</button></div>
  <div class="page-title"><div><p class="eyebrow">{{ $t('requester.newEyebrow') }}</p><h1>{{ $t('requester.newTitle') }}</h1></div></div>
  <p class="muted">{{ $t('requester.newSubtitle') }}</p>
  <p v-if="loading" class="skeleton" role="status">{{ $t('requester.loadingForm') }}</p>
  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <section v-if="recovery" class="panel"><h2>{{ $t('requester.recoveryTitle') }}</h2><p>{{ recovery === 'unknown' ? $t('requester.recoveryUnknown') : $t('requester.recoveryCreated',{number:recovery}) }}</p><button type="button" class="secondary wide" @click="emit('cancel')">{{ $t('requester.backToRequests') }}</button></section>
  <form v-else-if="opening && requester && !loading" class="panel request-form" @submit.stop.prevent="submit">
    <fieldset :disabled="busy">
      <label>{{ $t('requester.requester') }}<input :value="optionLabel(requester)" readonly></label>
      <label>{{ $t('requester.subject') }}<input v-model="draft.ShortDescr" maxlength="200" required></label>
      <div class="field-pair">
        <label>{{ $t('requester.type') }}<select v-model="draft.Type" required><option :value="undefined" disabled>{{ $t('requester.choose') }}</option><option v-for="item in types" :key="optionId(item)" :value="optionId(item)">{{ optionLabel(item) }}</option></select></label>
        <label>{{ $t('requester.priority') }}<select v-model="draft.Priority" required><option :value="undefined" disabled>{{ $t('requester.choose') }}</option><option v-for="item in priorities" :key="optionId(item)" :value="optionId(item)">{{ optionLabel(item) }}</option></select></label>
      </div>
      <label>{{ $t('requester.site') }}<select v-model="draft.Site" required><option :value="undefined" disabled>{{ $t('requester.choose') }}</option><option v-for="item in sites" :key="optionId(item)" :value="optionId(item)">{{ optionLabel(item) }}</option></select></label>
      <div class="field-pair">
        <label v-if="attr('Floor')?.writable">{{ $t('requester.floor') }}<select v-model="draft.Floor" :disabled="!draft.Site"><option :value="undefined">{{ $t('requester.none') }}</option><option v-for="item in floors" :key="optionId(item)" :value="optionId(item)">{{ optionLabel(item) }}</option></select></label>
        <label v-if="attr('Room')?.writable">{{ $t('requester.room') }}<select v-model="draft.Room" :disabled="!draft.Site"><option :value="undefined">{{ $t('requester.none') }}</option><option v-for="item in rooms" :key="optionId(item)" :value="optionId(item)">{{ optionLabel(item) }}</option></select></label>
      </div>
      <label v-if="attr('CI')?.writable">{{ $t('requester.equipment') }}<select v-model="draft.CI" :disabled="!draft.Site"><option :value="undefined">{{ $t('requester.none') }}</option><option v-for="item in equipment" :key="optionId(item)" :value="optionId(item)">{{ optionLabel(item) }}</option></select></label>
      <div class="field-pair">
        <label v-if="attr('Category')?.writable">{{ $t('requester.category') }}<select v-model="draft.Category"><option :value="undefined">{{ $t('requester.none') }}</option><option v-for="item in categories" :key="optionId(item)" :value="optionId(item)">{{ optionLabel(item) }}</option></select></label>
        <label v-if="attr('Subcategory')?.writable">{{ $t('requester.subcategory') }}<select v-model="draft.Subcategory" :disabled="!draft.Category"><option :value="undefined">{{ $t('requester.none') }}</option><option v-for="item in subcategories" :key="optionId(item)" :value="optionId(item)">{{ optionLabel(item) }}</option></select></label>
      </div>
      <label v-if="attr('ProcessNotes')?.writable">{{ $t('requester.notes') }}<textarea v-model="draft.ProcessNotes" rows="5"></textarea></label>
      <template v-if="dmsCategories.length">
        <label>{{ $t('requester.attachments') }}<input ref="fileInput" type="file" multiple @change="pickFiles"></label>
        <small>{{ $t('requester.attachmentHint') }}</small>
        <label v-if="files.length">{{ $t('requester.attachmentCategory') }}<select v-model="dmsCategory" required><option v-for="item in dmsCategories" :key="item._id" :value="item._id">{{ item.description }}</option></select></label>
      </template>
      <button type="submit" class="primary wide" :disabled="busy">{{ busy ? $t('requester.submitting') : $t('requester.submit') }}</button>
    </fieldset>
  </form>
</template>
