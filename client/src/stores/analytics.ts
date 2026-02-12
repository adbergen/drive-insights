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

function dataFingerprint(d: AnalyticsData): string {
  const last = d.activityByMonth[d.activityByMonth.length - 1]
  const lastMonth = last?.month ?? ''
  return `${d.totalFiles}:${d.totalSize}:${d.uniqueOwners}:${lastMonth}`
}

export const useAnalyticsStore = defineStore('analytics', () => {
  const auth = useAuthStore()
  const data = ref<AnalyticsData | null>(null)
  const loading = ref(false)
  const insights = ref<string[]>([])
  const insightsLoading = ref(false)
  const insightsKey = ref('')

  async function fetchAnalytics() {
    loading.value = true
    try {
      const res = await fetch('/api/analytics')
      if (res.status === 401) { auth.handleUnauthorized(); data.value = null; return }
      if (!res.ok) throw new Error(`Analytics fetch failed: ${res.status}`)
      const next = await res.json()
      const nextKey = dataFingerprint(next)
      if (nextKey !== insightsKey.value) {
        insights.value = []
        insightsKey.value = ''
      }
      data.value = next
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
      data.value = null
    } finally {
      loading.value = false
    }
  }

  async function fetchInsights() {
    if (!data.value) return

    // Skip if analytics data hasn't changed
    const key = dataFingerprint(data.value)
    if (key === insightsKey.value && insights.value.length > 0) return

    insightsLoading.value = true
    try {
      const res = await fetch('/api/analytics/insights')
      if (res.status === 401) { auth.handleUnauthorized(); return }
      if (!res.ok) throw new Error(`Insights fetch failed: ${res.status}`)
      const json = await res.json()
      insights.value = json.insights ?? []
      insightsKey.value = key
    } catch (err) {
      console.error('Failed to fetch insights:', err)
    } finally {
      insightsLoading.value = false
    }
  }

  return { data, loading, insights, insightsLoading, fetchAnalytics, fetchInsights }
})
