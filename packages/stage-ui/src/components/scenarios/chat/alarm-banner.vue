<script setup lang="ts">
import { computed } from 'vue'

import { ringingAlarms, stopAlarm, stopAllAlarms } from '../../../tools/timer'

const alarms = computed(() => Array.from(ringingAlarms.entries()))
const hasRinging = computed(() => alarms.value.length > 0)
</script>

<template>
  <div v-if="hasRinging" :class="['mx-2 mb-2 rounded-xl border-2 border-red-300 bg-red-50/90 p-3 shadow-lg dark:border-red-800 dark:bg-red-950/90']">
    <div :class="['flex items-center gap-2 text-red-600 dark:text-red-400']">
      <div i-solar:bell-bing-bold-duotone :class="['size-5 animate-bounce']" />
      <span :class="['text-sm font-bold']">アラーム鳴動中</span>
    </div>
    <div :class="['mt-2 flex flex-wrap gap-2']">
      <button
        v-for="[id, alarm] in alarms"
        :key="id"
        type="button"
        :class="['rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700 font-medium shadow-sm transition hover:bg-red-100 dark:border-red-700 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-800/50']"
        @click="stopAlarm(id)"
      >
        {{ alarm.label }} を止める
      </button>
      <button
        v-if="alarms.length > 1"
        type="button"
        :class="['rounded-lg border border-red-400 bg-red-600 px-3 py-1.5 text-sm text-white font-medium shadow-sm transition hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600']"
        @click="stopAllAlarms()"
      >
        すべて止める
      </button>
    </div>
  </div>
</template>
