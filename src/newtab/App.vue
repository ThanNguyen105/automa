<template>
  <template v-if="retrieved">
    <app-sidebar />
    <main class="pl-16">
      <router-view />
    </main>
    <ui-dialog>
      <template #auth>
        <div class="text-center">
          <p class="font-semibold text-xl">Oops!! 😬</p>
          <p class="mt-2 text-gray-600 dark:text-gray-200">
            {{ t('auth.text') }}
          </p>
          <ui-button
            tag="a"
            href="https://www.automa.site/auth"
            class="mt-6 w-full block"
            variant="accent"
          >
            {{ t('auth.signIn') }}
          </ui-button>
        </div>
      </template>
    </ui-dialog>
    <div
      v-if="isUpdated"
      class="p-4 shadow-2xl z-50 fixed bottom-8 left-1/2 -translate-x-1/2 rounded-lg bg-accent text-white dark:text-gray-900 flex items-center"
    >
      <v-remixicon name="riInformationLine" class="mr-3" />
      <p>
        {{ t('updateMessage.text1', { version: currentVersion }) }}
      </p>
      <a
        :href="`https://github.com/Kholid060/automa/releases/tag/v${currentVersion}`"
        target="_blank"
        rel="noopener"
        class="underline ml-1"
      >
        {{ t('updateMessage.text2') }}
      </a>
      <button
        class="ml-6 text-gray-200 dark:text-gray-600"
        @click="isUpdated = false"
      >
        <v-remixicon size="20" name="riCloseLine" />
      </button>
    </div>
  </template>
  <div v-else class="py-8 text-center">
    <ui-spinner color="text-accent" size="28" />
  </div>
</template>
<script setup>
import { ref } from 'vue';
import { useStore } from 'vuex';
import { useI18n } from 'vue-i18n';
import { compare } from 'compare-versions';
import browser from 'webextension-polyfill';
import { useTheme } from '@/composable/theme';
import { loadLocaleMessages, setI18nLanguage } from '@/lib/vue-i18n';
import { fetchApi, getSharedWorkflows, getUserWorkflows } from '@/utils/api';
import Workflow from '@/models/workflow';
import AppSidebar from '@/components/newtab/app/AppSidebar.vue';

const { t } = useI18n();
const store = useStore();
const theme = useTheme();

theme.init();

const retrieved = ref(false);

const currentVersion = browser.runtime.getManifest().version;
const prevVersion = localStorage.getItem('ext-version') || '0.0.0';
const isUpdated = ref(false);

async function syncHostWorkflow(hosts) {
  const hostIds = [];
  const workflowHosts = hosts || store.state.workflowHosts;
  const localWorkflowHost = Object.values(store.state.hostWorkflows);

  Object.keys(workflowHosts).forEach((hostId) => {
    const isItsOwn = localWorkflowHost.find((item) => item.hostId === hostId);

    if (isItsOwn) return;

    hostIds.push({ hostId, updatedAt: workflowHosts[hostId].updatedAt });
  });

  try {
    await store.dispatch('fetchWorkflowHosts', hostIds);
  } catch (error) {
    console.error(error);
  }
}
async function fetchUserData() {
  try {
    const response = await fetchApi('/me');
    const user = await response.json();

    if (response.status !== 200) {
      throw new Error(response.statusText);
    }

    const username = localStorage.getItem('username');

    if (!user || username !== user.username) {
      sessionStorage.removeItem('shared-workflows');
      sessionStorage.removeItem('user-workflows');
      sessionStorage.removeItem('backup-workflows');

      await browser.storage.local.remove([
        'backupIds',
        'lastBackup',
        'lastSync',
      ]);

      if (username !== user?.username) {
        await Workflow.update({
          where: ({ __id }) => __id !== null,
          data: { __id: null },
        });
      }

      if (!user) return;
    }

    store.commit('updateState', {
      key: 'user',
      value: user,
    });

    const [sharedWorkflows, userWorkflows] = await Promise.allSettled([
      getSharedWorkflows(),
      getUserWorkflows(),
    ]);

    localStorage.setItem('username', user.username);

    if (sharedWorkflows.status === 'fulfilled') {
      store.commit('updateState', {
        key: 'sharedWorkflows',
        value: sharedWorkflows.value,
      });
    }

    if (userWorkflows.status === 'fulfilled') {
      const { backup, hosted } = userWorkflows.value;

      store.commit('updateState', {
        key: 'hostWorkflows',
        value: hosted || {},
      });

      if (backup?.length > 0) {
        const { lastBackup } = browser.storage.local.get('lastBackup');
        if (!lastBackup) {
          const backupIds = backup.map(({ id }) => id);

          store.commit('updateState', {
            key: 'backupIds',
            value: backupIds,
          });
          await browser.storage.local.set({
            backupIds,
            lastBackup: new Date().toISOString(),
          });
        }

        await Workflow.insertOrUpdate({
          data: backup,
        });
      }
    }

    store.commit('updateState', {
      key: 'userDataRetrieved',
      value: true,
    });
  } catch (error) {
    console.error(error);
  }
}
function handleStorageChanged(change) {
  if (change.logs) {
    store.dispatch('entities/create', {
      entity: 'logs',
      data: change.logs.newValue,
    });
  }

  if (change.workflowState) {
    store.commit('updateState', {
      key: 'workflowState',
      value: Object.values(change.workflowState.newValue || {}).filter(
        ({ isDestroyed, parentState }) =>
          !isDestroyed && !parentState?.isCollection
      ),
    });
  }
}

browser.storage.local.onChanged.addListener(handleStorageChanged);

window.addEventListener('beforeunload', () => {
  browser.storage.local.onChanged.removeListener(handleStorageChanged);
});

(async () => {
  try {
    const { isFirstTime } = await browser.storage.local.get('isFirstTime');
    isUpdated.value = !isFirstTime && compare(currentVersion, prevVersion, '>');

    await Promise.allSettled([
      store.dispatch('retrieve', ['workflows', 'logs', 'collections']),
      store.dispatch('retrieveWorkflowState'),
    ]);

    await loadLocaleMessages(store.state.settings.locale, 'newtab');
    await setI18nLanguage(store.state.settings.locale);

    retrieved.value = true;

    await fetchUserData();
    await syncHostWorkflow();
  } catch (error) {
    retrieved.value = true;
    console.error(error);
  }

  localStorage.setItem('ext-version', currentVersion);
})();
</script>
<style>
html,
body {
  @apply bg-gray-50 dark:bg-gray-900 text-black dark:text-gray-100;
}
body {
  min-height: 100vh;
}
#app {
  height: 100%;
}
h1,
h2,
h3 {
  @apply dark:text-white;
}
</style>
