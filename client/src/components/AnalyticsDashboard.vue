<script setup lang="ts">
import { computed } from 'vue'
import { Doughnut, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js'
import { useAnalyticsStore } from '@/stores/analytics'
import { friendlyMimeType, formatBytes } from '@/utils/formatters'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const analytics = useAnalyticsStore()

const COLORS = [
  '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#E53935', '#00ACC1',
]

const typeChartData = computed(() => {
  const types = analytics.data?.topTypes ?? []
  return {
    labels: types.map((t) => friendlyMimeType(t.type)),
    datasets: [
      {
        data: types.map((t) => t.count),
        backgroundColor: COLORS.slice(0, types.length),
      },
    ],
  }
})

const ownerChartData = computed(() => {
  const owners = analytics.data?.topOwners ?? []
  return {
    labels: owners.map((o) => o.owner),
    datasets: [
      {
        label: 'Files',
        data: owners.map((o) => o.count),
        backgroundColor: COLORS[0],
      },
    ],
  }
})

const activityChartData = computed(() => {
  const months = analytics.data?.activityByMonth ?? []
  return {
    labels: months.map((m) => m.month),
    datasets: [
      {
        label: 'Files modified',
        data: months.map((m) => m.count),
        backgroundColor: COLORS[0],
      },
    ],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
} as const

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 12 } } },
} as const

const ownerOptions = {
  ...chartOptions,
  indexAxis: 'y' as const,
} as const

</script>

<template>
  <v-card
    v-if="analytics.data"
    class="mb-5"
    rounded="lg"
  >
    <v-card-title class="text-subtitle-1 font-weight-medium">
      <v-icon
        start
        size="small"
      >mdi-chart-box</v-icon>
      Drive Analytics
    </v-card-title>

    <v-card-text class="pt-0">
      <v-row dense>
        <v-col cols="4">
          <v-card
            variant="tonal"
            color="primary"
            rounded="lg"
          >
            <v-card-text class="text-center pa-2">
              <div class="text-h6 font-weight-bold">{{ analytics.data.totalFiles.toLocaleString() }}</div>
              <div class="text-caption text-medium-emphasis">Files</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="4">
          <v-card
            variant="tonal"
            color="success"
            rounded="lg"
          >
            <v-card-text class="text-center pa-2">
              <div class="text-h6 font-weight-bold">{{ formatBytes(analytics.data.totalSize) }}</div>
              <div class="text-caption text-medium-emphasis">Storage</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="4">
          <v-card
            variant="tonal"
            color="warning"
            rounded="lg"
          >
            <v-card-text class="text-center pa-2">
              <div class="text-h6 font-weight-bold">{{ analytics.data.uniqueOwners }}</div>
              <div class="text-caption text-medium-emphasis">Owners</div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <div class="mt-4">
        <div class="text-subtitle-2 mb-1">File Types</div>
        <div style="height: 180px">
          <Doughnut
            v-if="analytics.data.topTypes.length"
            :data="typeChartData"
            :options="doughnutOptions"
          />
          <div
            v-else
            class="d-flex align-center justify-center text-medium-emphasis"
            style="height: 100%"
          >No data</div>
        </div>
      </div>

      <div class="mt-4">
        <div class="text-subtitle-2 mb-1">Top Owners</div>
        <div style="height: 160px">
          <Bar
            v-if="analytics.data.topOwners.length"
            :data="ownerChartData"
            :options="ownerOptions"
          />
          <div
            v-else
            class="d-flex align-center justify-center text-medium-emphasis"
            style="height: 100%"
          >No data</div>
        </div>
      </div>

      <div class="mt-4">
        <div class="text-subtitle-2 mb-1">Monthly Activity</div>
        <div style="height: 160px">
          <Bar
            v-if="analytics.data.activityByMonth.length"
            :data="activityChartData"
            :options="chartOptions"
          />
          <div
            v-else
            class="d-flex align-center justify-center text-medium-emphasis"
            style="height: 100%"
          >No data</div>
        </div>
      </div>
    </v-card-text>
  </v-card>

  <v-card
    v-else-if="analytics.loading"
    class="mb-5"
    rounded="lg"
  >
    <v-card-text>
      <v-skeleton-loader type="heading, image" />
    </v-card-text>
  </v-card>
</template>
