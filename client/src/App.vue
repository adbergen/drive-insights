<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth'

const auth = useAuthStore()

onMounted(() => {
  auth.checkStatus()
})
</script>

<template>
  <v-app>
    <v-app-bar
      color="primary"
      density="default"
    >
      <v-app-bar-title>Drive Insights</v-app-bar-title>

      <template
        v-if="auth.connected"
        #append
      >
        <v-chip
          variant="outlined"
          class="mr-2"
        >
          <v-icon
            start
            icon="mdi-google"
          />
          {{ auth.email }}
        </v-chip>
        <v-btn
          icon="mdi-logout"
          variant="text"
          size="small"
          @click="auth.disconnectGoogle()"
        />
      </template>
    </v-app-bar>

    <v-main>
      <RouterView />
    </v-main>
  </v-app>
</template>
