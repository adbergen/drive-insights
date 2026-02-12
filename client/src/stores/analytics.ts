import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from './auth'

export interface AnalyticsData {
  totalFiles: number
  totalSize: number
  uniqueOwners: number
  topTypes: { type: string; count: number }[]
  topOwners: { owner: string; count: number }[]
  storageByType: { type: string; bytes: number }[]
  activityByMonth: { month: string; count: number }[]
}

export const useAnalyticsStore = defineStore('analytics', () => {
  const auth = useAuthStore()
  const data = ref<AnalyticsData | null>(null)
  const loading = ref(false)

  async function fetchAnalytics() {
    loading.value = true
    try {
      const res = await fetch('/api/analytics')
      if (res.status === 401) { auth.handleUnauthorized(); data.value = null; return }
      if (!res.ok) throw new Error(`Analytics fetch failed: ${res.status}`)
      data.value = await res.json()
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
      data.value = null
    } finally {
      loading.value = false
    }
  }

  return { data, loading, fetchAnalytics }
})
