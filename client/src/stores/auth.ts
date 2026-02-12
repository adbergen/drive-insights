import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', () => {
  const connected = ref(false)
  const email = ref<string | null>(null)
  const loading = ref(true)

  async function checkStatus() {
    loading.value = true
    try {
      const res = await fetch('/api/auth/status')

      if (!res.ok) throw new Error(`Auth status failed: ${res.status}`)

      const data = await res.json()
      connected.value = data.connected
      email.value = data.email ?? null
    } catch {
      connected.value = false
      email.value = null
    } finally {
      loading.value = false
    }
  }

  function connectGoogle() {
    window.location.href = '/api/auth/google'
  }

  async function disconnectGoogle() {
    try {
      await fetch('/api/auth/disconnect', { method: 'DELETE' })
    } catch {
      // proceed with local reset even if server call fails
    }
    connected.value = false
    email.value = null
  }

  function handleUnauthorized() {
    connected.value = false
    email.value = null
  }

  return { connected, email, loading, checkStatus, connectGoogle, disconnectGoogle, handleUnauthorized }
})
