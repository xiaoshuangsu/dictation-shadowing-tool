/**
 * ClickableOriginalText - 可点击单词的原文展示组件
 *
 * 功能：
 * - 渲染中栏练习区的 Original Text
 * - 每个单词可点击（使用通用的 ClickableWord 组件）
 * - 支持智能状态感知（Dictation 模式下的隐藏单词）
 */

'use client'

import ClickableWord from './ClickableWord'
import { tokenizeSentence } from '@/lib/utils/wordTranslation'

interface ClickableOriginalTextProps {
  text: string
  isHidden?: boolean  // Dictation 模式下是否隐藏
  materialId?: string
  materialTitle?: string
  className?: string
}

export default function ClickableOriginalText({
  text,
  isHidden = false,
  materialId,
  materialTitle,
  className = ''
}: ClickableOriginalTextProps) {
  // 如果完全隐藏（占位模式），返回不可见文本
  if (isHidden) {
    return <span className={`invisible ${className}`}>{text}</span>
  }

  // 分词并渲染可点击单词
  const tokens = tokenizeSentence(text)

  return (
    <p className={`text-lg leading-relaxed ${className}`}>
      {tokens.map((token, index) => {
        if (token.isWord) {
          return (
            <ClickableWord
              key={index}
              word={token.text}
              originalWord={token.originalWord}
              contextSentence={text}
              isHidden={false}
              materialId={materialId}
              materialTitle={materialTitle}
            />
          )
        } else {
          return <span key={index}>{token.text}</span>
        }
      })}
    </p>
  )
}
