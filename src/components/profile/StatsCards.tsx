/**
 * Stats Cards Component
 *
 * Displays statistics separated by practice mode:
 * - Dictation: Total Practices, Average Accuracy, Today's Practices
 * - Shadowing: Total Practices, Average Accuracy, Today's Practices
 */

'use client'

interface ModeStats {
  totalPractices: number
  averageAccuracy: number
  todayPractices: number
}

interface StatsCardsProps {
  dictation: ModeStats
  shadowing: ModeStats
}

export default function StatsCards({
  dictation,
  shadowing,
}: StatsCardsProps) {
  const getColorClasses = (color: string) => {
    const colors = {
      blue: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-700',
        icon: 'bg-blue-100',
      },
      green: {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-700',
        icon: 'bg-green-100',
      },
      purple: {
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        text: 'text-purple-700',
        icon: 'bg-purple-100',
      },
      orange: {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        text: 'text-orange-700',
        icon: 'bg-orange-100',
      },
    }
    return colors[color as keyof typeof colors] || colors.blue
  }

  const renderStatCard = (
    label: string,
    value: number,
    unit: string,
    color: string,
    icon: string
  ) => {
    const colorClasses = getColorClasses(color)
    return (
      <div
        className={`${colorClasses.bg} ${colorClasses.border} border rounded-lg p-4`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-xs font-medium ${colorClasses.text} mb-1`}>
              {label}
            </p>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold ${colorClasses.text}`}>
                {value}
              </span>
              <span className={`text-xs ${colorClasses.text} opacity-70`}>
                {unit}
              </span>
            </div>
          </div>
          <div className={`${colorClasses.icon} w-10 h-10 rounded-lg flex items-center justify-center text-xl`}>
            {icon}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 mb-6">
      {/* Dictation Stats */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <span className="text-2xl">✍️</span>
          听写练习
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {renderStatCard('总练习数', dictation.totalPractices, '次', 'blue', '📝')}
          {renderStatCard('平均正确率', dictation.averageAccuracy, '%', 'green', '🎯')}
          {renderStatCard('今日练习', dictation.todayPractices, '次', 'purple', '📅')}
        </div>
      </div>

      {/* Shadowing Stats */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <span className="text-2xl">🎤</span>
          跟读练习
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {renderStatCard('总练习数', shadowing.totalPractices, '次', 'blue', '📝')}
          {renderStatCard('平均正确率', shadowing.averageAccuracy, '%', 'green', '🎯')}
          {renderStatCard('今日练习', shadowing.todayPractices, '次', 'purple', '📅')}
        </div>
      </div>
    </div>
  )
}
