/**
 * 多语言翻译类型定义
 * 支持 ISO 639-1 语言代码
 */
export interface Translation {
  [langCode: string]: string | undefined
}

/**
 * 挖空词数据类型
 */
export interface Blank {
  word: string    // 被挖空的单词
  index: number   // 单词在句子中的位置（基于空格分割）
  pos: string     // 词性标注（如 NN, VB, JJ 等）
  is_core: boolean  // 是否为核心词汇
}

/**
 * 句子数据类型（支持多语言翻译）
 */
export interface Sentence {
  id: number
  text: string
  startTime: number | string  // 🔴 允许字符串以保留精度 (如 "9.10")
  endTime: number | string     // 🔴 允许字符串以保留精度
  translation?: Translation   // 多语言翻译 JSONB 格式：{"zh": "中文", "en": "English", ...}
  blanks?: Blank[]            // 挖空词配置（可选，用于智能挖空）
}

/**
 * 获取指定语言的翻译文本
 * @param translation 翻译对象
 * @param langCode 语言代码（默认 'zh'）
 * @returns 翻译文本，如果不存在则返回 undefined
 */
export function getTranslation(
  translation: Translation | undefined,
  langCode: string = 'zh'
): string | undefined {
  return translation?.[langCode]
}

/**
 * 检查翻译是否包含指定语言
 * @param translation 翻译对象
 * @param langCode 语言代码
 * @returns 是否包含该语言的翻译
 */
export function hasTranslation(
  translation: Translation | undefined,
  langCode: string
): boolean {
  return translation != null && langCode in translation && translation[langCode] !== ''
}
