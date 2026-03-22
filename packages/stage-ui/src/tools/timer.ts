import { tool } from '@xsai/tool'
import { nanoid } from 'nanoid'
import { reactive } from 'vue'
import { z } from 'zod'

import { useChatSessionStore } from '../stores/chat/session-store'

// アクティブなタイマー/アラームを管理
const activeTimers = new Map<string, { timeout: ReturnType<typeof setTimeout>, label: string, endsAt: number }>()
let timerIdCounter = 0

// 鳴動中のアラーム（UIから停止ボタンを表示するため）
export const ringingAlarms = reactive(new Map<string, { interval: ReturnType<typeof setInterval>, label: string }>())

/**
 * 鳴動中のアラームを停止する
 */
export function stopAlarm(alarmId: string): boolean {
  const ringing = ringingAlarms.get(alarmId)
  if (!ringing)
    return false
  clearInterval(ringing.interval)
  ringingAlarms.delete(alarmId)
  return true
}

/**
 * すべての鳴動中アラームを停止する
 */
export function stopAllAlarms(): number {
  let count = 0
  for (const [id] of ringingAlarms) {
    if (stopAlarm(id))
      count++
  }
  return count
}

/**
 * チャットにアシスタントメッセージを追加する
 */
function addChatMessage(text: string) {
  try {
    const chatSession = useChatSessionStore()
    const sessionId = chatSession.activeSessionId
    if (!sessionId)
      return

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
    // Pinia store が利用不可の場合は無視
  }
}

/**
 * アラーム音を鳴らす（3回ビープ）
 */
function playAlarmSound() {
  try {
    const audioCtx = new AudioContext()
    for (let i = 0; i < 3; i++) {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.frequency.value = 880
      gain.gain.value = 0.3
      const startTime = audioCtx.currentTime + i * 0.3
      osc.start(startTime)
      osc.stop(startTime + 0.15)
    }
  }
  catch {
    // AudioContext が使えない場合は無視
  }
}

/**
 * ブラウザ通知を送信する（許可がなければリクエストする）
 */
async function sendNotification(title: string, body: string) {
  playAlarmSound()

  if (typeof Notification !== 'undefined') {
    if (Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' })
    }
  }
}

/**
 * アラームを鳴動開始（30秒ごとに繰り返す）
 */
function startRinging(id: string, label: string) {
  // 即座に1回鳴らす
  playAlarmSound()

  // 30秒ごとに繰り返し
  const interval = setInterval(() => {
    playAlarmSound()
  }, 30000)

  ringingAlarms.set(id, { interval, label })
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const parts: string[] = []
  if (h > 0)
    parts.push(`${h}時間`)
  if (m > 0)
    parts.push(`${m}分`)
  if (s > 0 || parts.length === 0)
    parts.push(`${s}秒`)
  return parts.join('')
}

