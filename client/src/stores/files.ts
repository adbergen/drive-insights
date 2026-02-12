import { ref, reactive } from 'vue'
import { defineStore } from 'pinia'

export interface DriveFile {
  id: number
  driveId: string
  name: string
  mimeType: string
  ownerEmail: string | null
  modifiedTime: string | null
  webViewLink: string | null
}

export interface FilesParams {
  page: number
  limit: number
  search: string
  from: string
  to: string
  sortBy: string
  order: 'asc' | 'desc'
}

export const useFilesStore = defineStore('files', () => {
  const files = ref<DriveFile[]>([])
  const total = ref(0)
  const loading = ref(false)

  const params = reactive<FilesParams>({
    page: 1,
    limit: 25,
    search: '',
    from: '',
    to: '',
    sortBy: 'modifiedTime',
    order: 'desc',
  })

  async function fetchFiles() {
    loading.value = true
    try {
      const query = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
        sortBy: params.sortBy,
        order: params.order,
        ...(params.search ? { search: params.search } : {}),
        ...(params.from ? { from: params.from } : {}),
        ...(params.to ? { to: params.to } : {}),
      })

      const res = await fetch(`/api/files?${query}`)
      if (!res.ok) throw new Error(`Files fetch failed: ${res.status}`)

      const data = await res.json()
      files.value = data.files
      total.value = data.total
    } catch (err) {
      console.error('Failed to fetch files:', err)
      files.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  return { files, total, loading, params, fetchFiles }
})
