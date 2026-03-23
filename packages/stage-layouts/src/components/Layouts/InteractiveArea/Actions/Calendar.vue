<script setup lang="ts">
import { AddEventDialog, CalendarContent, CalendarDialog } from '@proj-airi/stage-ui/components'
import { useCalendarScheduler } from '@proj-airi/stage-ui/composables/calendar-scheduler'
import { useCalendarStore } from '@proj-airi/stage-ui/stores/calendar'
import { storeToRefs } from 'pinia'
import { onMounted } from 'vue'

const calendarStore = useCalendarStore()
const { showCalendar } = storeToRefs(calendarStore)

// Airiの予定実行スケジューラを起動
const scheduler = useCalendarScheduler()
onMounted(() => scheduler.start())
</script>

<template>
  <button
    border="2 solid neutral-100/60 dark:neutral-800/30"
    bg="neutral-50/70 dark:neutral-800/70"
    :class="['w-fit flex items-center self-end justify-center rounded-xl p-2 backdrop-blur-md']"
    title="Calendar"
    @click="showCalendar = !showCalendar"
  >
    <div i-solar:calendar-bold-duotone size-5 text="neutral-500 dark:neutral-400" />
  </button>
  <CalendarDialog v-model="showCalendar">
    <CalendarContent />
  </CalendarDialog>
  <AddEventDialog />
</template>
