/**
 * WordTooltip - 单词释义悬浮气泡组件
 *
 * 功能：
 * - 显示单词、音标、多语言释义
 * - 提供"学习"按钮保存到生词本
 * - 自动同步中栏全局翻译语言设置（实时联动）
 * - 精简 UI：单词音标、释义+英文对照、例句、按钮
 * - 单词发音：美音/英音播放，预加载确保秒播
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { getStoredLanguage } from '@/components/TranslationLanguageSelector'
import { Volume2 } from 'lucide-react'

export interface WordDefinition {
  word: string
  phonetic: string
  definitions: {
    'zh-CN': string
    'zh-Hant': string
    'vi': string
    'en': string
  }
  example?: string
  audioUrls?: {
    us: string | null
    uk: string | null
  }
}

interface WordTooltipProps {
  word: string
  definition: WordDefinition | null
  loading: boolean
  position: { x: number; y: number }
  sentence: string
  materialId?: string
  materialTitle?: string
  audioTimestamp?: string
  audioUrl?: string
  onClose: () => void
}

// 语言代码映射
const LANGUAGE_MAP: Record<string, keyof WordDefinition['definitions']> = {
  'zh': 'zh-CN',
  'zh_hant': 'zh-Hant',
  'vi': 'vi',
  'hide': 'zh-CN'  // 默认简体中文
}

export default function WordTooltip({
  word,
  definition,
  loading,
  position,
  sentence,
  materialId,
  materialTitle,
  audioTimestamp,
  audioUrl,
  onClose
}: WordTooltipProps) {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [currentLanguage, setCurrentLanguage] = useState<keyof WordDefinition['definitions']>('zh-CN')

  // 🔴 音频相关状态
  const [audioUrls, setAudioUrls] = useState<{ us: string | null; uk: string | null }>({ us: null, uk: null })
  const [loadingAudio, setLoadingAudio] = useState(false)
  const usAudioRef = useRef<HTMLAudioElement | null>(null)
  const ukAudioRef = useRef<HTMLAudioElement | null>(null)

  // 🔴 预加载音频：当 Tooltip 弹出且单词定义加载完成时
  useEffect(() => {
    const fetchAudioUrls = async () => {
      if (!definition || loadingAudio) return

      setLoadingAudio(true)
      try {
        // 优先从 dictionaryapi.dev 获取
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${definition.word}`)
        if (response.ok) {
          const data = await response.json()
          const phonetics = data[0]?.phonetics || []

          let usAudio: string | null = null
          let ukAudio: string | null = null

          // 查找美音和英音
          for (const phonetic of phonetics) {
            if (phonetic.audio && phonetic.audio.endsWith('.mp3')) {
              const audioUrl = phonetic.audio
              // 判断是美音还是英音
              if (!usAudio && (phonetic.text?.includes('US') || audioUrl.includes('-us'))) {
                usAudio = audioUrl
              } else if (!ukAudio && (phonetic.text?.includes('UK') || audioUrl.includes('-uk'))) {
                ukAudio = audioUrl
              }
            }
          }

          // 如果只找到一个，且没有明确标记，默认为美音
          if (!usAudio && !ukAudio && phonetics.length > 0) {
            const firstAudio = phonetics.find(p => p.audio)?.audio
            if (firstAudio) {
              usAudio = firstAudio
            }
          }

          // 设置音频 URL（只设置找到的音频，不使用 Google TTS 兜底）
          setAudioUrls({
            us: usAudio || null,
            uk: ukAudio || null
          })
        } else {
          throw new Error('API request failed')
        }
      } catch (error) {
        console.log('Dictionary API 失败，无法获取音频')
        // 设置为 null，禁用音频按钮
        setAudioUrls({
          us: null,
          uk: null
        })
      } finally {
        setLoadingAudio(false)
      }
    }

    fetchAudioUrls()
  }, [definition])

  // 🔴 预加载音频文件到内存
  useEffect(() => {
    if (audioUrls.us && !usAudioRef.current) {
      const audio = new Audio(audioUrls.us)
      audio.load()
      usAudioRef.current = audio
    }
    if (audioUrls.uk && !ukAudioRef.current) {
      const audio = new Audio(audioUrls.uk)
      audio.load()
      ukAudioRef.current = audio
    }
  }, [audioUrls])

  // 🔴 播放音频（阻止事件冒泡）
  const playAudio = (variant: 'us' | 'uk', event?: React.MouseEvent) => {
    // 阻止事件冒泡到父元素（避免触发句子播放）
    if (event) {
      event.stopPropagation()
    }

    const audioRef = variant === 'us' ? usAudioRef : ukAudioRef
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(err => console.error('播放失败:', err))
    }
  }

  // 实时同步全局翻译语言设置
  useEffect(() => {
    const updateLanguage = () => {
      const storedLang = getStoredLanguage()
      const mappedLang = LANGUAGE_MAP[storedLang] || 'zh-CN'
      setCurrentLanguage(mappedLang)
    }

    // 初始化语言
    updateLanguage()

    // 监听 storage 变化（实现跨标签页同步）
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'translation-language') {
        updateLanguage()
      }
    }

    // 监听自定义事件（实现同页面内同步）
    const handleLanguageChange = () => {
      updateLanguage()
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('translation-language-change', handleLanguageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('translation-language-change', handleLanguageChange)
    }
  }, [])

  // 获取当前语言释义
  const getCurrentDefinition = () => {
    if (!definition) return ''
    return definition.definitions[currentLanguage] || definition.definitions['zh-CN'] || ''
  }

  // 获取英文释义（作为对照）
  const getEnglishDefinition = () => {
    if (!definition) return ''
    return definition.definitions['en'] || ''
  }

  // 保存生词到数据库
  const handleSaveWord = async () => {
    if (!user) {
      setMessage({ type: 'error', text: '请先登录' })
      setTimeout(() => setMessage(null), 2000)
      return
    }

    if (!definition) {
      setMessage({ type: 'error', text: '单词信息加载失败' })
      setTimeout(() => setMessage(null), 2000)
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/user-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.id}` },
        body: JSON.stringify({
          userId: user.id,
          word: definition.word,
          phonetic: definition.phonetic,
          definition: JSON.stringify(definition.definitions),  // 存储多语言 JSON
          contextSentence: sentence,
          materialId,
          materialTitle,
          audioTimestamp,
          audioUrl
        })
      })

      const data = await response.json()

      if (data.success) {
        setSaved(true)
        setMessage({
          type: 'success',
          text: data.isNew ? '已加入学习列表' : '已更新为学习中'
        })
        setTimeout(() => {
          onClose()
        }, 1000)
      } else {
        setMessage({ type: 'error', text: data.error || '保存失败' })
        setTimeout(() => setMessage(null), 2000)
      }
    } catch (error) {
      console.error('保存生词失败:', error)
      setMessage({ type: 'error', text: '网络错误，请重试' })
      setTimeout(() => setMessage(null), 2000)
    } finally {
      setSaving(false)
    }
  }

  // 计算位置：确保气泡不超出屏幕边界
  const getPositionStyle = () => {
    const tooltipWidth = 320
    const tooltipHeight = 280

    let x = position.x
    let y = position.y

    // 防止超出右边
    if (x + tooltipWidth > window.innerWidth - 20) {
      x = window.innerWidth - tooltipWidth - 20
    }

    // 防止超出底部
    if (y + tooltipHeight > window.innerHeight - 20) {
      y = position.y - tooltipHeight - 10
    }

    return { left: `${x}px`, top: `${y}px` }
  }

  const currentDef = getCurrentDefinition()
  const englishDef = getEnglishDefinition()

  return (
    <div
      className="fixed z-50 w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-4 animate-in fade-in zoom-in duration-200"
      style={getPositionStyle()}
    >
      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* 内容区域 */}
      {!loading && definition && (
        <div className="space-y-4">
          {/* 第一行：单词 */}
          <div>
            <h3 className="text-2xl font-bold text-gray-900">
              {definition.word}
            </h3>
          </div>

          {/* 第二行：音标 + 发音按钮 */}
          <div className="flex items-center gap-3">
            {definition.phonetic && (
              <p className="text-sm text-gray-500">{definition.phonetic}</p>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => playAudio('us', e)}
                disabled={!audioUrls.us || loadingAudio}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="美音"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span className="font-medium">US</span>
              </button>
              <button
                onClick={(e) => playAudio('uk', e)}
                disabled={!audioUrls.uk || loadingAudio}
                className="flex items-center gap-1 px-2 py-1 text-xs text-purple-600 hover:bg-purple-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="英音"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span className="font-medium">UK</span>
              </button>
            </div>
          </div>

          {/* 第二行：当前语言释义（大字）+ 英文对照 */}
          <div className="space-y-2">
            <p className="text-lg font-semibold text-gray-900 leading-relaxed">
              {currentDef}
            </p>
            {englishDef && currentLanguage !== 'en' && (
              <p className="text-sm text-gray-500 italic">
                {englishDef}
              </p>
            )}
          </div>

          {/* 第三行：例句 */}
          {definition.example && (
            <div className="bg-gray-50 rounded-lg p-3 border-l-4 border-blue-500">
              <p className="text-sm text-gray-700 italic">{definition.example}</p>
            </div>
          )}

          {/* 底部：加入生词本按钮 */}
          <div className="pt-2">
            <button
              onClick={handleSaveWord}
              disabled={saving || saved}
              className={`w-full px-4 py-3 rounded-lg transition-all font-medium text-base ${
                saved
                  ? 'bg-green-600 text-white cursor-default'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {saved ? '✓ 已添加' : saving ? '保存中...' : '加入生词本'}
            </button>
          </div>

          {/* 消息提示 */}
          {message && (
            <div className={`text-sm text-center py-2 rounded-lg ${
              message.type === 'success' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
            }`}>
              {message.text}
            </div>
          )}
        </div>
      )}

      {/* 错误状态 */}
      {!loading && !definition && (
        <div className="text-center py-4 text-gray-500">
          未找到该单词的释义
        </div>
      )}
    </div>
  )
}
