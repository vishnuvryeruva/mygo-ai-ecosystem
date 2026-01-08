'use client'

interface FeatureCardProps {
  feature: {
    id: string
    title: string
    description: string
    icon: string
    color: 'orange' | 'teal'
  }
  onClick: () => void
}

export default function FeatureCard({ feature, onClick }: FeatureCardProps) {
  const colorClasses = {
    orange: 'bg-orange-50 border-orange-200 hover:border-orange-400',
    teal: 'bg-teal-50 border-teal-200 hover:border-teal-400'
  }

  const iconColorClasses = {
    orange: 'text-orange-600',
    teal: 'text-teal-600'
  }

  return (
    <div
      onClick={() => {
        console.log('Card clicked:', feature.id)
        onClick()
      }}
      className={`bg-white rounded-lg border-2 p-6 cursor-pointer transition-all hover:shadow-lg ${colorClasses[feature.color]}`}
    >
      <div className={`text-4xl mb-4 ${iconColorClasses[feature.color]}`}>
        {feature.icon}
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        {feature.title}
      </h3>
      <p className="text-gray-600 text-sm leading-relaxed">
        {feature.description}
      </p>
    </div>
  )
}

