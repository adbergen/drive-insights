<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFilesStore, type DriveFile } from '@/stores/files'
import { useSyncStore } from '@/stores/sync'
import { useAnalyticsStore } from '@/stores/analytics'
import { formatDate, friendlyMimeType } from '@/utils/formatters'
import RenameDialog from './RenameDialog.vue'
import DeleteDialog from './DeleteDialog.vue'
import ViewDialog from './ViewDialog.vue'

const files = useFilesStore()
const sync = useSyncStore()
const analytics = useAnalyticsStore()

const lastSyncedLabel = computed(() =>
  sync.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleString() : null,
)

async function onSync() {
  await sync.triggerSync()
  files.fetchFiles()
  analytics.fetchAnalytics()
}

const headers = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Type', key: 'mimeType', sortable: true },
  { title: 'Owner', key: 'ownerEmail', sortable: true },
  { title: 'Modified', key: 'modifiedTime', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '140px' },
]

const renameOpen = ref(false)
const deleteOpen = ref(false)
const viewOpen = ref(false)
const activeFile = ref<DriveFile | null>(null)

function openRename(file: DriveFile) {
  activeFile.value = file
  renameOpen.value = true
}

function openDelete(file: DriveFile) {
  activeFile.value = file
  deleteOpen.value = true
}

function openView(file: DriveFile) {
  activeFile.value = file
  viewOpen.value = true
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
  if (!value.trim()) {
    files.fetchFiles()
    return
  }
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
</script>

<template>
  <v-card
    rounded="lg"
    class="d-flex flex-column flex-grow-1"
    style="min-height: 0"
  >
    <v-data-table-server
      :headers="headers"
      :items="files.files"
      :items-length="files.total"
      :loading="files.loading"
      :page="files.params.page"
      :items-per-page="files.params.limit"
      :sort-by="[{ key: files.params.sortBy, order: files.params.order }]"
      fixed-header
      class="flex-grow-1"
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
          <v-spacer />
          <span
            v-if="sync.lastSyncedAt"
            class="text-body-2 text-medium-emphasis mr-2"
          >
            {{ sync.fileCount }} files &middot; {{ lastSyncedLabel }}
          </span>
          <v-btn
            variant="flat"
            color="primary"
            size="small"
            prepend-icon="mdi-sync"
            :loading="sync.syncing"
            class="mr-2"
            @click="onSync"
          >
            Sync
          </v-btn>
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

      <template #item.actions="{ item }">
        <div class="d-flex">
          <v-tooltip
            text="Details"
            location="top"
          >
            <template #activator="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon="mdi-information-outline"
                variant="text"
                size="small"
                @click="openView(item)"
              />
            </template>
          </v-tooltip>
          <v-tooltip
            text="Rename"
            location="top"
          >
            <template #activator="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon="mdi-pencil"
                variant="text"
                size="small"
                @click="openRename(item)"
              />
            </template>
          </v-tooltip>
          <v-tooltip
            text="Delete"
            location="top"
          >
            <template #activator="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon="mdi-delete"
                variant="text"
                size="small"
                color="error"
                @click="openDelete(item)"
              />
            </template>
          </v-tooltip>
        </div>
      </template>

      <template #no-data>
        <div class="text-center pa-4 text-medium-emphasis">
          No files found. Try adjusting your filters or sync your Drive files first.
        </div>
      </template>
    </v-data-table-server>
  </v-card>

  <!-- CRUD dialogs -->
  <RenameDialog
    v-model="renameOpen"
    :file="activeFile"
  />
  <DeleteDialog
    v-model="deleteOpen"
    :file="activeFile"
  />
  <ViewDialog
    v-model="viewOpen"
    :file="activeFile"
  />
</template>

<style scoped>
.v-card :deep(.v-data-table) {
  display: flex;
  flex-direction: column;
  height: 0;
  min-height: 0;
}

.v-card :deep(.v-table__wrapper) {
  flex: 1 1 0;
  overflow-y: auto;
}
</style>
