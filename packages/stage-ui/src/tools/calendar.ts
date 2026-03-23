import { tool } from '@xsai/tool'
import { z } from 'zod'

import { useCalendarStore } from '../stores/calendar'

/**
 * カレンダー関連のAIツール
 * イベントの追加・一覧・削除・表示をチャットから実行できる
 */
export async function calendar() {
  return [
    tool({
      name: 'open_calendar',
      description: 'Open the calendar UI dialog. Use this when the user asks to open, show, or view the calendar. Examples: "カレンダーを開いて", "カレンダー見せて", "予定を見たい", "show calendar", "open calendar".',
      execute: async () => {
        const store = useCalendarStore()
        store.showCalendar = true
        return '📅 カレンダーを開きました！'
      },
      parameters: z.object({}),
    }),
    tool({
      name: 'add_calendar_event',
      description: 'Add an event to the calendar. Use this when the user asks to schedule something, add a reminder, or plan an activity. Airi events will be auto-executed at the scheduled time. User events are just reminders.',
      execute: async ({ title, description, date, startTime, owner, recurrence }) => {
        const store = useCalendarStore()
        const event = store.addEvent({
          title,
          description: description ?? '',
          date,
          startTime,
          owner: owner ?? 'user',
          recurrence: recurrence ?? 'none',
        })

        const recurrenceLabel = recurrence && recurrence !== 'none'
          ? ` (${recurrence === 'daily' ? '毎日' : recurrence === 'weekly' ? '毎週' : '毎月'}繰り返し)`
          : ''
        const ownerLabel = event.owner === 'airi' ? 'Airiの予定' : 'あなたの予定'

        return `📅 カレンダーに追加しました！\nタイトル: ${event.title}\n日付: ${event.date}\n時間: ${event.startTime}\n種類: ${ownerLabel}${recurrenceLabel}\nID: ${event.id}`
      },
      parameters: z.object({
        title: z.string().describe('Title of the event'),
        description: z.string().optional().describe('Description or details of the event'),
        date: z.string().describe('Date in YYYY-MM-DD format'),
        startTime: z.string().describe('Start time in HH:mm format (24-hour)'),
        owner: z.enum(['airi', 'user']).optional().default('user').describe('Who owns this event: "airi" for events Airi should execute, "user" for user reminders'),
        recurrence: z.enum(['none', 'daily', 'weekly', 'monthly']).optional().default('none').describe('Recurrence pattern'),
      }),
    }),
    tool({
      name: 'list_calendar_events',
      description: 'List calendar events for a specific date, or all events if no date is given. Use when the user asks about their schedule, upcoming events, or what\'s planned.',
      execute: async ({ date }) => {
        const store = useCalendarStore()

        if (date) {
          const evts = store.getEventsForDate(date)
          if (evts.length === 0) {
            return `📅 ${date} には予定がありません。`
          }
          const list = evts.map((e) => {
            const ownerTag = e.owner === 'airi' ? '🎀' : '👤'
            const recTag = e.recurrence !== 'none' ? ` [${e.recurrence}]` : ''
            return `${ownerTag} ${e.startTime} - ${e.title}${recTag} (ID: ${e.id})`
          }).join('\n')
          return `📅 ${date} の予定:\n${list}`
        }

        const allEvents = store.events
        if (allEvents.length === 0) {
          return '📅 カレンダーに予定がありません。'
        }
        const list = allEvents.map((e) => {
          const ownerTag = e.owner === 'airi' ? '🎀' : '👤'
          const recTag = e.recurrence !== 'none' ? ` [${e.recurrence}]` : ''
          return `${ownerTag} ${e.date} ${e.startTime} - ${e.title}${recTag} (ID: ${e.id})`
        }).join('\n')
        return `📅 すべての予定:\n${list}`
      },
      parameters: z.object({
        date: z.string().optional().describe('Date in YYYY-MM-DD format to filter events. Leave empty for all events.'),
      }),
    }),
    tool({
      name: 'remove_calendar_event',
      description: 'Remove/delete a calendar event by its ID. Use when the user wants to cancel or delete a scheduled event.',
      execute: async ({ id }) => {
        const store = useCalendarStore()
        const event = store.events.find(e => e.id === id)
        if (!event) {
          return `❌ ID: ${id} の予定が見つかりませんでした。`
        }
        const title = event.title
        store.removeEvent(id)
        return `🗑️ 「${title}」を削除しました。`
      },
      parameters: z.object({
        id: z.string().describe('The ID of the calendar event to remove'),
      }),
    }),
  ]
}
