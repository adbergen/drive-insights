<script setup lang="ts">
import { ref, watch } from 'vue'
import type { DriveFile } from '@/stores/files'
import { friendlyMimeType } from '@/utils/formatters'

const open = defineModel<boolean>({ required: true })
const props = defineProps<{ file: DriveFile | null }>()

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

const details = ref<FileDetails | null>(null)
const loading = ref(false)

watch(() => props.file, async (f) => {
  if (!f) return
  details.value = null
  loading.value = true
  try {
    const res = await fetch(`/api/files/${f.driveId}`)
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
    details.value = await res.json()
  } catch (err) {
    console.error('View failed:', err)
    details.value = null
  } finally {
    loading.value = false
  }
})

function formatSize(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

</script>

<template>
  <v-dialog
    v-model="open"
    max-width="480"
  >
    <v-card>
      <v-card-title>File details</v-card-title>
      <v-card-text>
        <v-progress-circular
          v-if="loading"
          indeterminate
          class="d-block mx-auto"
        />
        <v-table
          v-else-if="details"
          density="compact"
        >
          <tbody>
            <tr>
              <td class="font-weight-medium">Name</td>
              <td>{{ details.name }}</td>
            </tr>
            <tr>
              <td class="font-weight-medium">Type</td>
              <td>{{ friendlyMimeType(details.mimeType) }}</td>
            </tr>
            <tr>
              <td class="font-weight-medium">Size</td>
              <td>{{ formatSize(details.size) }}</td>
            </tr>
            <tr>
              <td class="font-weight-medium">Owner</td>
              <td>{{ details.ownerName ?? '—' }}</td>
            </tr>
            <tr>
              <td class="font-weight-medium">Email</td>
              <td>{{ details.ownerEmail ?? '—' }}</td>
            </tr>
            <tr>
              <td class="font-weight-medium">Created</td>
              <td>{{ details.createdTime ? new Date(details.createdTime).toLocaleString() : '—' }}</td>
            </tr>
            <tr>
              <td class="font-weight-medium">Modified</td>
              <td>{{ details.modifiedTime ? new Date(details.modifiedTime).toLocaleString() : '—' }}</td>
            </tr>
            <tr>
              <td class="font-weight-medium">Drive ID</td>
              <td class="text-caption">{{ details.driveId }}</td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn
          v-if="details?.webViewLink"
          variant="text"
          color="primary"
          :href="details.webViewLink"
          target="_blank"
        >
          Open in Drive
        </v-btn>
        <v-btn
          variant="text"
          @click="open = false"
        >Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
