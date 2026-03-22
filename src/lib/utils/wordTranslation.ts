/**
 * 单词翻译工具函数
 *
 * 使用智谱 GLM-4-Flash API 进行单词翻译
 */

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

/**
 * 调用 GLM API 获取单词定义
 *
 * @param word - 要翻译的单词
 * @returns 单词定义
 */
export async function fetchWordDefinition(word: string): Promise<WordDefinition | null> {
  if (!word || word.trim().length === 0) {
    return null
  }

  const normalizedWord = word.toLowerCase().trim()

  try {
    // 使用 GLM API 获取单词定义
    const glmResult = await fetchGLMDefinition(normalizedWord)
    if (glmResult) {
      return glmResult
    }

    return null
  } catch (error) {
    console.error('获取单词定义失败:', error)
    return null
  }
}

/**
 * 智谱 GLM-4-Flash API
 *
 * API 说明：
 * - URL: https://open.bigmodel.cn/api/paas/v4/chat/completions
 * - Model: glm-4-flash（更快、更便宜）
 * - 需要从环境变量获取 GLM_API_KEY
 *
 * 注意：此函数需要在服务端调用，避免暴露 API Key
 */
async function fetchGLMDefinition(word: string): Promise<WordDefinition | null> {
  try {
    // 调用 Next.js API 路由，避免在前端暴露 API Key
    const response = await fetch('/api/word-definition', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ word })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.warn('GLM API 请求失败:', errorData)
      return null
    }

    const data = await response.json()

    if (data.success && data.definition) {
      // 返回定义，包含音频 URL
      return {
        ...data.definition,
        audioUrls: data.audioUrls || { us: null, uk: null }
      }
    }

    return null
  } catch (error) {
    console.error('GLM API 调用失败:', error)
    return null
  }
}

/**
 * 检查字符串是否为有效的单词
 *
 * 规则：
 * - 只包含字母
 * - 长度 >= 2
 * - 不是纯数字
 */
export function isValidWord(token: string): boolean {
  const trimmed = token.trim()
  if (trimmed.length < 2) {
    return false
  }

  // 检查是否包含至少一个字母
  const hasLetter = /[a-zA-Z]/.test(trimmed)

  // 检查是否只包含字母和连字符
  const onlyLettersAndHyphen = /^[a-zA-Z-]+$/.test(trimmed)

  return hasLetter && onlyLettersAndHyphen
}

/**
 * 分词：将句子拆分为单词和分隔符
 *
 * 返回：Token 数组，每个 Token 包含：
 * - text: 文本内容
 * - isWord: 是否为可点击的单词
 * - originalWord: 原始单词（用于 API 调用）
 */
export function tokenizeSentence(sentence: string): Array<{
  text: string
  isWord: boolean
  originalWord?: string
}> {
  const tokens: Array<{
    text: string
    isWord: boolean
    originalWord?: string
  }> = []

  // 使用正则表达式分割：保留单词和分隔符（空格、标点符号）
  const parts = sentence.split(/([a-zA-Z-]+|[^a-zA-Z]+)/g)

  for (const part of parts) {
    if (!part) continue

    const trimmedPart = part.trim()

    // 检查是否为有效单词
    if (isValidWord(trimmedPart)) {
      tokens.push({
        text: part,
        isWord: true,
        originalWord: trimmedPart
      })
    } else {
      // 分隔符（空格、标点符号等）
      tokens.push({
        text: part,
        isWord: false
      })
    }
  }

  return tokens
}
