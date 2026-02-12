<script setup lang="ts">
import { ref } from 'vue'
import { useFilesStore, type DriveFile } from '@/stores/files'
import { useSyncStore } from '@/stores/sync'

const files = useFilesStore()
const sync = useSyncStore()

const open = defineModel<boolean>({ required: true })
const props = defineProps<{ file: DriveFile | null }>()

const loading = ref(false)

async function submit() {
  if (!props.file) return
  loading.value = true
  try {
    await files.deleteFile(props.file.driveId)
    open.value = false
    sync.fetchStatus()
  } catch (err) {
    console.error('Delete failed:', err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="400">
    <v-card>
      <v-card-title>Delete file</v-card-title>
      <v-card-text>
        Move <strong>{{ file?.name }}</strong> to trash?
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn
          color="error"
          variant="flat"
          :loading="loading"
          @click="submit"
        >
          Delete
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
