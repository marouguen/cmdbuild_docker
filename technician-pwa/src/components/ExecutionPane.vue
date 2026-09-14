<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { choices, mapActions, saveExecution, executionPayload, assertExecutionMetadata, type ExecutionDraft } from '../api/processes';
import type { Activity, Card, Lookup } from '../types/api';
import { ApiError } from '../api/client';
const props = defineProps<{job: Card; activity: Activity; copiedNotes?: string}>();
const emit = defineEmits<{saved: []; dirty: [value: boolean]}>();
const localDate = (value: unknown) => { if (!value) return ''; const d = new Date(String(value)); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16); };
const draft = reactive<ExecutionDraft>({ExecStartDate:localDate(props.job.ExecStartDate),ExecEndDate:localDate(props.job.ExecEndDate),ProcessNotes:props.copiedNotes ?? String(props.job.ProcessNotes ?? '')});
const allowed = ref<Lookup[]>([]), outcomes = ref<Lookup[]>([]), assignees = ref<Card[]>([]);
const loading = ref(true), busy = ref(false), error = ref(''), reviewing = ref(false), uncertain = ref(false), blocked = ref(false);
const selected = computed(() => allowed.value.find(a=>a._id===draft.Action));
// Conclude is the normal technician path. Reassignment/rescheduling are supervisor/planner
// concerns that openMAINT's API happens to expose on the same activity; they are kept
// available (openMAINT may require a technician to use them when genuinely blocked) but
// demoted out of the primary flow rather than shown with equal weight.
const advanceAction = computed(() => allowed.value.find(a=>a.code==='CM-Execution_Advance'));
const otherActions = computed(() => allowed.value.filter(a=>a.code!=='CM-Execution_Advance'));
const secondarySelected = computed(() => otherActions.value.some(a=>a._id===draft.Action));
const dialog = ref<HTMLDialogElement>();
watch(reviewing, async value => { await nextTick(); if (value) dialog.value?.showModal(); else dialog.value?.close(); });
const writable = (id: string) => props.activity.attributes?.some(a => a._id===id && a.writable);
const changed = () => emit('dirty',true);
onMounted(async()=>{
  try {
    assertExecutionMetadata(props.activity);
    const a = props.activity.attributes ?? [];
    const action = a.find(x=>x._id==='Action');
    if (!action) throw Error('Action metadata is unavailable.');
    allowed.value = mapActions(props.activity,await choices(action,props.job) as Lookup[]);
    const outcome = a.find(x=>x._id==='Outcome' && x.writable);
    if (outcome) outcomes.value = (await choices(outcome,props.job) as Lookup[]).filter(x=>x.active);
    const assignee = a.find(x=>x._id==='Assignee' && x.writable);
    if (assignee) assignees.value = await choices(assignee,props.job) as Card[];
  } catch(e) { error.value=(e as Error).message; blocked.value=true; }
  finally { loading.value=false; }
});
function review() { try { executionPayload(props.activity,draft,allowed.value,true); error.value='';reviewing.value=true; }catch(e){error.value=(e as Error).message;} }
async function save(advance: boolean) {
  if(busy.value || uncertain.value)return;
  busy.value=true;error.value='';reviewing.value=false;
  try { await saveExecution(props.job,props.activity,draft,advance); emit('dirty',false); emit('saved'); }
  catch(e) {error.value=(e as Error).message;uncertain.value=e instanceof ApiError && e.uncertain;}
  finally{busy.value=false;}
}
</script>
<template>
  <section class="panel"><div class="section-heading"><div><p class="eyebrow">Execution</p><h2>Record your work</h2></div><span class="badge">{{ activity.description }}</span></div>
    <p v-if="loading" role="status">Loading allowed actions…</p>
    <form v-else @submit.prevent="review" @input="changed" @change="changed">
      <fieldset :disabled="busy || uncertain || blocked"><legend class="sr-only">Execution details</legend>
        <div class="field-pair"><label v-if="writable('ExecStartDate')">Started<input v-model="draft.ExecStartDate" type="datetime-local"><button class="text-button" type="button" @click="draft.ExecStartDate=localDate(new Date());changed()">Use current time</button></label>
        <label v-if="writable('ExecEndDate')">Finished<input v-model="draft.ExecEndDate" type="datetime-local"><button class="text-button" type="button" @click="draft.ExecEndDate=localDate(new Date());changed()">Use current time</button></label></div>
        <label v-if="writable('ProcessNotes')">What did you do?<textarea v-model="draft.ProcessNotes" rows="5" placeholder="Checks, findings, and work performed"></textarea></label>
        <button class="secondary wide" type="button" @click="save(false)">{{ busy ? 'Saving…' : 'Save progress' }}</button>
        <div class="divider"></div>
        <template v-if="advanceAction">
          <label>Outcome<select v-model="draft.Outcome"><option :value="undefined">Select outcome</option><option v-for="o in outcomes" :key="o._id" :value="o._id">{{ o.description }}</option></select></label>
          <button class="primary wide" type="submit" @click="draft.Action=advanceAction!._id">Complete job</button>
        </template>
        <p v-else-if="!allowed.length" class="hint">No technician action is currently available for this job.</p>
        <details v-if="otherActions.length"><summary>Can't complete this job? Reassign or reschedule</summary>
          <label>Next action<select v-model="draft.Action"><option :value="undefined">Choose an action</option><option v-for="a in otherActions" :key="a._id" :value="a._id">{{ a.description }}</option></select></label>
          <label v-if="selected?.code==='CM-Execution_Return'">Assign to<select v-model="draft.Assignee"><option :value="undefined">Select technician</option><option v-for="a in assignees" :key="a._id" :value="a._id">{{ a.Description || a.Code }}</option></select><small v-if="!assignees.length">No permitted assignees returned by openMAINT.</small></label>
          <p v-if="selected?.code==='CM-Execution_Back'" class="hint">This returns the job to openMAINT’s rescheduling step.</p>
          <button class="secondary wide" type="submit" :disabled="!secondarySelected">Review action</button>
        </details>
      </fieldset>
    </form>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <dialog ref="dialog" class="review-modal" aria-labelledby="review-title" @cancel="reviewing=false"><h2 id="review-title">{{ selected?.description }}?</h2><p>{{ job.Number }} · {{ job.ShortDescr }}</p><p>This saves your execution details and advances the openMAINT workflow.</p><div class="button-row"><button class="secondary" autofocus @click="reviewing=false">Keep editing</button><button class="primary" @click="save(true)">Confirm action</button></div></dialog>
  </section>
</template>
