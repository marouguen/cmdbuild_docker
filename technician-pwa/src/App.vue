<script setup lang="ts">
import { onBeforeUnmount,onMounted,ref,watch } from 'vue';
import { auth } from './stores/auth';
import { i18n, setLocale } from './i18n';
import { translateError } from './i18n/errors';
import JobsView from './views/JobsView.vue';
import JobView from './views/JobView.vue';
const {session,notice}=auth;
const locale=i18n.global.locale;
const username=ref(''),password=ref(''),error=ref(''),busy=ref(false),jobId=ref<number|null>(null),online=ref(navigator.onLine);
const install=ref<(Event & {prompt:()=>Promise<void>})|null>(null);
// Reusable product defaults; a deployment sets these in its own .env.local, never in source.
const appShortName=(import.meta.env.VITE_APP_SHORT_NAME as string|undefined)||'Technician';
const deploymentName=import.meta.env.VITE_DEPLOYMENT_NAME as string|undefined;
async function login(){if(busy.value)return;busy.value=true;error.value='';try{await auth.login(username.value,password.value);}catch(e){error.value=translateError((e as Error).message);}finally{password.value='';busy.value=false;}}
async function logout(){busy.value=true;await auth.logout();busy.value=false;}
const updateOnline=()=>{online.value=navigator.onLine;};
const installPrompt=(event:Event)=>{event.preventDefault();install.value=event as typeof install.value;};
watch(session,()=>{jobId.value=null;});
onMounted(()=>{window.addEventListener('online',updateOnline);window.addEventListener('offline',updateOnline);window.addEventListener('beforeinstallprompt',installPrompt);});
onBeforeUnmount(()=>{window.removeEventListener('online',updateOnline);window.removeEventListener('offline',updateOnline);window.removeEventListener('beforeinstallprompt',installPrompt);});
</script>
<template><header class="app-header"><div class="brand"><span class="brand-mark" aria-hidden="true">{{ appShortName.charAt(0).toUpperCase() }}</span><span>{{ appShortName.toUpperCase() }}<small>CMMS</small></span></div><div class="header-actions"><div class="lang-switch" role="group" aria-label="Language / Langue"><button type="button" class="header-button" :class="{selected:locale==='en'}" :aria-pressed="locale==='en'" @click="setLocale('en')">EN</button><button type="button" class="header-button" :class="{selected:locale==='fr'}" :aria-pressed="locale==='fr'" @click="setLocale('fr')">FR</button></div><button v-if="install" class="header-button" @click="install.prompt();install=null">{{ $t('app.install') }}</button><button v-if="session" class="header-button" :disabled="busy" @click="logout">{{ $t('app.signOut') }}</button></div></header><div v-if="!online" class="offline" role="status">{{ $t('app.offline') }}</div><main :class="{login:!session}"><template v-if="!session"><div class="welcome"><p class="eyebrow">{{ $t('login.eyebrow') }}</p><h1>{{ $t('login.headline1') }}<br>{{ $t('login.headline2') }}</h1><p>{{ $t('login.sub1') }}<br>{{ $t('login.sub2') }}</p></div><form class="panel login-form" @submit.prevent="login"><h2>{{ $t('login.title') }}</h2><p class="muted">{{ $t('login.subtitle') }}</p><fieldset :disabled="busy||!online"><legend class="sr-only">Account credentials</legend><label>{{ $t('login.username') }}<input v-model="username" autocomplete="username" autocapitalize="none" spellcheck="false" required></label><label>{{ $t('login.password') }}<input v-model="password" type="password" autocomplete="current-password" required></label><button class="primary wide">{{ busy?$t('login.signingIn'):$t('login.signIn') }}</button></fieldset><p v-if="error" class="error" role="alert">{{ error }}</p><p v-if="notice" class="hint" role="status">{{ translateError(notice) }}</p></form><p class="login-foot">{{ $t('app.connectedTo') }}<template v-if="deploymentName"> · {{ deploymentName }}</template></p></template><template v-else><div class="user-line"><span>{{ session.userDescription || session.username }}</span><span>{{ session.role }}</span></div><JobView v-if="jobId" :key="jobId" :id="jobId" @back="jobId=null"/><JobsView v-else @open="jobId=$event"/></template></main><footer v-if="session" class="app-footer">{{ $t('app.systemOfRecord') }}</footer></template>
