<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'
import AiQueryCard from '@/components/AiQueryCard.vue'
import FileTable from '@/components/file-table/FileTable.vue'

const auth = useAuthStore()
const sync = useSyncStore()

onMounted(() => {
  sync.fetchStatus()
})
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

    <template v-else>
      <AiQueryCard />
      <FileTable />
    </template>
  </v-container>
</template>
