<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'

const auth = useAuthStore()
const sync = useSyncStore()

const lastSyncedLabel = computed(() =>
  sync.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleString() : null,
)

onMounted(() => {
  sync.fetchStatus()
})
</script>

<template>
  <v-container
    class="d-flex align-center justify-center"
    style="min-height: 60vh"
  >
    <!-- Loading state -->
    <v-card
      v-if="auth.loading"
      flat
    >
      <v-progress-circular
        indeterminate
        color="primary"
      />
    </v-card>

    <!-- Connect with Google card -->
    <v-card
      v-else-if="!auth.connected"
      max-width="480"
      class="pa-8 text-center"
      elevation="2"
    >
      <v-icon
        size="64"
        color="primary"
        class="mb-4"
      >mdi-google-drive</v-icon>
      <v-card-title class="text-h5 mb-2">Connect Google Drive</v-card-title>
      <v-card-text class="text-body-1 mb-4">
        Connect your Google Drive account to sync file metadata and explore insights.
      </v-card-text>
      <v-btn
        color="primary"
        size="large"
        prepend-icon="mdi-google"
        @click="auth.connectGoogle()"
      >
        Connect with Google
      </v-btn>
    </v-card>

    <!-- Connected card -->
    <v-card
      v-else
      max-width="480"
      class="pa-8 d-flex flex-column align-center"
      elevation="2"
    >
      <v-icon
        size="64"
        color="success"
        class="mb-4"
      >mdi-check-circle</v-icon>
      <v-card-title class="text-h5 mb-2">Connected</v-card-title>
      <v-card-text class="text-body-1 mb-4">
        Signed in as <strong>{{ auth.email }}</strong>
      </v-card-text>

      <v-btn
        variant="flat"
        color="primary"
        size="large"
        prepend-icon="mdi-sync"
        :loading="sync.syncing"
        class="mb-4"
        @click="sync.triggerSync()"
      >
        Sync Drive Files
      </v-btn>

      <div
        v-if="sync.lastSyncedAt"
        class="text-body-2 text-medium-emphasis mb-4"
      >
        {{ sync.fileCount }} files synced &middot;
        Last synced {{ lastSyncedLabel }}
      </div>

      <v-btn
        variant="outlined"
        color="error"
        prepend-icon="mdi-link-off"
        @click="auth.disconnectGoogle()"
      >
        Disconnect
      </v-btn>
    </v-card>
  </v-container>
</template>
