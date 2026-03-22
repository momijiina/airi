// Airi Browser - Background Service Worker
// OpenAI互換APIを使ったブラウザ自律操作

const DEFAULT_API_URL = 'http://localhost:1234/v1/chat/completions'
const DEFAULT_MODEL = '' // 空 = 未選択（ポップアップで選択必須）

// サイドパネルを開く設定
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})

// ============================================================
// LM Studio API 呼び出し
// ============================================================
async function getSettings() {
  const defaults = {
    apiUrl: DEFAULT_API_URL,
    model: DEFAULT_MODEL,
    maxTokens: 2048,
    temperature: 0.2,
    systemPrompt: '',
  }
  const data = await chrome.storage.local.get(defaults)
  return data
}

// LM Studioから利用可能なモデルを自動検出（小さいモデルを優先）
async function detectModel(apiUrl) {
  try {
    const modelsUrl = apiUrl.replace('/chat/completions', '/models')
    const resp = await fetch(modelsUrl)
    if (!resp.ok)
      return null
    const json = await resp.json()
    // embeddingモデルを除外
    const models = (json.data || []).filter(m =>
      !m.id.includes('embedding') && !m.id.includes('embed'),
    )
    if (models.length === 0)
      return (json.data && json.data[0]) ? json.data[0].id : null
    // パラメータサイズの数値を抽出してソート（小さいモデルを優先）
    const withSize = models.map((m) => {
      const match = m.id.match(/(\d+(?:\.\d*)?)b/i)
      return { id: m.id, size: match ? Number.parseFloat(match[1]) : 0 }
    })
    withSize.sort((a, b) => a.size - b.size)
    // サイズ0（不明）のモデルは末尾に回す
    const known = withSize.filter(m => m.size > 0)
    const unknown = withSize.filter(m => m.size === 0)
    const sorted = [...known, ...unknown]
    return sorted[0].id
  }
  catch {
    return null
  }
}

// 利用可能な全モデルのリストを取得
async function listModels(apiUrl) {
  try {
    const modelsUrl = apiUrl.replace('/chat/completions', '/models')
    const resp = await fetch(modelsUrl)
    if (!resp.ok)
      return []
    const json = await resp.json()
    return (json.data || []).filter(m =>
      !m.id.includes('embedding') && !m.id.includes('embed'),
    ).map(m => m.id)
  }
  catch {
    return []
  }
}

// ストリーミング対応のAPI呼び出し
async function callLMStudio(messages, settings, onChunk) {
  if (!settings.model) {
    throw new Error('モデルが選択されていません。拡張機能の設定（ポップアップ）からモデルを選択してください。')
  }
  const model = settings.model

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120000) // 120秒タイムアウト

  try {
    const resp = await fetch(settings.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        max_tokens: settings.maxTokens,
        temperature: settings.temperature,
        stream: true,
        // Qwen3系のthinkingモードを無効化（JSON出力を確実にする）
        chat_template_kwargs: { enable_thinking: false },
      }),
    })

    clearTimeout(timeoutId)

    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`API error ${resp.status}: ${text.slice(0, 200)}`)
    }

    // ストリーミング読み取り
    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let fullText = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:'))
          continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]')
          break

        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) {
            fullText += delta
            if (onChunk)
              onChunk(delta, fullText)
          }
        }
        catch {
          // パース失敗は無視（部分的なJSON）
        }
      }
    }

    return fullText
  }
  catch (e) {
    clearTimeout(timeoutId)
    if (e.name === 'AbortError') {
      throw new Error('タイムアウト（120秒）。モデルが重いかプロンプトが長すぎます。')
    }
    throw e
  }
}

// 非ストリーミングフォールバック
async function callLMStudioSync(messages, settings) {
  if (!settings.model) {
    throw new Error('モデルが選択されていません。')
  }
  const model = settings.model

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120000)

  try {
    const resp = await fetch(settings.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        max_tokens: settings.maxTokens,
        temperature: settings.temperature,
        stream: false,
        chat_template_kwargs: { enable_thinking: false },
      }),
    })

    clearTimeout(timeoutId)

    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`API error ${resp.status}: ${text.slice(0, 200)}`)
    }

    const json = await resp.json()
    return json.choices[0].message.content
  }
  catch (e) {
    clearTimeout(timeoutId)
    if (e.name === 'AbortError') {
      throw new Error('タイムアウト（120秒）')
    }
    throw e
  }
}

