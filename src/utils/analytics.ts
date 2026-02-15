/**
 * Analytics Utilities
 *
 * Helper functions for calculating statistics from practice data.
 */

export interface PracticeStats {
  totalPractices: number
  totalCorrect: number
  averageAccuracy: number
  todayPractices: number
  lastPracticeDate: string | null
}

/**
 * Calculate average accuracy percentage
 */
export function calculateAccuracy(totalCorrect: number, totalPractices: number): number {
  if (totalPractices === 0) return 0
  return Math.round((totalCorrect / totalPractices) * 100)
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDateString(): string {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

/**
 * Calculate statistics from practice records
 */
export function calculateStats(
  totalPractices: number,
  totalCorrect: number,
  todayPractices: number,
  lastPracticeDate: string | null
): PracticeStats {
  return {
    totalPractices,
    totalCorrect,
    averageAccuracy: calculateAccuracy(totalCorrect, totalPractices),
    todayPractices,
    lastPracticeDate,
  }
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return '今天'
  } else if (diffDays === 1) {
    return '昨天'
  } else if (diffDays < 7) {
    return `${diffDays} 天前`
  } else {
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }
}

/**
 * Format practice mode for display
 */
export function formatPracticeMode(mode: string): string {
  const modeMap: Record<string, string> = {
    dictation: '听写',
    shadowing: '影子跟读',
    word: '逐词听写',
    whole: '整句听写',
  }
  return modeMap[mode] || mode
}

/**
 * Get practice mode icon/color
 */
export function getPracticeModeStyle(mode: string): {
  icon: string
  color: string
  bgColor: string
} {
  const styles: Record<string, { icon: string; color: string; bgColor: string }> = {
    dictation: {
      icon: '✏️',
      color: 'text-blue-700',
      bgColor: 'bg-blue-50',
    },
    shadowing: {
      icon: '🎤',
      color: 'text-purple-700',
      bgColor: 'bg-purple-50',
    },
  }

  return styles[mode] || styles.dictation
}
