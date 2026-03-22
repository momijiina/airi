// Airi Browser - Content Script
// ページ内操作のためのヘルパー

(() => {
  // ハイライト表示用のスタイルを注入
  const style = document.createElement('style')
  style.textContent = `
    .ai-pilot-highlight {
      outline: 3px solid #ff6b00 !important;
      outline-offset: 2px !important;
      transition: outline 0.3s ease !important;
    }
    .ai-pilot-highlight-flash {
      animation: ai-pilot-flash 1s ease-out !important;
    }
    @keyframes ai-pilot-flash {
      0% { outline-color: #ff6b00; outline-width: 3px; }
      50% { outline-color: #ffaa00; outline-width: 5px; }
      100% { outline-color: transparent; outline-width: 0px; }
    }
    .ai-pilot-overlay {
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.85);
      color: #fff;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }
  `
  document.head.appendChild(style)

  // 操作中の要素をハイライト
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'highlight') {
      highlightElement(msg.elementIndex)
      sendResponse({ ok: true })
    }
    else if (msg.type === 'showOverlay') {
      showOverlay(msg.text)
      sendResponse({ ok: true })
    }
    return true
  })

  function highlightElement(idx) {
    // 前のハイライトを削除
    document.querySelectorAll('.ai-pilot-highlight').forEach((el) => {
      el.classList.remove('ai-pilot-highlight')
    })

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
        el.classList.add('ai-pilot-highlight')
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // 2秒後にフラッシュアニメーションで消す
        setTimeout(() => {
          el.classList.remove('ai-pilot-highlight')
          el.classList.add('ai-pilot-highlight-flash')
          setTimeout(() => el.classList.remove('ai-pilot-highlight-flash'), 1000)
        }, 2000)
        return
      }
      current++
    }
  }

  let overlayTimer
  function showOverlay(text) {
    let overlay = document.querySelector('.ai-pilot-overlay')
    if (!overlay) {
      overlay = document.createElement('div')
      overlay.className = 'ai-pilot-overlay'
      document.body.appendChild(overlay)
    }
    overlay.textContent = text
    overlay.style.opacity = '1'
    clearTimeout(overlayTimer)
    overlayTimer = setTimeout(() => {
      overlay.style.opacity = '0'
    }, 3000)
  }
})()
