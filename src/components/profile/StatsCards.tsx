/**
 * Stats Cards Component
 *
 * Displays four key statistics cards:
 * - Total Practices
 * - Average Accuracy
 * - Today's Practices
 * - Current Streak (optional)
 */

'use client'

interface StatsCardsProps {
  totalPractices: number
  averageAccuracy: number
  todayPractices: number
}

export default function StatsCards({
  totalPractices,
  averageAccuracy,
  todayPractices,
}: StatsCardsProps) {
  const stats = [
    {
      label: '总练习数',
      value: totalPractices,
      unit: '次',
      color: 'blue',
      icon: '📝',
    },
    {
      label: '平均正确率',
      value: averageAccuracy,
      unit: '%',
      color: 'green',
      icon: '🎯',
    },
    {
      label: '今日练习',
      value: todayPractices,
      unit: '次',
      color: 'purple',
      icon: '📅',
    },
  ]

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
    }
    return colors[color as keyof typeof colors] || colors.blue
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {stats.map((stat) => {
        const colorClasses = getColorClasses(stat.color)
        return (
          <div
            key={stat.label}
            className={`${colorClasses.bg} ${colorClasses.border} border rounded-lg p-6`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${colorClasses.text} mb-1`}>
                  {stat.label}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className={`text-3xl font-bold ${colorClasses.text}`}>
                    {stat.value}
                  </span>
                  <span className={`text-sm ${colorClasses.text} opacity-70`}>
                    {stat.unit}
                  </span>
                </div>
              </div>
              <div className={`${colorClasses.icon} w-12 h-12 rounded-lg flex items-center justify-center text-2xl`}>
                {stat.icon}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
