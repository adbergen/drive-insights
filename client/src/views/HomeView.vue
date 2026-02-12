<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'
import { useFilesStore } from '@/stores/files'

const auth = useAuthStore()
const sync = useSyncStore()
const files = useFilesStore()

const lastSyncedLabel = computed(() =>
  sync.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleString() : null,
)

const headers = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Type', key: 'mimeType', sortable: true },
  { title: 'Owner', key: 'ownerEmail', sortable: true },
  { title: 'Modified', key: 'modifiedTime', sortable: true },
]

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString()
}

function friendlyMimeType(mime: string): string {
  return mime.replace('application/vnd.google-apps.', 'google-').split('/').pop() ?? mime
}

function onUpdateOptions(opts: { page: number; itemsPerPage: number; sortBy: { key: string; order: 'asc' | 'desc' }[] }) {
  files.params.page = opts.page
  files.params.limit = opts.itemsPerPage
  const sort = opts.sortBy[0]
  if (sort) {
    files.params.sortBy = sort.key
    files.params.order = sort.order
  }
  files.fetchFiles()
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null

function onSearchInput(value: string) {
  files.params.search = value
  files.params.page = 1
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => files.fetchFiles(), 300)
}

function onDateChange() {
  files.params.page = 1
  files.fetchFiles()
}

function clearFilters() {
  files.params.search = ''
  files.params.from = ''
  files.params.to = ''
  files.params.page = 1
  files.fetchFiles()
}

async function onSync() {
  await sync.triggerSync()
  files.fetchFiles()
}

onMounted(() => {
  sync.fetchStatus()
})
</script>

<template>
  <!-- Loading state -->
  <v-container
    v-if="auth.loading"
    class="d-flex align-center justify-center"
    style="min-height: 60vh"
  >
    <v-progress-circular
      indeterminate
      color="primary"
    />
  </v-container>

  <!-- Connect with Google -->
  <v-container
    v-else-if="!auth.connected"
    class="d-flex align-center justify-center"
    style="min-height: 60vh"
  >
    <v-card
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
  </v-container>

  <!-- Connected: file table -->
  <v-container
    v-else
    fluid
  >
    <div class="d-flex align-center justify-end ga-4 mb-4">
      <span
        v-if="sync.lastSyncedAt"
        class="text-body-2 text-medium-emphasis"
      >
        {{ sync.fileCount }} files &middot; Last synced {{ lastSyncedLabel }}
      </span>
      <v-btn
        variant="flat"
        color="primary"
        size="small"
        prepend-icon="mdi-sync"
        :loading="sync.syncing"
        @click="onSync"
      >
        Sync
      </v-btn>
    </div>

    <v-data-table-server
      :headers="headers"
      :items="files.files"
      :items-length="files.total"
      :loading="files.loading"
      :page="files.params.page"
      :items-per-page="files.params.limit"
      :sort-by="[{ key: files.params.sortBy, order: files.params.order }]"
      :search="files.params.search"
      @update:options="onUpdateOptions"
    >
      <template #top>
        <v-toolbar flat>
          <v-text-field
            :model-value="files.params.search"
            label="Search files"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            density="compact"
            clearable
            hide-details
            single-line
            class="mx-4"
            style="max-width: 400px"
            @update:model-value="onSearchInput"
          />
          <v-text-field
            v-model="files.params.from"
            label="From"
            type="date"
            variant="outlined"
            density="compact"
            hide-details
            style="max-width: 180px"
            class="mr-2"
            @update:model-value="onDateChange"
          />
          <v-text-field
            v-model="files.params.to"
            label="To"
            type="date"
            variant="outlined"
            density="compact"
            hide-details
            style="max-width: 180px"
            @update:model-value="onDateChange"
          />
          <v-btn
            icon="mdi-filter-remove"
            variant="text"
            size="small"
            @click="clearFilters"
          />
        </v-toolbar>
      </template>

      <template #item.name="{ item }">
        <a
          v-if="item.webViewLink"
          :href="item.webViewLink"
          target="_blank"
          rel="noopener"
          class="text-decoration-none"
        >
          {{ item.name }}
        </a>
        <span v-else>{{ item.name }}</span>
      </template>

      <template #item.mimeType="{ item }">
        {{ friendlyMimeType(item.mimeType) }}
      </template>

      <template #item.modifiedTime="{ item }">
        {{ formatDate(item.modifiedTime) }}
      </template>

      <template #no-data>
        <div class="text-center pa-4 text-medium-emphasis">
          No files found. Try adjusting your filters or sync your Drive files first.
        </div>
      </template>

    </v-data-table-server>
  </v-container>
</template>
