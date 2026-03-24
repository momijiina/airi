import type { ChatProvider } from '@xsai-ext/providers/utils'
import type { CommonContentPart, CompletionToolCall, Message, Tool } from '@xsai/shared-chat'

import { listModels } from '@xsai/model'
import { XSAIError } from '@xsai/shared'
import { streamText } from '@xsai/stream-text'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { calendar, debug, mcp, timer, webSearch } from '../tools'

export type StreamEvent
  = | { type: 'text-delta', text: string }
    | ({ type: 'finish' } & any)
    | ({ type: 'tool-call' } & CompletionToolCall)
    | { type: 'tool-result', toolCallId: string, result?: string | CommonContentPart[] }
    | { type: 'error', error: any }

export interface StreamOptions {
  headers?: Record<string, string>
  onStreamEvent?: (event: StreamEvent) => void | Promise<void>
  toolsCompatibility?: Map<string, boolean>
  supportsTools?: boolean
  waitForTools?: boolean // when true,won't resolve on finishReason=='tool_calls';
  tools?: Tool[] | (() => Promise<Tool[] | undefined>)
}

// TODO: proper format for other error messages.
function sanitizeMessages(messages: unknown[]): Message[] {
  return messages.map((m: any) => {
    if (m && m.role === 'error') {
      return {
        role: 'user',
        content: `User encountered error: ${String(m.content ?? '')}`,
      } as Message
    }
    // NOTICE: This block is critical for backward compatibility with LLM providers (e.g., DeepSeek)
    // that expect message content to be a string, not an array of content parts.
    // Failure to flatten array content (when no image_url is present) can lead to
    // deserialization errors like "invalid type: sequence, expected a string".
    if (m && Array.isArray(m.content)) {
      const contentParts = m.content as { type?: string, text?: string }[]
      if (!contentParts.some(p => p?.type === 'image_url')) {
        return { ...m, content: contentParts.map(p => p?.text ?? '').join('') } as Message
      }
    }
    return m as Message
  })
}

/**
 * Checks whether the model's text output is empty or consists entirely of
 * thinking/reasoning tags (e.g., `<think>...</think>`), which get filtered
 * out by the response categorizer, leaving the user with no visible response.
 */
function isEmptyOrThinkingOnlyOutput(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < 5)
    return true

  let stripped = trimmed
    // Remove properly closed thinking tags
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    // Also handle unclosed thinking tags at the end (model stopped mid-thought)
    .replace(/<think>[\s\S]*$/gi, '')
    .replace(/<thought>[\s\S]*$/gi, '')
    .replace(/<reasoning>[\s\S]*$/gi, '')

  stripped = stripped.trim()
  return stripped.length < 5
}

function streamOptionsToolsCompatibilityOk(model: string, chatProvider: ChatProvider, _: Message[], options?: StreamOptions): boolean {
  // NOTICE: For local providers (LM Studio, Ollama), always enable tools since they handle
  // function calling at the API level regardless of model capability.
  const baseURL = chatProvider.chat(model).baseURL ?? ''
  if (baseURL.includes('localhost') || baseURL.includes('127.0.0.1')) {
    return true
  }

  return !!(options?.supportsTools || options?.toolsCompatibility?.get(`${baseURL}-${model}`))
}

