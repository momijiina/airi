<script setup lang="ts">
import type { CalendarEvent } from '../../../stores/calendar'

import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

import { useCalendarStore } from '../../../stores/calendar'

const calendarStore = useCalendarStore()
const { selectedDate, selectedDateEvents, showAddEvent, showCalendar } = storeToRefs(calendarStore)

const now = new Date()
const currentYear = ref(now.getFullYear())
const currentMonth = ref(now.getMonth())

const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const weekDays = ['日', '月', '火', '水', '木', '金', '土']

const daysInMonth = computed(() => {
  return new Date(currentYear.value, currentMonth.value + 1, 0).getDate()
})

const firstDayOfWeek = computed(() => {
  return new Date(currentYear.value, currentMonth.value, 1).getDay()
})

const calendarDays = computed(() => {
  const days: { day: number, date: string, isToday: boolean, hasEvents: boolean, hasAiriEvents: boolean }[] = []
  const today = calendarStore.formatDate(new Date())

  for (let i = 1; i <= daysInMonth.value; i++) {
    const date = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    const events = calendarStore.getEventsForDate(date)
    days.push({
      day: i,
      date,
      isToday: date === today,
      hasEvents: events.length > 0,
      hasAiriEvents: events.some(e => e.owner === 'airi'),
    })
  }
  return days
})

function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  }
  else {
    currentMonth.value--
  }
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  }
  else {
    currentMonth.value++
  }
}

function selectDate(date: string) {
  selectedDate.value = date
}

function openAddEvent() {
  showAddEvent.value = true
}

function removeEvent(event: CalendarEvent) {
  calendarStore.removeEvent(event.id)
}

function ownerLabel(owner: string): string {
  return owner === 'airi' ? 'Airi' : 'あなた'
}

function recurrenceLabel(r: string): string {
  if (r === 'daily')
    return '毎日'
  if (r === 'weekly')
    return '毎週'
  if (r === 'monthly')
    return '毎月'
  return ''
}
</script>