// ============================================================
// ページ情報をコンテンツスクリプトから取得
// ============================================================
async function getPageState(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractPageState,
    })
    return results[0]?.result || { error: 'ページ情報を取得できませんでした' }
  }
  catch (e) {
    return { error: e.message }
  }
}

function extractPageState() {
  const interactiveElements = []
  const selectors = [
    'a[href]',
    'button',
    'input',
    'textarea',
    'select',
    '[role="button"]',
    '[role="link"]',
    '[role="tab"]',
    '[onclick]',
    '[contenteditable="true"]',
  ]

  const elements = document.querySelectorAll(selectors.join(','))
  const seen = new Set()
  let idx = 0

  elements.forEach((el) => {
    if (seen.has(el))
      return
    seen.add(el)
    if (el.offsetWidth === 0 && el.offsetHeight === 0)
      return
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0)
      return
    // 画面外の要素はスキップ（トークン節約）
    if (rect.bottom < -200 || rect.top > window.innerHeight * 2)
      return

    const tag = el.tagName.toLowerCase()
    const type = el.getAttribute('type') || ''
    const text = (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('title') || '').trim().slice(0, 50)
    const href = el.getAttribute('href') || ''

    interactiveElements.push({
      idx: idx++,
      tag,
      type,
      text,
      href: href.slice(0, 100),
    })
  })

  // ページテキスト短縮（小モデル向け）
  const bodyText = document.body?.innerText?.slice(0, 1200) || ''

  return {
    url: window.location.href,
    title: document.title,
    bodyTextPreview: bodyText,
    interactiveElements: interactiveElements.slice(0, 40),
  }
}

