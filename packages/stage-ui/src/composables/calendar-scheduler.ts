import { nanoid } from 'nanoid'
import { onUnmounted, ref } from 'vue'

import { useCalendarStore } from '../stores/calendar'
import { useChatSessionStore } from '../stores/chat/session-store'

/**
 * Airiの予定実行スケジューラ
 * 60秒ごとにカレンダーの予定をチェックし、実行時間が来たAiriの予定を
 * チャットメッセージとして通知する
 */
export function useCalendarScheduler() {
  const executedToday = ref(new Set<string>())
  let intervalId: ReturnType<typeof setInterval> | null = null

  function checkPendingEvents() {
    try {
      const calendarStore = useCalendarStore()
      const pendingEvents = calendarStore.getPendingAiriEvents()

      for (const event of pendingEvents) {
        // 今日すでに実行通知済みならスキップ
        const todayKey = `${event.id}-${calendarStore.formatDate(new Date())}`
        if (executedToday.value.has(todayKey))
          continue

        executedToday.value.add(todayKey)

        // 非繰り返しイベントは実行済みにマーク
        if (event.recurrence === 'none') {
          calendarStore.markExecuted(event.id)
        }

        // チャットにメッセージを追加
        addScheduleMessage(event.title, event.description, event.startTime)
      }
    }
    catch {
      // store が未初期化の場合は無視
    }
  }

  function addScheduleMessage(title: string, description: string, time: string) {
    try {
      const chatSession = useChatSessionStore()
      const sessionId = chatSession.activeSessionId
      if (!sessionId)
        return

      const text = `📅 予定の時間です！「${title}」(${time})${description ? `\n${description}` : ''}`
      const current = chatSession.getSessionMessages(sessionId)
      chatSession.setSessionMessages(sessionId, [
        ...current,
        {
          role: 'assistant' as const,
          content: text,
          slices: [{ type: 'text' as const, text }],
          tool_results: [],
          createdAt: Date.now(),
          id: nanoid(),
        },
      ])
    }
    catch {
      // ignore
    }
  }

  function start() {
    if (intervalId)
      return
    // 初回チェック
    checkPendingEvents()
    // 60秒ごとにチェック
    intervalId = setInterval(checkPendingEvents, 60_000)
  }

  function stop() {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  // 日付が変わったらリセット
  function resetDaily() {
    executedToday.value.clear()
  }

  onUnmounted(() => stop())

  return {
    start,
    stop,
    resetDaily,
    checkPendingEvents,
  }
}
