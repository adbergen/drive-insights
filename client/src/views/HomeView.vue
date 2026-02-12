<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'
import { useFilesStore, type DriveFile } from '@/stores/files'

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
  { title: '', key: 'actions', sortable: false, width: '140px' },
]

// Rename dialog
const renameDialog = ref(false)
const renameTarget = ref<DriveFile | null>(null)
const renameName = ref('')
const renaming = ref(false)

function openRename(file: DriveFile) {
  renameTarget.value = file
  renameName.value = file.name
  renameDialog.value = true
}

async function submitRename() {
  if (!renameTarget.value || !renameName.value.trim()) return
  renaming.value = true
  try {
    await files.renameFile(renameTarget.value.driveId, renameName.value.trim())
    renameDialog.value = false
  } catch (err) {
    console.error('Rename failed:', err)
  } finally {
    renaming.value = false
  }
}

// Delete dialog
const deleteDialog = ref(false)
const deleteTarget = ref<DriveFile | null>(null)
const deleting = ref(false)

function openDelete(file: DriveFile) {
  deleteTarget.value = file
  deleteDialog.value = true
}

async function submitDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await files.deleteFile(deleteTarget.value.driveId)
    deleteDialog.value = false
    sync.fetchStatus()
  } catch (err) {
    console.error('Delete failed:', err)
  } finally {
    deleting.value = false
  }
}

// View details dialog
interface FileDetails {
  driveId: string
  name: string
  mimeType: string
  size: number | null
  ownerEmail: string | null
  ownerName: string | null
  createdTime: string | null
  modifiedTime: string | null
  webViewLink: string | null
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

const viewDialog = ref(false)
const viewFile = ref<FileDetails | null>(null)
const viewLoading = ref(false)

async function openView(file: DriveFile) {
  viewDialog.value = true
  viewLoading.value = true
  try {
    const res = await fetch(`/api/files/${file.driveId}`)
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
    viewFile.value = await res.json()
  } catch (err) {
    console.error('View failed:', err)
    viewFile.value = null
  } finally {
    viewLoading.value = false
  }
}

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

      <template #item.actions="{ item }">
        <div class="d-flex">
          <v-btn
            icon="mdi-information-outline"
            variant="text"
            size="small"
            @click="openView(item)"
          />
          <v-btn
            icon="mdi-pencil"
            variant="text"
            size="small"
            @click="openRename(item)"
          />
          <v-btn
            icon="mdi-delete"
            variant="text"
            size="small"
            color="error"
            @click="openDelete(item)"
          />
        </div>
      </template>

      <template #no-data>
        <div class="text-center pa-4 text-medium-emphasis">
          No files found. Try adjusting your filters or sync your Drive files first.
        </div>
      </template>

    </v-data-table-server>

    <!-- Rename dialog -->
    <v-dialog v-model="renameDialog" max-width="400">
      <v-card>
        <v-card-title>Rename file</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="renameName"
            label="File name"
            autofocus
            hide-details
            @keydown.enter="submitRename"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="renameDialog = false">Cancel</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="renaming"
            :disabled="!renameName.trim()"
            @click="submitRename"
          >
            Rename
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete confirmation dialog -->
    <v-dialog v-model="deleteDialog" max-width="400">
      <v-card>
        <v-card-title>Delete file</v-card-title>
        <v-card-text>
          Move <strong>{{ deleteTarget?.name }}</strong> to trash?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog = false">Cancel</v-btn>
          <v-btn
            color="error"
            variant="flat"
            :loading="deleting"
            @click="submitDelete"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- View details dialog -->
    <v-dialog v-model="viewDialog" max-width="480">
      <v-card>
        <v-card-title>File details</v-card-title>
        <v-card-text>
          <v-progress-circular v-if="viewLoading" indeterminate class="d-block mx-auto" />
          <v-table v-else-if="viewFile" density="compact">
            <tbody>
              <tr><td class="font-weight-medium">Name</td><td>{{ viewFile.name }}</td></tr>
              <tr><td class="font-weight-medium">Type</td><td>{{ friendlyMimeType(viewFile.mimeType) }}</td></tr>
              <tr><td class="font-weight-medium">Size</td><td>{{ formatSize(viewFile.size) }}</td></tr>
              <tr><td class="font-weight-medium">Owner</td><td>{{ viewFile.ownerName ?? '—' }}</td></tr>
              <tr><td class="font-weight-medium">Email</td><td>{{ viewFile.ownerEmail ?? '—' }}</td></tr>
              <tr><td class="font-weight-medium">Created</td><td>{{ viewFile.createdTime ? new Date(viewFile.createdTime).toLocaleString() : '—' }}</td></tr>
              <tr><td class="font-weight-medium">Modified</td><td>{{ viewFile.modifiedTime ? new Date(viewFile.modifiedTime).toLocaleString() : '—' }}</td></tr>
              <tr><td class="font-weight-medium">Drive ID</td><td class="text-caption">{{ viewFile.driveId }}</td></tr>
            </tbody>
          </v-table>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            v-if="viewFile?.webViewLink"
            variant="text"
            color="primary"
            :href="viewFile.webViewLink"
            target="_blank"
          >
            Open in Drive
          </v-btn>
          <v-btn variant="text" @click="viewDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
