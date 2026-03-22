// アイコン生成スクリプト - Node.jsなしでHTML Canvasを使ってPNGを生成
// ブラウザで generate_icons.html を開くとアイコンがダウンロードされます

const sizes = [16, 48, 128]

function generateIcon(size) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  // 背景 - グラデーション
  const grad = ctx.createLinearGradient(0, 0, size, size)
  grad.addColorStop(0, '#1a73e8')
  grad.addColorStop(1, '#7c4dff')
  ctx.fillStyle = grad

  // 角丸四角形
  const r = size * 0.18
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(size - r, 0)
  ctx.quadraticCurveTo(size, 0, size, r)
  ctx.lineTo(size, size - r)
  ctx.quadraticCurveTo(size, size, size - r, size)
  ctx.lineTo(r, size)
  ctx.quadraticCurveTo(0, size, 0, size - r)
  ctx.lineTo(0, r)
  ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.fill()

  // ロボットの顔
  ctx.fillStyle = '#ffffff'
  const cx = size / 2
  const cy = size * 0.45

  // 頭
  const headW = size * 0.5
  const headH = size * 0.35
  const headR = size * 0.08
  ctx.beginPath()
  ctx.moveTo(cx - headW / 2 + headR, cy - headH / 2)
  ctx.lineTo(cx + headW / 2 - headR, cy - headH / 2)
  ctx.quadraticCurveTo(cx + headW / 2, cy - headH / 2, cx + headW / 2, cy - headH / 2 + headR)
  ctx.lineTo(cx + headW / 2, cy + headH / 2 - headR)
  ctx.quadraticCurveTo(cx + headW / 2, cy + headH / 2, cx + headW / 2 - headR, cy + headH / 2)
  ctx.lineTo(cx - headW / 2 + headR, cy + headH / 2)
  ctx.quadraticCurveTo(cx - headW / 2, cy + headH / 2, cx - headW / 2, cy + headH / 2 - headR)
  ctx.lineTo(cx - headW / 2, cy - headH / 2 + headR)
  ctx.quadraticCurveTo(cx - headW / 2, cy - headH / 2, cx - headW / 2 + headR, cy - headH / 2)
  ctx.fill()

  // 目
  ctx.fillStyle = '#1a73e8'
  const eyeR = size * 0.06
  ctx.beginPath()
  ctx.arc(cx - size * 0.1, cy, eyeR, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx + size * 0.1, cy, eyeR, 0, Math.PI * 2)
  ctx.fill()

  // アンテナ
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = Math.max(1, size * 0.04)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx, cy - headH / 2)
  ctx.lineTo(cx, cy - headH / 2 - size * 0.12)
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(cx, cy - headH / 2 - size * 0.12, size * 0.04, 0, Math.PI * 2)
  ctx.fill()

  // AIテキスト
  if (size >= 48) {
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${size * 0.2}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('AI', cx, size * 0.78)
  }

  return canvas.toDataURL('image/png')
}

// HTML用
if (typeof document !== 'undefined' && document.getElementById) {
  document.addEventListener('DOMContentLoaded', () => {
    sizes.forEach((size) => {
      const dataUrl = generateIcon(size)
      const link = document.createElement('a')
      link.download = `icon${size}.png`
      link.href = dataUrl

      const img = document.createElement('img')
      img.src = dataUrl
      img.style.margin = '10px'
      img.style.border = '1px solid #ccc'
      document.body.appendChild(img)
      document.body.appendChild(link)
      link.textContent = ` icon${size}.png をダウンロード `
      document.body.appendChild(document.createElement('br'))
    })
  })
}