async function streamFrom(model: string, chatProvider: ChatProvider, messages: Message[], options?: StreamOptions) {
  const headers = options?.headers
  const chatConfig = chatProvider.chat(model)

  const sanitized = sanitizeMessages(messages as unknown[])
  const resolveTools = async () => {
    const tools = typeof options?.tools === 'function'
      ? await options.tools()
      : options?.tools
    return tools ?? []
  }

  const supportedTools = streamOptionsToolsCompatibilityOk(model, chatProvider, messages, options)
  const tools = supportedTools
    ? [
        ...await mcp(),
        ...await debug(),
        ...await webSearch(),
        ...await timer(),
        ...await calendar(),
        ...await resolveTools(),
      ]
    : undefined

  // Track tool usage and final step text for auto-continuation detection
  let hadToolCalls = false
  let finalStepText = ''

  const trackingStreamEvent = async (event: StreamEvent) => {
    if (event.type === 'tool-call')
      hadToolCalls = true
    if (event.type === 'text-delta')
      finalStepText += event.text
    // Reset text tracking when a tool-call step finishes (another step follows)
    if (event.type === 'finish' && (event as any).finishReason === 'tool_calls')
      finalStepText = ''

    await options?.onStreamEvent?.(event)
  }

  // Reusable stream runner wrapping streamText in a promise
  const MAX_STEPS = 5
  const runStream = (msgs: Message[], streamTools: Tool[] | undefined, waitForTools: boolean) => {
    return new Promise<void>((resolve, reject) => {
      let settled = false
      // NOTICE: Track tool-call finish events to detect when maxSteps is exhausted.
      // When the model's last step is a tool call and maxSteps is reached, xsai emits
      // a finish event with finishReason: 'tool_calls' but no more events follow.
      // Without this counter, waitForTools keeps the Promise hanging forever.
      let toolCallFinishCount = 0

      // Safety timeout: if the stream hangs for any reason (network, xsai bug, etc.),
      // resolve after 3 minutes so the chat turn isn't stuck indefinitely.
      let safetyTimer: ReturnType<typeof setTimeout> | undefined

      const resolveOnce = () => {
        if (settled)
          return
        settled = true
        clearTimeout(safetyTimer)
        resolve()
      }
      const rejectOnce = (err: unknown) => {
        if (settled)
          return
        settled = true
        clearTimeout(safetyTimer)
        reject(err)
      }

      safetyTimer = setTimeout(() => {
        console.warn('[llm] Stream safety timeout reached (180s) — resolving to unblock chat')
        resolveOnce()
      }, 180_000)

      const onEvent = async (event: unknown) => {
        try {
          await trackingStreamEvent(event as StreamEvent)
          if (event && (event as StreamEvent).type === 'finish') {
            const finishReason = (event as any).finishReason
            if (finishReason === 'tool_calls') {
              toolCallFinishCount++
              // When maxSteps is exhausted, the stream is done even though the model
              // wanted more tool calls. Resolve to unblock the chat turn.
              if (toolCallFinishCount >= MAX_STEPS) {
                resolveOnce()
                return
              }
              // If waitForTools, keep waiting for a non-tool finish (more steps to come)
              if (waitForTools)
                return
            }
            resolveOnce()
          }
          else if (event && (event as StreamEvent).type === 'error') {
            const error = (event as any).error ?? new Error('Stream error')
            rejectOnce(error)
          }
        }
        catch (err) {
          rejectOnce(err)
        }
      }

      try {
        streamText({
          ...chatConfig,
          maxSteps: MAX_STEPS,
          messages: msgs,
          headers,
          // TODO: we need Automatic tools discovery
          tools: streamTools,
          onEvent,
        })
      }
      catch (err) {
        rejectOnce(err)
      }
    })
  }

  await runStream(sanitized, tools, options?.waitForTools ?? false)

  // NOTICE: Auto-continuation for models that produce empty or thinking-only output.
  // Small models (e.g., qwen3.5-9b) often wrap their entire answer in <think> tags,
  // which get filtered by the response categorizer, leaving the user with no visible speech.
  // When this happens, we nudge the model once to produce a direct answer.
  if (isEmptyOrThinkingOnlyOutput(finalStepText)) {
    finalStepText = ''

    const nudge = hadToolCalls
      ? 'Based on the information you gathered from the tools, please provide your answer directly to the user. Do not use any tools. Do not wrap your response in <think> tags. Respond naturally in the same language the user used.'
      : 'Please provide your answer directly to the user. Do not wrap your response in <think> tags. Respond naturally in the same language the user used.'

    sanitized.push({ role: 'user', content: nudge } as Message)

    // Disable tools when tool calls already happened to prevent infinite loops;
    // keep tools available otherwise (model may need them on the retry).
    await runStream(
      sanitized,
      hadToolCalls ? undefined : tools,
      hadToolCalls ? false : (options?.waitForTools ?? false),
    )
  }
}

