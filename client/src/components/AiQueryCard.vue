<script setup lang="ts">
import { ref } from 'vue'
import { formatDate, friendlyMimeType } from '@/utils/formatters'

interface AiFile {
  driveId: string
  name: string
  mimeType: string
  ownerEmail: string | null
  modifiedTime: string | null
  webViewLink: string | null
}

const aiQuery = ref('')
const aiLoading = ref(false)
const aiAnswer = ref('')
const aiFiles = ref<AiFile[]>([])

const suggestions = [
  'Who owns the most files?',
  'Which file was modified most recently?',
  'What is the average number of files per owner?',
  'Which file is the largest?',
  'What is the distribution of files by their last modified date?',
]

async function submitAiQuery() {
  if (!aiQuery.value.trim()) return
  aiLoading.value = true
  aiAnswer.value = ''
  aiFiles.value = []
  try {
    const res = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: aiQuery.value.trim() }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(body?.error ?? `Query failed: ${res.status}`)
    }
    const data = await res.json()
    aiAnswer.value = data.answer
    aiFiles.value = data.files ?? []
  } catch (err) {
    console.error('AI query failed:', err)
    aiAnswer.value = 'Failed to process your question. Please try again.'
  } finally {
    aiLoading.value = false
  }
}

function askSuggestion(question: string) {
  aiQuery.value = question
  submitAiQuery()
}

function clearAiResults() {
  aiQuery.value = ''
  aiAnswer.value = ''
  aiFiles.value = []
}
</script>

<template>
  <div class="mb-5">
    <v-text-field
      v-model="aiQuery"
      placeholder="Ask about your files..."
      prepend-inner-icon="mdi-creation"
      append-inner-icon="mdi-arrow-right-circle"
      variant="solo"
      rounded="pill"
      density="comfortable"
      clearable
      hide-details
      :loading="aiLoading"
      @keydown.enter="submitAiQuery"
      @click:append-inner="submitAiQuery"
      @click:clear="clearAiResults"
    />

    <v-card
      v-if="aiAnswer"
      variant="tonal"
      class="mt-3"
      rounded="lg"
    >
      <v-card-text>
        <div class="text-body-1 mb-3">{{ aiAnswer }}</div>

        <v-list
          v-if="aiFiles.length"
          density="compact"
          class="pa-0 bg-transparent"
        >
          <v-list-item
            v-for="file in aiFiles"
            :key="file.driveId"
          >
            <template #title>
              <a
                v-if="file.webViewLink"
                :href="file.webViewLink"
                target="_blank"
                rel="noopener"
                class="text-decoration-none"
              >{{ file.name }}</a>
              <span v-else>{{ file.name }}</span>
            </template>
            <template #subtitle>
              {{ friendlyMimeType(file.mimeType) }}
              <span v-if="file.ownerEmail"> &middot; {{ file.ownerEmail }}</span>
              <span v-if="file.modifiedTime"> &middot; {{ formatDate(file.modifiedTime) }}</span>
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>

    <div class="d-flex flex-wrap ga-2 mt-3 ml-2">
      <v-chip
        v-for="suggestion in suggestions"
        :key="suggestion"
        size="small"
        variant="outlined"
        prepend-icon="mdi-creation"
        @click="askSuggestion(suggestion)"
      >
        {{ suggestion }}
      </v-chip>
    </div>
  </div>
</template>
