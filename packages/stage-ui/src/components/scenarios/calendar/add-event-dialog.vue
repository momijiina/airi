<script setup lang="ts">
import type { EventOwner, RecurrenceType } from '../../../stores/calendar'

import { useMediaQuery, useResizeObserver, useScreenSafeArea } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot } from 'reka-ui'
import { DrawerContent, DrawerHandle, DrawerOverlay, DrawerPortal, DrawerRoot } from 'vaul-vue'
import { onMounted, ref } from 'vue'

import { useCalendarStore } from '../../../stores/calendar'

const calendarStore = useCalendarStore()
const { selectedDate, showAddEvent } = storeToRefs(calendarStore)

const isDesktop = useMediaQuery('(min-width: 768px)')
const screenSafeArea = useScreenSafeArea()

useResizeObserver(document.documentElement, () => screenSafeArea.update())
onMounted(() => screenSafeArea.update())

const title = ref('')
const description = ref('')
const owner = ref<EventOwner>('user')
const startTime = ref('09:00')
const recurrence = ref<RecurrenceType>('none')

function resetForm() {
  title.value = ''
  description.value = ''
  owner.value = 'user'
  startTime.value = '09:00'
  recurrence.value = 'none'
}

function handleSubmit() {
  if (!title.value.trim())
    return

  calendarStore.addEvent({
    title: title.value.trim(),
    description: description.value.trim(),
    owner: owner.value,
    date: selectedDate.value,
    startTime: startTime.value,
    recurrence: recurrence.value,
  })

  resetForm()
  showAddEvent.value = false
}

function handleClose() {
  resetForm()
  showAddEvent.value = false
}
</script>