export async function attemptForToolsCompatibilityDiscovery(model: string, chatProvider: ChatProvider, _: Message[], options?: Omit<StreamOptions, 'supportsTools'>): Promise<boolean> {
  async function attempt(enable: boolean) {
    try {
      await streamFrom(model, chatProvider, [{ role: 'user', content: 'Hello, world!' }], { ...options, supportsTools: enable })
      return true
    }
    catch (err) {
      if (err instanceof Error && err.name === new XSAIError('').name) {
        // TODO: if you encountered many more errors like these, please, add them here.

        // Ollama
        /**
         * {"error":{"message":"registry.ollama.ai/<scope>/<model> does not support tools","type":"api_error","param":null,"code":null}}
         */
        if (String(err).includes('does not support tools')) {
          return false
        }
        // OpenRouter
        /**
         * {"error":{"message":"No endpoints found that support tool use. To learn more about provider routing, visit: https://openrouter.ai/docs/provider-routing","code":404}}
         */
        if (String(err).includes('No endpoints found that support tool use.')) {
          return false
        }
      }

      throw err
    }
  }

  function promiseAllWithInterval<T>(promises: (() => Promise<T>)[], interval: number): Promise<{ result?: T, error?: any }[]> {
    return new Promise((resolve) => {
      const results: { result?: T, error?: any }[] = []
      let completed = 0

      promises.forEach((promiseFn, index) => {
        setTimeout(() => {
          promiseFn()
            .then((result) => {
              results[index] = { result }
            })
            .catch((err) => {
              results[index] = { error: err }
            })
            .finally(() => {
              completed++
              if (completed === promises.length) {
                resolve(results)
              }
            })
        }, index * interval)
      })
    })
  }

  const attempts = [
    () => attempt(true),
    () => attempt(false),
  ]

  const attemptsResults = await promiseAllWithInterval<boolean | undefined>(attempts, 1000)
  if (attemptsResults.some(res => res.error)) {
    const err = new Error(`Error during tools compatibility discovery for model: ${model}. Errors: ${attemptsResults.map(res => res.error).filter(Boolean).join(', ')}`)
    err.cause = attemptsResults.map(res => res.error).filter(Boolean)
    throw err
  }

  return attemptsResults[0].result === true && attemptsResults[1].result === true
}

export const useLLM = defineStore('llm', () => {
  const toolsCompatibility = ref<Map<string, boolean>>(new Map())

  async function discoverToolsCompatibility(model: string, chatProvider: ChatProvider, _: Message[], options?: Omit<StreamOptions, 'supportsTools'>) {
    // Cached, no need to discover again
    if (toolsCompatibility.value.has(`${chatProvider.chat(model).baseURL}-${model}`)) {
      return
    }

    const res = await attemptForToolsCompatibilityDiscovery(model, chatProvider, _, { ...options, toolsCompatibility: toolsCompatibility.value })
    toolsCompatibility.value.set(`${chatProvider.chat(model).baseURL}-${model}`, res)
  }

  function stream(model: string, chatProvider: ChatProvider, messages: Message[], options?: StreamOptions) {
    return streamFrom(model, chatProvider, messages, { ...options, toolsCompatibility: toolsCompatibility.value })
  }

  async function models(apiUrl: string, apiKey: string) {
    if (apiUrl === '') {
      return []
    }

    try {
      return await listModels({
        baseURL: (apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`) as `${string}/`,
        apiKey,
      })
    }
    catch (err) {
      if (String(err).includes(`Failed to construct 'URL': Invalid URL`)) {
        return []
      }

      throw err
    }
  }

  return {
    models,
    stream,
    discoverToolsCompatibility,
  }
})
