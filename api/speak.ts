import { EdgeTTS } from 'edge-tts-universal'

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

export default async function handler(req: any, res: any) {
  const text = req.query.text || req.body?.text
  const lang = req.query.lang || req.body?.lang || 'en-US'
  const rate = req.query.rate || req.body?.rate

  if (!text) {
    return res.status(400).json({ error: 'Missing text parameter' })
  }

  const voice = getVoiceForLang(lang)
  
  // Calculate speed rate for Edge TTS (e.g. -35%)
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

  try {
    const tts = new EdgeTTS(text, voice, {
      rate: speedRate
    })

    const result = await tts.synthesize()
    const audioBuffer = Buffer.from(await result.audio.arrayBuffer())

    if (audioBuffer.length === 0) {
      return res.status(500).json({ error: 'Received empty audio from Edge TTS service' })
    }

    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.status(200).send(audioBuffer)
  } catch (err: any) {
    console.error('[Edge TTS] Serverless handler error:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to synthesize speech', details: err.message })
    }
  }
}