// ============================================================
// ブラウザアクションの実行
// ============================================================
async function executeAction(tabId, action) {
  try {
    switch (action.type) {
      case 'click': {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (idx) => {
            const selectors = [
              'a[href]',
              'button',
              'input',
              'textarea',
              'select',
              '[role="button"]',
              '[role="link"]',
              '[role="tab"]',
              '[onclick]',
              '[contenteditable="true"]',
            ]
            const elements = document.querySelectorAll(selectors.join(','))
            const seen = new Set()
            let current = 0
            for (const el of elements) {
              if (seen.has(el))
                continue
              seen.add(el)
              if (el.offsetWidth === 0 && el.offsetHeight === 0)
                continue
              if (current === idx) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                el.click()
                return { success: true }
              }
              current++
            }
            return { success: false, error: 'element not found' }
          },
          args: [action.elementIndex],
        })
        return { success: true, message: `要素 ${action.elementIndex} をクリック` }
      }

      case 'type': {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (idx, text, clearFirst) => {
            const selectors = [
              'a[href]',
              'button',
              'input',
              'textarea',
              'select',
              '[role="button"]',
              '[role="link"]',
              '[role="tab"]',
              '[onclick]',
              '[contenteditable="true"]',
            ]
            const elements = document.querySelectorAll(selectors.join(','))
            const seen = new Set()
            let current = 0
            for (const el of elements) {
              if (seen.has(el))
                continue
              seen.add(el)
              if (el.offsetWidth === 0 && el.offsetHeight === 0)
                continue
              if (current === idx) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                el.focus()
                el.click()

                // Clear first if requested
                if (clearFirst) {
                  el.value = ''
                  el.dispatchEvent(new Event('input', { bubbles: true }))
                }

                // Method 1: execCommand (works on most sites including Google)
                try {
                  document.execCommand('insertText', false, text)
                }
                catch (e) {}

                // Check if text was actually inserted
                const currentVal = el.value || el.textContent || ''
                if (!currentVal.includes(text)) {
                  // Method 2: InputEvent (modern approach)
                  try {
                    const inputEvent = new InputEvent('beforeinput', {
                      inputType: 'insertText',
                      data: text,
                      bubbles: true,
                      cancelable: true,
                    })
                    el.dispatchEvent(inputEvent)
                  }
                  catch (e) {}

                  // Method 3: Direct value set as last resort
                  const setter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype,
                    'value',
                  )?.set || Object.getOwnPropertyDescriptor(
                    window.HTMLTextAreaElement.prototype,
                    'value',
                  )?.set
                  if (setter) {
                    setter.call(el, (clearFirst ? '' : (el.value || '')) + text)
                  }
                  else {
                    el.value = (clearFirst ? '' : (el.value || '')) + text
                  }
                  el.dispatchEvent(new Event('input', { bubbles: true }))
                  el.dispatchEvent(new Event('change', { bubbles: true }))
                }

                return { success: true, value: el.value || el.textContent || '' }
              }
              current++
            }
            return { success: false }
          },
          args: [action.elementIndex, action.text || '', action.clearFirst || false],
        })
        return { success: true, message: `要素 ${action.elementIndex} にテキスト入力: "${(action.text || '').slice(0, 30)}"` }
      }

      case 'pressKey': {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (key) => {
            const target = document.activeElement || document.body
            const keyCode = key === 'Enter' ? 13 : key === 'Escape' ? 27 : key === 'Tab' ? 9 : 0
            const code = key === 'Enter' ? 'Enter' : key === 'Escape' ? 'Escape' : key === 'Tab' ? 'Tab' : `Key${key.toUpperCase()}`

            // Dispatch full keyboard event sequence with keyCode for compatibility
            target.dispatchEvent(new KeyboardEvent('keydown', {
              key,
              code,
              keyCode,
              which: keyCode,
              bubbles: true,
              cancelable: true,
            }))
            target.dispatchEvent(new KeyboardEvent('keypress', {
              key,
              code,
              keyCode,
              which: keyCode,
              bubbles: true,
              cancelable: true,
            }))
            target.dispatchEvent(new KeyboardEvent('keyup', {
              key,
              code,
              keyCode,
              which: keyCode,
              bubbles: true,
              cancelable: true,
            }))

            // For Enter: try multiple form submission methods
            if (key === 'Enter') {
              // Try the closest form
              const form = target.closest('form') || target.form
              if (form) {
                try { form.requestSubmit() }
                catch (e) {
                  try { form.submit() }
                  catch (e2) {}
                }
              }
              // Also try clicking any nearby submit button
              if (form) {
                const submitBtn = form.querySelector('[type="submit"], button:not([type="button"])')
                if (submitBtn)
                  submitBtn.click()
              }
            }
          },
          args: [action.key],
        })
        return { success: true, message: `${action.key} キーを押下` }
      }

      case 'navigate': {
        await chrome.tabs.update(tabId, { url: action.url })
        await new Promise(r => setTimeout(r, 2500))
        return { success: true, message: `${action.url} に移動` }
      }

      case 'scroll': {
        const scrollDir = action.direction || 'down'
        const scrollAmt = action.amount || 500
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (direction, amount) => {
            window.scrollBy(0, direction === 'up' ? -amount : amount)
          },
          args: [scrollDir, scrollAmt],
        })
        return { success: true, message: `${scrollDir} にスクロール` }
      }

      case 'back': {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: () => window.history.back(),
        })
        await new Promise(r => setTimeout(r, 1500))
        return { success: true, message: '前のページに戻る' }
      }

      case 'forward': {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: () => window.history.forward(),
        })
        await new Promise(r => setTimeout(r, 1500))
        return { success: true, message: '次のページに進む' }
      }

      case 'wait': {
        const ms = Math.min(action.ms || 2000, 10000)
        await new Promise(r => setTimeout(r, ms))
        return { success: true, message: `${ms}ms 待機` }
      }

      case 'selectOption': {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (idx, value) => {
            const selectors = [
              'a[href]',
              'button',
              'input',
              'textarea',
              'select',
              '[role="button"]',
              '[role="link"]',
              '[role="tab"]',
              '[onclick]',
              '[contenteditable="true"]',
            ]
            const elements = document.querySelectorAll(selectors.join(','))
            const seen = new Set()
            let current = 0
            for (const el of elements) {
              if (seen.has(el))
                continue
              seen.add(el)
              if (el.offsetWidth === 0 && el.offsetHeight === 0)
                continue
              if (current === idx) {
                el.value = value
                el.dispatchEvent(new Event('change', { bubbles: true }))
                return { success: true }
              }
              current++
            }
            return { success: false }
          },
          args: [action.elementIndex, action.value],
        })
        return { success: true, message: `オプション "${action.value}" を選択` }
      }

      case 'done': {
        return { success: true, message: action.summary || 'タスク完了', done: true }
      }

      case 'fail': {
        return { success: false, message: action.reason || '完了できませんでした', done: true }
      }

      default:
        return { success: false, message: `未知のアクション: ${action.type}` }
    }
  }
  catch (e) {
    return { success: false, message: `実行エラー: ${e.message}` }
  }
}

