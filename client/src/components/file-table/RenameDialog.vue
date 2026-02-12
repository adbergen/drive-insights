<script setup lang="ts">
import { ref, watch } from 'vue'
import { useFilesStore, type DriveFile } from '@/stores/files'

const files = useFilesStore()

const open = defineModel<boolean>({ required: true })
const props = defineProps<{ file: DriveFile | null }>()

const name = ref('')
const loading = ref(false)

watch(() => props.file, (f) => {
  if (f) name.value = f.name
})

async function submit() {
  if (!props.file || !name.value.trim()) return
  loading.value = true
  try {
    await files.renameFile(props.file.driveId, name.value.trim())
    open.value = false
  } catch (err) {
    console.error('Rename failed:', err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="400">
    <v-card>
      <v-card-title>Rename file</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="name"
          label="File name"
          autofocus
          hide-details
          @keydown.enter="submit"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="loading"
          :disabled="!name.trim()"
          @click="submit"
        >
          Rename
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