<template>
  <div :class="['flex h-full flex-col overflow-y-auto']">
    <!-- Header -->
    <div :class="['flex items-center justify-between border-b border-primary-200/50 px-5 py-4 dark:border-primary-800/30']">
      <div :class="['flex items-center gap-2']">
        <div i-solar:calendar-bold-duotone :class="['size-6 text-primary-500']" />
        <h2 :class="['text-lg text-primary-800 font-bold dark:text-primary-200']">
          カレンダー
        </h2>
      </div>
      <button type="button" :class="['rounded-lg p-1.5 transition hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50']" @click="showCalendar = false">
        <div i-solar:close-circle-bold-duotone :class="['size-5 text-neutral-400']" />
      </button>
    </div>

    <div :class="['flex flex-1 flex-col overflow-y-auto p-4 gap-4 md:flex-row']">
      <!-- Calendar Grid -->
      <div :class="['flex-1']">
        <!-- Month Navigation -->
        <div :class="['mb-3 flex items-center justify-between']">
          <button type="button" :class="['rounded-lg p-1.5 transition hover:bg-primary-100/50 dark:hover:bg-primary-900/30']" @click="prevMonth">
            <div i-solar:alt-arrow-left-bold :class="['size-5 text-primary-600 dark:text-primary-400']" />
          </button>
          <span :class="['text-sm text-primary-700 font-semibold dark:text-primary-300']">
            {{ currentYear }}年 {{ monthNames[currentMonth] }}
          </span>
          <button type="button" :class="['rounded-lg p-1.5 transition hover:bg-primary-100/50 dark:hover:bg-primary-900/30']" @click="nextMonth">
            <div i-solar:alt-arrow-right-bold :class="['size-5 text-primary-600 dark:text-primary-400']" />
          </button>
        </div>

        <!-- Week day headers -->
        <div :class="['mb-1 grid grid-cols-7 gap-1']">
          <div
            v-for="day in weekDays"
            :key="day"
            :class="['py-1 text-center text-xs text-primary-500/70 font-medium dark:text-primary-400/60']"
          >
            {{ day }}
          </div>
        </div>

        <!-- Days grid -->
        <div :class="['grid grid-cols-7 gap-1']">
          <!-- Empty cells for offset -->
          <div v-for="i in firstDayOfWeek" :key="`empty-${i}`" />
          <!-- Day cells -->
          <button
            v-for="d in calendarDays"
            :key="d.date"
            type="button"
            :class="[
              'relative rounded-lg p-1.5 text-center text-sm transition',
              d.date === selectedDate
                ? 'bg-primary-500 text-white font-bold shadow-sm'
                : d.isToday
                  ? 'bg-primary-100 text-primary-700 font-semibold dark:bg-primary-900/40 dark:text-primary-300'
                  : 'text-neutral-700 hover:bg-primary-50 dark:text-neutral-300 dark:hover:bg-primary-900/20',
            ]"
            @click="selectDate(d.date)"
          >
            {{ d.day }}
            <!-- Event indicators -->
            <div v-if="d.hasEvents" :class="['absolute bottom-0.5 left-1/2 flex gap-0.5 -translate-x-1/2']">
              <div :class="['size-1 rounded-full', d.hasAiriEvents ? 'bg-pink-400' : 'bg-primary-400', d.date === selectedDate ? 'bg-white/80' : '']" />
            </div>
          </button>
        </div>
      </div>

      <!-- Event List for selected date -->
      <div :class="['flex flex-col md:w-64']">
        <div :class="['mb-2 flex items-center justify-between']">
          <h3 :class="['text-sm text-primary-700 font-semibold dark:text-primary-300']">
            {{ selectedDate }} の予定
          </h3>
          <button
            type="button"
            :class="['rounded-lg bg-primary-500/90 px-2.5 py-1 text-xs text-white font-medium shadow-sm transition hover:bg-primary-600']"
            @click="openAddEvent"
          >
            + 追加
          </button>
        </div>

        <div v-if="selectedDateEvents.length === 0" :class="['flex flex-1 flex-col items-center justify-center py-8 text-center']">
          <div i-solar:calendar-mark-bold-duotone :class="['mb-2 size-10 text-primary-300/50 dark:text-primary-600/50']" />
          <p :class="['text-sm text-neutral-400 dark:text-neutral-500']">
            予定はありません
          </p>
        </div>

        <div v-else :class="['flex flex-col gap-2 overflow-y-auto']">
          <div
            v-for="event in selectedDateEvents"
            :key="event.id"
            :class="[
              'rounded-lg border p-2.5',
              event.owner === 'airi'
                ? 'border-pink-200/60 bg-pink-50/60 dark:border-pink-800/30 dark:bg-pink-950/30'
                : 'border-primary-200/60 bg-primary-50/60 dark:border-primary-800/30 dark:bg-primary-950/30',
            ]"
          >
            <div :class="['flex items-start justify-between']">
              <div :class="['flex items-center gap-1.5']">
                <div
                  :class="[
                    'size-1.5 rounded-full',
                    event.owner === 'airi' ? 'bg-pink-400' : 'bg-primary-400',
                  ]"
                />
                <span :class="['text-xs text-neutral-500 dark:text-neutral-400']">
                  {{ ownerLabel(event.owner) }} · {{ event.startTime }}
                </span>
                <span v-if="event.recurrence !== 'none'" :class="['rounded bg-primary-100 px-1 text-[10px] text-primary-600 dark:bg-primary-800/50 dark:text-primary-300']">
                  {{ recurrenceLabel(event.recurrence) }}
                </span>
              </div>
              <button type="button" :class="['rounded p-0.5 transition hover:bg-red-100 dark:hover:bg-red-900/30']" @click="removeEvent(event)">
                <div i-solar:trash-bin-minimalistic-bold :class="['size-3.5 text-neutral-400 hover:text-red-500']" />
              </button>
            </div>
            <p :class="['mt-1 text-sm text-neutral-700 font-medium dark:text-neutral-200']">
              {{ event.title }}
            </p>
            <p v-if="event.description" :class="['mt-0.5 text-xs text-neutral-500 dark:text-neutral-400']">
              {{ event.description }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