// ============================================================
// システムプロンプト（英語で簡潔 - 小モデルでも確実にJSON生成）
// ============================================================
function buildSystemPrompt(customPrompt) {
  return `You are a browser automation AI. You MUST respond with ONLY a JSON object. No markdown, no explanation, no code blocks.

Response format (strict JSON):
{"thought":"your brief reasoning","action":{"type":"action_name",...}}

Available actions:
- {"type":"click","elementIndex":N} - click element [N]
- {"type":"type","elementIndex":N,"text":"...","clearFirst":true} - type text into element
- {"type":"pressKey","key":"Enter"} - press a key (Enter, Escape, Tab...)
- {"type":"navigate","url":"https://..."} - go to URL directly
- {"type":"scroll","direction":"down"} - scroll page
- {"type":"back"} - go back
- {"type":"done","summary":"..."} - task complete
- {"type":"fail","reason":"..."} - task impossible

CRITICAL RULES:
- PREFERRED: For Google search, use navigate directly: {"type":"navigate","url":"https://www.google.com/search?q=YOUR+QUERY"}
- For other sites: use "type" to enter text, then "pressKey" Enter in next step
- One action per response only
- Use [N] index from the element list to identify elements
- Always respond with raw JSON only, no other text
- If navigate is possible, prefer it over type+pressKey
${customPrompt ? `\nExtra: ${customPrompt}` : ''}`
}

// ============================================================
// メッセージハンドラ
// ============================================================
let agentRunning = false
let shouldStop = false

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'startAgent') {
    handleStartAgent(msg.task)
    sendResponse({ ok: true })
  }
  else if (msg.type === 'stopAgent') {
    shouldStop = true
    agentRunning = false
    sendResponse({ ok: true })
  }
  else if (msg.type === 'getStatus') {
    sendResponse({ running: agentRunning })
  }
  else if (msg.type === 'detectModel') {
    detectModel(msg.apiUrl || DEFAULT_API_URL).then((model) => {
      sendResponse({ model: model || '(検出失敗)' })
    })
    return true
  }
  else if (msg.type === 'listModels') {
    listModels(msg.apiUrl || DEFAULT_API_URL).then((models) => {
      sendResponse({ models })
    })
    return true
  }
  return true
})

async function sendToSidePanel(msg) {
  try {
    await chrome.runtime.sendMessage(msg)
  }
  catch (_) {
    // サイドパネルが閉じている場合は無視
  }
}

