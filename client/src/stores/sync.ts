import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useSyncStore = defineStore('sync', () => {
  const syncing = ref(false)
  const fileCount = ref(0)
  const lastSyncedAt = ref<string | null>(null)

  async function fetchStatus() {
    try {
      const res = await fetch('/api/sync/status')
      if (!res.ok) throw new Error(`Sync status failed: ${res.status}`)
      const data = await res.json()
      fileCount.value = data.fileCount ?? 0
      lastSyncedAt.value = data.lastSyncedAt ?? null
    } catch {
      // leave current values
    }
  }

  async function triggerSync() {
    syncing.value = true
    try {
      const res = await fetch('/api/sync', { method: 'POST' })
      if (!res.ok) throw new Error(`Sync failed: ${res.status}`)
      await fetchStatus()
    } catch (err) {
      console.error('Sync failed:', err)
      throw err
    } finally {
      syncing.value = false
    }
  }

  return { syncing, fileCount, lastSyncedAt, fetchStatus, triggerSync }
})
