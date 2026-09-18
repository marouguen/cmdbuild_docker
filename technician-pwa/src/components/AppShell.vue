<script setup lang="ts">
import { computed } from 'vue';
import type { Session } from '../types/api';
import { workspaceForSession } from '../auth/roles';
import TechnicianWorkspace from '../views/TechnicianWorkspace.vue';
import RequesterWorkspace from '../views/RequesterWorkspace.vue';
import ManagerWorkspace from '../views/ManagerWorkspace.vue';

const props = defineProps<{session: Pick<Session, 'username' | 'userDescription' | 'role'>}>();
const workspace = computed(() => workspaceForSession(props.session));
</script>

<template>
  <div class="user-line">
    <span>{{ session.userDescription || session.username }}</span>
    <span>{{ session.role }}</span>
  </div>
  <TechnicianWorkspace v-if="workspace === 'technician'" />
  <RequesterWorkspace v-else-if="workspace === 'requester'" />
  <ManagerWorkspace v-else-if="workspace === 'manager'" />
  <section v-else class="panel workspace-message" role="status">
    <p class="eyebrow">{{ $t('workspace.unsupportedEyebrow') }}</p>
    <h1>{{ $t('workspace.unsupportedTitle') }}</h1>
    <p>{{ $t('workspace.unsupportedBody', {role: session.role}) }}</p>
    <p class="hint">{{ $t('workspace.authorityNotice') }}</p>
  </section>
</template>