async function handleStartAgent(task) {
  if (agentRunning) {
    await sendToSidePanel({ type: 'log', text: '⚠️ エージェントは既に実行中です' })
    return
  }

  agentRunning = true
  shouldStop = false
  const settings = await getSettings()

  // モデル確認
  if (!settings.model) {
    await sendToSidePanel({ type: 'log', text: '❌ モデルが選択されていません。サイドパネル上部のドロップダウンからモデルを選択してください。' })
    agentRunning = false
    await sendToSidePanel({ type: 'agentDone' })
    return
  }
  await sendToSidePanel({ type: 'log', text: `📡 モデル: ${settings.model}` })

  const systemPrompt = buildSystemPrompt(settings.systemPrompt)
  const conversationHistory = [
    { role: 'system', content: systemPrompt },
  ]

  await sendToSidePanel({ type: 'log', text: `🚀 タスク開始: ${task}` })

  const MAX_STEPS = 20
  let lastActionResult = null

  for (let step = 0; step < MAX_STEPS; step++) {
    if (shouldStop) {
      await sendToSidePanel({ type: 'log', text: '⏹️ 停止しました' })
      break
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab) {
      await sendToSidePanel({ type: 'log', text: '❌ アクティブなタブが見つかりません' })
      break
    }

    await sendToSidePanel({ type: 'status', text: `📄 ページ情報取得中... (${step + 1}/${MAX_STEPS})` })

    const pageState = await getPageState(tab.id)

    // 要素リストをコンパクトに
    const elementList = pageState.interactiveElements
      ? pageState.interactiveElements.map((e) => {
          const label = e.text || e.href || '(empty)'
          return `[${e.idx}]<${e.tag}${e.type ? ` type=${e.type}` : ''}> ${label}`
        }).join('\n')
      : '(none)'

    // ユーザーメッセージを構築（アクション結果 + ページ情報を1つに統合）
    let userContent = ''
    if (step === 0) {
      userContent = `Task: ${task}\n\n`
    }
    else if (lastActionResult) {
      userContent = `Previous action result: ${lastActionResult}\n\n`
    }
    userContent += `Page: ${pageState.title}
URL: ${pageState.url}

Text:
${(pageState.bodyTextPreview || '').slice(0, 600)}

Elements:
${elementList}`

    if (step > 0) {
      userContent += `\n\nRemember the task: ${task}`
    }

    conversationHistory.push({ role: 'user', content: userContent })

    // 会話履歴を制限: system + 最新のuser/assistant ペアを保持
    // user/assistantが必ず交互になるように、古いペアから削除
    while (conversationHistory.length > 9) {
      // system(0)の次のuser(1)とassistant(2)のペアを削除
      conversationHistory.splice(1, 2)
    }

    await sendToSidePanel({ type: 'status', text: `🤖 AI思考中... (${step + 1}/${MAX_STEPS})` })

    let aiResponse
    try {
      aiResponse = await callLMStudio(conversationHistory, settings, (chunk, fullText) => {
        if (fullText.length % 40 < chunk.length) {
          sendToSidePanel({ type: 'status', text: `🤖 応答受信中... (${fullText.length}文字)` })
        }
      })
    }
    catch (e) {
      // ストリーミング失敗 → 非ストリーミングでリトライ
      await sendToSidePanel({ type: 'log', text: `⚠️ ストリーミング失敗: ${e.message}` })
      try {
        await sendToSidePanel({ type: 'status', text: '🔄 再試行中...' })
        aiResponse = await callLMStudioSync(conversationHistory, settings)
      }
      catch (e2) {
        await sendToSidePanel({ type: 'log', text: `❌ APIエラー: ${e2.message}` })
        break
      }
    }

    if (!aiResponse || aiResponse.trim().length === 0) {
      await sendToSidePanel({ type: 'log', text: '⚠️ 空の応答' })
      // 空応答でもassistantメッセージを追加して交互を維持
      conversationHistory.push({ role: 'assistant', content: '{"thought":"empty response","action":{"type":"wait","ms":1000}}' })
      lastActionResult = '空の応答、再試行します'
      continue
    }

    await sendToSidePanel({ type: 'log', text: `📝 AI応答 (${aiResponse.length}文字)` })
    conversationHistory.push({ role: 'assistant', content: aiResponse })

    // JSONパース（thinkingタグ、未閉じthinkタグ等を除去）
    let parsed
    try {
      const cleaned = aiResponse
        // 閉じた<think>タグを除去
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        // 閉じていない<think>タグも除去（モデルが思考で全トークン消費した場合）
        .replace(/<think>[\s\S]*/gi, '')
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim()

      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (!jsonMatch)
        throw new Error(`No JSON found in: ${cleaned.slice(0, 100) || '(empty after cleanup)'}`)
      parsed = JSON.parse(jsonMatch[0])
    }
    catch (e) {
      // 生の応答を表示して問題を可視化
      await sendToSidePanel({ type: 'log', text: `⚠️ パース失敗: ${e.message}` })
      await sendToSidePanel({ type: 'log', text: `📄 生応答: ${aiResponse.slice(0, 300)}` })
      lastActionResult = 'JSON parse failed. Respond with ONLY raw JSON.'
      continue
    }

    // action がトップレベルにない場合のフォールバック
    // 例: {"type":"click","elementIndex":0} のような直接アクション
    let thought = parsed.thought || ''
    let action = parsed.action
    if (!action && parsed.type) {
      action = parsed
      thought = ''
    }

    if (thought)
      await sendToSidePanel({ type: 'thought', text: thought })
    await sendToSidePanel({ type: 'action', action })

    if (!action || !action.type) {
      await sendToSidePanel({ type: 'log', text: `⚠️ アクションなし (keys: ${Object.keys(parsed).join(',')})` })
      await sendToSidePanel({ type: 'log', text: `📄 パース結果: ${JSON.stringify(parsed).slice(0, 200)}` })
      lastActionResult = 'No action found. Include "action" with "type" in your response.'
      continue
    }

    await sendToSidePanel({ type: 'status', text: `⚡ ${action.type}` })
    const result = await executeAction(tab.id, action)
    await sendToSidePanel({ type: 'result', text: result.message, success: result.success })

    if (result.done) {
      await sendToSidePanel({ type: 'log', text: `✅ ${result.message}` })
      break
    }

    lastActionResult = result.message

    await new Promise(r => setTimeout(r, 1500))
  }

  agentRunning = false
  await sendToSidePanel({ type: 'agentDone' })
}