<template>
  <!-- Desktop dialog -->
  <DialogRoot v-if="isDesktop" :open="showAddEvent" @update:open="v => { if (!v) handleClose() }">
    <DialogPortal>
      <DialogOverlay :class="['fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm', 'data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn']" />
      <DialogContent :class="['fixed left-1/2 top-1/2 z-[10000] max-w-md w-[90dvw]', 'transform overflow-hidden rounded-2xl bg-white p-5 shadow-xl outline-none', '-translate-x-1/2 -translate-y-1/2', 'data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow', 'dark:bg-neutral-900']">
        <div :class="['flex flex-col gap-4']">
          <div :class="['flex items-center justify-between']">
            <h3 :class="['text-base text-primary-800 font-bold dark:text-primary-200']">
              予定を追加
            </h3>
            <button type="button" :class="['rounded-lg p-1 transition hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50']" @click="handleClose">
              <div i-solar:close-circle-bold-duotone :class="['size-5 text-neutral-400']" />
            </button>
          </div>

          <!-- Owner Selection -->
          <div :class="['flex flex-col gap-1.5']">
            <label :class="['text-xs text-neutral-500 font-medium dark:text-neutral-400']">誰の予定？</label>
            <div :class="['flex gap-2']">
              <button
                type="button"
                :class="[
                  'flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium transition',
                  owner === 'airi'
                    ? 'border-pink-400 bg-pink-50 text-pink-700 dark:border-pink-600 dark:bg-pink-950/40 dark:text-pink-300'
                    : 'border-neutral-200 text-neutral-500 hover:border-pink-200 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-pink-700',
                ]"
                @click="owner = 'airi'"
              >
                🎀 Airiの予定
              </button>
              <button
                type="button"
                :class="[
                  'flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium transition',
                  owner === 'user'
                    ? 'border-primary-400 bg-primary-50 text-primary-700 dark:border-primary-600 dark:bg-primary-950/40 dark:text-primary-300'
                    : 'border-neutral-200 text-neutral-500 hover:border-primary-200 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-primary-700',
                ]"
                @click="owner = 'user'"
              >
                👤 あなたの予定
              </button>
            </div>
          </div>

          <!-- Title -->
          <div :class="['flex flex-col gap-1.5']">
            <label :class="['text-xs text-neutral-500 font-medium dark:text-neutral-400']">タイトル</label>
            <input
              v-model="title"
              type="text"
              placeholder="予定の名前..."
              :class="['rounded-lg border border-neutral-200 bg-white/80 px-3 py-2 text-sm outline-none transition', 'focus:border-primary-400 focus:ring-2 focus:ring-primary-200/50', 'dark:border-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-200 dark:focus:border-primary-600 dark:focus:ring-primary-800/50']"
            >
          </div>

          <!-- Start Time -->
          <div :class="['flex flex-col gap-1.5']">
            <label :class="['text-xs text-neutral-500 font-medium dark:text-neutral-400']">開始時間</label>
            <input
              v-model="startTime"
              type="time"
              :class="['rounded-lg border border-neutral-200 bg-white/80 px-3 py-2 text-sm outline-none transition', 'focus:border-primary-400 focus:ring-2 focus:ring-primary-200/50', 'dark:border-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-200 dark:focus:border-primary-600 dark:focus:ring-primary-800/50']"
            >
          </div>

          <!-- Recurrence -->
          <div :class="['flex flex-col gap-1.5']">
            <label :class="['text-xs text-neutral-500 font-medium dark:text-neutral-400']">繰り返し</label>
            <select
              v-model="recurrence"
              :class="['rounded-lg border border-neutral-200 bg-white/80 px-3 py-2 text-sm outline-none transition', 'focus:border-primary-400 focus:ring-2 focus:ring-primary-200/50', 'dark:border-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-200 dark:focus:border-primary-600 dark:focus:ring-primary-800/50']"
            >
              <option value="none">
                なし
              </option>
              <option value="daily">
                毎日
              </option>
              <option value="weekly">
                毎週
              </option>
              <option value="monthly">
                毎月
              </option>
            </select>
          </div>

          <!-- Description -->
          <div :class="['flex flex-col gap-1.5']">
            <label :class="['text-xs text-neutral-500 font-medium dark:text-neutral-400']">内容 (任意)</label>
            <textarea
              v-model="description"
              rows="2"
              placeholder="詳細を書く..."
              :class="['resize-none rounded-lg border border-neutral-200 bg-white/80 px-3 py-2 text-sm outline-none transition', 'focus:border-primary-400 focus:ring-2 focus:ring-primary-200/50', 'dark:border-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-200 dark:focus:border-primary-600 dark:focus:ring-primary-800/50']"
            />
          </div>

          <!-- Submit -->
          <button
            type="button"
            :disabled="!title.trim()"
            :class="[
              'rounded-lg px-4 py-2.5 text-sm text-white font-medium shadow-sm transition',
              title.trim()
                ? 'bg-primary-500 hover:bg-primary-600'
                : 'cursor-not-allowed bg-neutral-300 dark:bg-neutral-700',
            ]"
            @click="handleSubmit"
          >
            追加する
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>

  <!-- Mobile drawer -->
  <DrawerRoot v-else :open="showAddEvent" should-scale-background @update:open="v => { if (!v) handleClose() }">
    <DrawerPortal>
      <DrawerOverlay class="fixed inset-0 z-[10000]" />
      <DrawerContent
        :class="['fixed bottom-0 left-0 right-0 z-[10000] mt-20 h-full max-h-[80%]', 'flex flex-col rounded-t-2xl bg-neutral-50 px-4 pt-4 outline-none backdrop-blur-md', 'dark:bg-neutral-900/95']"
        :style="{ paddingBottom: `${Math.max(Number.parseFloat(screenSafeArea.bottom.value.replace('px', '')), 24)}px` }"
      >
        <DrawerHandle />
        <div :class="['flex flex-col gap-4 overflow-y-auto p-2']">
          <h3 :class="['text-base text-primary-800 font-bold dark:text-primary-200']">
            予定を追加
          </h3>

          <!-- Owner Selection -->
          <div :class="['flex gap-2']">
            <button
              type="button"
              :class="[
                'flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium transition',
                owner === 'airi'
                  ? 'border-pink-400 bg-pink-50 text-pink-700 dark:border-pink-600 dark:bg-pink-950/40 dark:text-pink-300'
                  : 'border-neutral-200 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400',
              ]"
              @click="owner = 'airi'"
            >
              🎀 Airi
            </button>
            <button
              type="button"
              :class="[
                'flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium transition',
                owner === 'user'
                  ? 'border-primary-400 bg-primary-50 text-primary-700 dark:border-primary-600 dark:bg-primary-950/40 dark:text-primary-300'
                  : 'border-neutral-200 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400',
              ]"
              @click="owner = 'user'"
            >
              👤 あなた
            </button>
          </div>

          <input
            v-model="title"
            type="text"
            placeholder="予定の名前..."
            :class="['rounded-lg border border-neutral-200 bg-white/80 px-3 py-2 text-sm outline-none', 'dark:border-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-200']"
          >
          <input
            v-model="startTime"
            type="time"
            :class="['rounded-lg border border-neutral-200 bg-white/80 px-3 py-2 text-sm outline-none', 'dark:border-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-200']"
          >
          <select
            v-model="recurrence"
            :class="['rounded-lg border border-neutral-200 bg-white/80 px-3 py-2 text-sm outline-none', 'dark:border-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-200']"
          >
            <option value="none">
              繰り返しなし
            </option>
            <option value="daily">
              毎日
            </option>
            <option value="weekly">
              毎週
            </option>
            <option value="monthly">
              毎月
            </option>
          </select>
          <textarea
            v-model="description"
            rows="2"
            placeholder="詳細..."
            :class="['resize-none rounded-lg border border-neutral-200 bg-white/80 px-3 py-2 text-sm outline-none', 'dark:border-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-200']"
          />
          <button
            type="button"
            :disabled="!title.trim()"
            :class="[
              'rounded-lg px-4 py-2.5 text-sm text-white font-medium',
              title.trim() ? 'bg-primary-500' : 'cursor-not-allowed bg-neutral-300 dark:bg-neutral-700',
            ]"
            @click="handleSubmit"
          >
            追加する
          </button>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
