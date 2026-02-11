<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <v-container
    class="d-flex align-center justify-center"
    style="min-height: 60vh"
  >
    <!-- Loading state -->
    <v-card
      v-if="auth.loading"
      flat
    >
      <v-progress-circular
        indeterminate
        color="primary"
      />
    </v-card>

    <!-- Connect with Google card -->
    <v-card
      v-else-if="!auth.connected"
      max-width="480"
      class="pa-8 text-center"
      elevation="2"
    >
      <v-icon
        size="64"
        color="primary"
        class="mb-4"
      >mdi-google-drive</v-icon>
      <v-card-title class="text-h5 mb-2">Connect Google Drive</v-card-title>
      <v-card-text class="text-body-1 mb-4">
        Connect your Google Drive account to sync file metadata and explore insights.
      </v-card-text>
      <v-btn
        color="primary"
        size="large"
        prepend-icon="mdi-google"
        @click="auth.connectGoogle()"
      >
        Connect with Google
      </v-btn>
    </v-card>

    <!-- Connected card -->
    <v-card
      v-else
      max-width="480"
      class="pa-8 text-center"
      elevation="2"
    >
      <v-icon
        size="64"
        color="success"
        class="mb-4"
      >mdi-check-circle</v-icon>
      <v-card-title class="text-h5 mb-2">Connected</v-card-title>
      <v-card-text class="text-body-1 mb-4">
        Signed in as <strong>{{ auth.email }}</strong>
      </v-card-text>
      <v-btn
        variant="outlined"
        color="error"
        prepend-icon="mdi-link-off"
        @click="auth.disconnectGoogle()"
      >
        Disconnect
      </v-btn>
    </v-card>
  </v-container>
</template>
