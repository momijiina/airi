import type { ChatProvider } from '@xsai/providers'

import { nanoid } from 'nanoid'
import { onUnmounted, ref } from 'vue'

import { useCalendarStore } from '../stores/calendar'
import { useChatOrchestratorStore } from '../stores/chat'
import { useChatSessionStore } from '../stores/chat/session-store'
import { useConsciousnessStore } from '../stores/modules/consciousness'
import { useProvidersStore } from '../stores/providers'

/**
 * Airiの予定実行スケジューラ
 * 60秒ごとにカレンダーの予定をチェックし、実行時間が来たAiriの予定を
 * AIに実行させる（userメッセージとして送信）か、通知する
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

        // Airiの予定はAIに実行させる
        if (event.owner === 'airi') {
          executeAiriEvent(event.title, event.description, event.startTime)
        }
        else {
          addNotificationMessage(event.title, event.description, event.startTime)
        }
      }
    }
    catch {
      // store が未初期化の場合は無視
    }
  }

  /**
   * Airiの予定をAIに実行させるためにuserメッセージとして送信
   */
  async function executeAiriEvent(title: string, description: string, time: string) {
    try {
      const consciousness = useConsciousnessStore()
      const providersStore = useProvidersStore()
      const chatOrchestrator = useChatOrchestratorStore()

      const providerId = consciousness.activeProvider
      const model = consciousness.activeModel
      if (!providerId || !model)
        return

      const chatProvider = await providersStore.getProviderInstance<ChatProvider>(providerId)
      const providerConfig = providersStore.getProviderConfig(providerId)

      // AIに予定の内容を実行させるプロンプトを送信
      const prompt = description
        ? `[カレンダー予定] ${time}の予定「${title}」を実行してください: ${description}`
        : `[カレンダー予定] ${time}の予定「${title}」を実行してください`

      await chatOrchestrator.ingest(prompt, {
        chatProvider,
        model,
        providerConfig,
      })
    }
    catch {
      // フォールバック: AIに送信できない場合は通知だけ
      addNotificationMessage(title, description, time)
    }
  }

  /**
   * チャットに通知メッセージを追加（ユーザー予定など）
   */
  function addNotificationMessage(title: string, description: string, time: string) {
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
