import WebSocket from 'ws'
import crypto from 'crypto'

function getVoiceForLang(langCode: string): string {
  const code = langCode.toLowerCase()
  if (code.includes('vi')) return 'vi-VN-HoaiMyNeural'
  if (code.includes('zh') || code.includes('cn')) return 'zh-CN-XiaoxiaoNeural'
  if (code.includes('ja') || code.includes('jp')) return 'ja-JP-NanamiNeural'
  if (code.includes('ko') || code.includes('kr')) return 'ko-KR-SunHiNeural'
  if (code.includes('fr')) return 'fr-FR-DeniseNeural'
  if (code.includes('de')) return 'de-DE-KatjaNeural'
  if (code.includes('es')) return 'es-ES-ElviraNeural'
  return 'en-US-EmmaMultilingualNeural'
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  })
}

export default async function handler(req: any, res: any) {
  // Allow both GET and POST
  const text = req.query.text || req.body?.text
  const lang = req.query.lang || req.body?.lang || 'en-US'
  const rate = req.query.rate || req.body?.rate

  if (!text) {
    return res.status(400).json({ error: 'Missing text parameter' })
  }

  const voice = getVoiceForLang(lang)
  
  // Calculate speed rate percentage for Edge TTS (e.g., -35%)
  let speedRate = '-35%'
  if (rate) {
    if (rate.toString().includes('%')) {
      speedRate = rate.toString()
    } else {
      const parsedRate = parseFloat(rate.toString())
      if (!isNaN(parsedRate)) {
        const pct = Math.round((parsedRate - 1.0) * 100)
        speedRate = `${pct > 0 ? '+' : ''}${pct}%`
      }
    }
  }

  const requestId = crypto.randomBytes(16).toString('hex')
  const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D3D4E99522&ConnectionId=${requestId}`

  const audioChunks: Buffer[] = []
  let wsClosed = false

  try {
    const ws = new WebSocket(wsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        'Origin': 'chrome-extension://jdiccldimpdaibdgojnbhgkakjooommj'
      }
    })

    const timeoutId = setTimeout(() => {
      if (!wsClosed) {
        console.warn(`[Edge TTS] Connection timeout reached for request ${requestId}. Closing websocket.`)
        ws.close()
      }
    }, 12000) // 12 seconds timeout limit

    ws.on('open', () => {
      // 1. Send Configuration header
      const configMessage = `Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"system":{"name":"SpeechSDK","version":"1.12.1-rc.1","build":"JavaScript","lang":"JavaScript","os":{"platform":"Browser/Linux","name":"Chrome","version":"120.0"}}}}`
      ws.send(configMessage)

      // 2. Send SSML markup
      const escapedText = escapeXml(text)
      const ssmlMessage = `Path:ssml\r\nX-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\n\r\n<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'><voice name='${voice}'><prosody rate='${speedRate}'>${escapedText}</prosody></voice></speak>`
      ws.send(ssmlMessage)
    })

    ws.on('message', (data: any, isBinary: boolean) => {
      if (isBinary) {
        const buffer = Buffer.from(data)
        // Parse the header length (first 2 bytes)
        const headerLength = buffer.readUInt16BE(0)
        // Skip header length bytes + the header text itself to extract binary audio payload
        const payload = buffer.subarray(2 + headerLength)
        if (payload.length > 0) {
          audioChunks.push(payload)
        }
      } else {
        const textMsg = data.toString()
        if (textMsg.includes('Path:turn.end')) {
          ws.close()
        }
      }
    })

    ws.on('close', () => {
      wsClosed = true
      clearTimeout(timeoutId)

      if (audioChunks.length === 0) {
        return res.status(500).json({ error: 'Received empty audio from speech service' })
      }

      const finalAudio = Buffer.concat(audioChunks)
      res.setHeader('Content-Type', 'audio/mpeg')
      res.setHeader('Cache-Control', 'public, max-age=86400')
      res.status(200).send(finalAudio)
    })

    ws.on('error', (err) => {
      wsClosed = true
      clearTimeout(timeoutId)
      console.error(`[Edge TTS] WebSocket error for request ${requestId}:`, err)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to connect to Microsoft Edge speech service', details: err.message })
      }
    })

  } catch (err: any) {
    wsClosed = true
    console.error(`[Edge TTS] Handler exception:`, err)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Edge TTS exception', details: err.message })
    }
  }
}
