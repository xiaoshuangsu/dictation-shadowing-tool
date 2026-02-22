/**
 * Practice History Component
 *
 * Displays a list of recent practice records with details.
 */

'use client'

import { formatPracticeMode, formatDate } from '@/utils/analytics'

export interface PracticeRecord {
  id: string
  sentenceText: string
  practiceMode: 'dictation' | 'shadowing'
  dictationMode?: 'word' | 'whole'
  isCorrect: boolean
  usedShowWords: boolean
  completedAt: Date
}

interface PracticeHistoryProps {
  records: PracticeRecord[]
}

export default function PracticeHistory({ records }: PracticeHistoryProps) {
  if (records.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <p className="text-gray-500">No practice records yet</p>
        <p className="text-sm text-gray-400 mt-1">Completed exercises will appear here</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">Recent Practice Records</h3>
      </div>

      <div className="divide-y divide-gray-200">
        {records.map((record) => {
          const modeStyle = formatPracticeMode(record.practiceMode)
          const isDictation = record.practiceMode === 'dictation'

          return (
            <div
              key={record.id}
              className="px-6 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: Status Icon */}
                <div className="flex-shrink-0 pt-1">
                  {record.isCorrect ? (
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Middle: Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    {record.sentenceText}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    {/* Mode Badge */}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded ${
                      isDictation
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {modeStyle}
                      {isDictation && record.dictationMode && (
                        <span className="ml-1">
                          ({record.dictationMode === 'word' ? 'word-by-word' : 'whole sentence'})
                        </span>
                      )}
                    </span>

                    {/* Show Words Badge */}
                    {record.usedShowWords && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">
                        Hint Used
                      </span>
                    )}

                    {/* Date */}
                    <span>•</span>
                    <span>{formatDate(record.completedAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
