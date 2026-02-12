<script setup lang="ts">
import { watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'
import { useAnalyticsStore } from '@/stores/analytics'
import AiQueryCard from '@/components/AiQueryCard.vue'
import AnalyticsDashboard from '@/components/AnalyticsDashboard.vue'
import FileTable from '@/components/file-table/FileTable.vue'

const auth = useAuthStore()
const sync = useSyncStore()
const analytics = useAnalyticsStore()

watch(() => auth.connected, (connected) => {
  if (connected) {
    sync.fetchStatus()
    analytics.fetchAnalytics()
  }
}, { immediate: true })
</script>

<template>
  <v-container
    :fluid="auth.connected"
    :class="{ 'd-flex align-center justify-center': !auth.connected }"
    :style="!auth.connected ? 'min-height: 60vh' : undefined"
  >
    <!-- Loading state -->
    <v-progress-circular
      v-if="auth.loading"
      indeterminate
      color="primary"
    />

    <!-- Connect with Google -->
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

    <v-row
      v-else
      style="height: calc(100vh - 64px - 24px)"
    >
      <v-col
        cols="12"
        md="8"
        class="d-flex flex-column overflow-hidden"
      >
        <AiQueryCard />
        <FileTable />
      </v-col>
      <v-col
        cols="12"
        md="4"
        class="overflow-auto"
      >
        <AnalyticsDashboard />
      </v-col>
    </v-row>
  </v-container>
</template>