const tools = [
  tool({
    name: 'set_timer',
    description: 'Set a countdown timer. When the timer expires, the user will be notified with a sound and browser notification. Use this when the user asks to set a timer, countdown, or wants to be reminded after a certain duration.',
    execute: async ({ hours, minutes, seconds, label }) => {
      const totalMs = ((hours ?? 0) * 3600 + (minutes ?? 0) * 60 + (seconds ?? 0)) * 1000
      if (totalMs <= 0) {
        return 'Error: Timer duration must be greater than 0.'
      }

      const id = `timer-${++timerIdCounter}`
      const timerLabel = label ?? 'タイマー'
      const endsAt = Date.now() + totalMs

      const timeout = setTimeout(async () => {
        activeTimers.delete(id)
        const msg = `⏰ ${timerLabel}の${formatDuration(totalMs / 1000)}が経過しました！`
        await sendNotification(`⏰ ${timerLabel}`, `${formatDuration(totalMs / 1000)} のタイマーが終了しました！`)
        startRinging(id, timerLabel)
        addChatMessage(msg)
      }, totalMs)

      activeTimers.set(id, { timeout, label: timerLabel, endsAt })

      return `✅ ${timerLabel}を設定しました（${formatDuration(totalMs / 1000)}後）。時間になったら音と通知でお知らせします。\nTimer ID: ${id}`
    },
    parameters: z.object({
      hours: z.number().int().min(0).optional().default(0).describe('Hours to count down'),
      minutes: z.number().int().min(0).optional().default(0).describe('Minutes to count down'),
      seconds: z.number().int().min(0).optional().default(0).describe('Seconds to count down'),
      label: z.string().optional().describe('Optional label for the timer (e.g. "pasta", "laundry")'),
    }),
  }),
  tool({
    name: 'set_alarm',
    description: 'Set an alarm for a specific time today (or tomorrow if the time has already passed). The user will be notified with a sound and browser notification when the alarm goes off. Use when the user asks to be woken up or notified at a specific time.',
    execute: async ({ hour, minute, label }) => {
      const now = new Date()
      const alarm = new Date(now)
      alarm.setHours(hour, minute, 0, 0)

      // 指定時刻が過去なら翌日にセット
      if (alarm.getTime() <= now.getTime()) {
        alarm.setDate(alarm.getDate() + 1)
      }

      const totalMs = alarm.getTime() - now.getTime()
      const id = `alarm-${++timerIdCounter}`
      const alarmLabel = label ?? 'アラーム'
      const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

      const timeout = setTimeout(async () => {
        activeTimers.delete(id)
        const msg = `🔔 ${timeStr}になりました！（${alarmLabel}）`
        await sendNotification(`🔔 ${alarmLabel}`, `${timeStr} のアラームです！`)
        startRinging(id, alarmLabel)
        addChatMessage(msg)
      }, totalMs)

      activeTimers.set(id, { timeout, label: alarmLabel, endsAt: alarm.getTime() })

      const isNextDay = alarm.getDate() !== now.getDate()
      return `✅ ${alarmLabel}を${isNextDay ? '明日の' : ''}${timeStr}にセットしました。時間になったら音と通知でお知らせします。\nAlarm ID: ${id}`
    },
    parameters: z.object({
      hour: z.number().int().min(0).max(23).describe('Hour in 24-hour format (0-23)'),
      minute: z.number().int().min(0).max(59).describe('Minute (0-59)'),
      label: z.string().optional().describe('Optional label for the alarm'),
    }),
  }),
  tool({
    name: 'cancel_timer',
    description: 'Cancel an active timer/alarm by its ID, or stop a ringing alarm. Use when user wants to cancel, stop, or silence a timer/alarm. Also use when user says "stop the alarm" or "turn off the alarm".',
    execute: async ({ id }) => {
      // 鳴動中のアラームを停止
      if (ringingAlarms.has(id)) {
        stopAlarm(id)
        return `\u2705 \u30A2\u30E9\u30FC\u30E0\u3092\u505C\u6B62\u3057\u307E\u3057\u305F\u3002(${id})`
      }
      // 待\u6a5f\u4e2d\u306e\u30bf\u30a4\u30de\u30fc\u3092\u30ad\u30e3\u30f3\u30bb\u30eb
      const t = activeTimers.get(id)
      if (!t) {
        return `Timer/alarm "${id}" not found. It may have already expired or been cancelled.`
      }
      clearTimeout(t.timeout)
      activeTimers.delete(id)
      return `\u2705 "${t.label}" (${id}) \u3092\u30AD\u30E3\u30F3\u30BB\u30EB\u3057\u307E\u3057\u305F\u3002`
    },
    parameters: z.object({
      id: z.string().describe('The timer/alarm ID to cancel (e.g. "timer-1" or "alarm-2")'),
    }),
  }),
  tool({
    name: 'stop_alarm',
    description: 'Stop all currently ringing alarms/timers. Use when user says "stop", "\u6B62\u3081\u3066", "\u30A2\u30E9\u30FC\u30E0\u6B62\u3081\u3066", "\u3046\u308B\u3055\u3044", etc.',
    execute: async () => {
      const count = stopAllAlarms()
      if (count === 0) {
        return '\u73FE\u5728\u9CF4\u3063\u3066\u3044\u308B\u30A2\u30E9\u30FC\u30E0\u306F\u3042\u308A\u307E\u305B\u3093\u3002'
      }
      return `\u2705 ${count}\u4EF6\u306E\u30A2\u30E9\u30FC\u30E0\u3092\u505C\u6B62\u3057\u307E\u3057\u305F\u3002`
    },
    parameters: z.object({}),
  }),
  tool({
    name: 'list_timers',
    description: 'List all active timers and alarms. Use when user asks about their current timers or wants to know what is running.',
    execute: async () => {
      if (activeTimers.size === 0 && ringingAlarms.size === 0) {
        return 'アクティブなタイマー・アラームはありません。'
      }
      const now = Date.now()
      const lines: string[] = []
      for (const [id, t] of activeTimers) {
        const remaining = Math.max(0, Math.ceil((t.endsAt - now) / 1000))
        lines.push(`- ${id}: "${t.label}" — 残り ${formatDuration(remaining)}`)
      }
      for (const [id, r] of ringingAlarms) {
        lines.push(`- ${id}: "${r.label}" — 🔔 鳴動中`)
      }
      return `アクティブなタイマー・アラーム:\n${lines.join('\n')}`
    },
    parameters: z.object({}),
  }),
]

export async function timer() {
  return Promise.all(tools)
}
