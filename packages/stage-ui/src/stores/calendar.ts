import { useLocalStorage } from '@vueuse/core'
import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type EventOwner = 'airi' | 'user'

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly'

export interface CalendarEvent {
  id: string
  title: string
  description: string
  owner: EventOwner
  /** ISO date string YYYY-MM-DD */
  date: string
  /** HH:mm format */
  startTime: string
  /** Duration in minutes (optional) */
  duration?: number
  recurrence: RecurrenceType
  /** Whether this event was already executed by Airi */
  executed?: boolean
  createdAt: number
}

export const useCalendarStore = defineStore('calendar', () => {
  const events = useLocalStorage<CalendarEvent[]>('airi-calendar-events', [])
  const showCalendar = ref(false)
  const showAddEvent = ref(false)
  const selectedDate = ref(formatDate(new Date()))

  function formatDate(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  function addEvent(event: Omit<CalendarEvent, 'id' | 'createdAt'>): CalendarEvent {
    const newEvent: CalendarEvent = {
      ...event,
      id: nanoid(),
      createdAt: Date.now(),
    }
    events.value.push(newEvent)
    return newEvent
  }

  function removeEvent(id: string) {
    events.value = events.value.filter(e => e.id !== id)
  }

  function updateEvent(id: string, updates: Partial<Omit<CalendarEvent, 'id' | 'createdAt'>>) {
    const idx = events.value.findIndex(e => e.id === id)
    if (idx !== -1) {
      events.value[idx] = { ...events.value[idx], ...updates }
    }
  }

  function getEventsForDate(date: string): CalendarEvent[] {
    return events.value.filter((e) => {
      if (e.date === date)
        return true
      // 繰り返し予定のチェック
      if (e.recurrence === 'none')
        return false
      const eventDate = new Date(e.date)
      const targetDate = new Date(date)
      if (targetDate < eventDate)
        return false

      if (e.recurrence === 'daily')
        return true
      if (e.recurrence === 'weekly')
        return eventDate.getDay() === targetDate.getDay()
      if (e.recurrence === 'monthly')
        return eventDate.getDate() === targetDate.getDate()
      return false
    })
  }

  const todayEvents = computed(() => getEventsForDate(formatDate(new Date())))

  const selectedDateEvents = computed(() => getEventsForDate(selectedDate.value))

  /**
   * Airiの予定で実行時間が来たものを取得
   */
  function getPendingAiriEvents(): CalendarEvent[] {
    const now = new Date()
    const today = formatDate(now)
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    return getEventsForDate(today).filter((e) => {
      if (e.owner !== 'airi')
        return false
      if (e.startTime > currentTime)
        return false
      // 非繰り返しの場合は実行済みならスキップ
      if (e.recurrence === 'none' && e.executed)
        return false
      return true
    })
  }

  function markExecuted(id: string) {
    updateEvent(id, { executed: true })
  }

  return {
    events,
    showCalendar,
    showAddEvent,
    selectedDate,
    formatDate,
    addEvent,
    removeEvent,
    updateEvent,
    getEventsForDate,
    todayEvents,
    selectedDateEvents,
    getPendingAiriEvents,
    markExecuted,
  }
})
