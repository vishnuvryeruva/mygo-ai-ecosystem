'use client'

interface FeatureCardProps {
  id: string
  title: string
  description: string
  icon: string
  variant?: 'default' | 'purple' | 'cyan' | 'pink' | 'orange' | 'green'
  onClick: () => void
}

export default function FeatureCard({
  id,
  title,
  description,
  icon,
  variant = 'default',
  onClick
}: FeatureCardProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'purple': return 'bg-purple-50 text-purple-600 border-purple-100 group-hover:bg-purple-100'
      case 'cyan': return 'bg-cyan-50 text-cyan-600 border-cyan-100 group-hover:bg-cyan-100'
      case 'pink': return 'bg-pink-50 text-pink-600 border-pink-100 group-hover:bg-pink-100'
      case 'orange': return 'bg-orange-50 text-orange-600 border-orange-100 group-hover:bg-orange-100'
      case 'green': return 'bg-green-50 text-green-600 border-green-100 group-hover:bg-green-100'
      default: return 'bg-gray-50 text-gray-600 border-slate-100 group-hover:bg-gray-100'
    }
  }

  return (
    <div
      onClick={onClick}
      className={`card group cursor-pointer hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-gray-200`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-3xl mb-4 transition-colors border ${getVariantStyles()}`}>
        <span className="animate-float">{icon}</span>
      </div>
      <h3 className="text-lg font-semibold text-heading mb-2 group-hover:text-primary transition-colors">{title}</h3>
      <p className="text-sm text-muted leading-relaxed">{description}</p>

      {/* Hover Arrow */}
      <div className="absolute bottom-6 right-6 opacity-0 transform translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-gray-400 group-hover:text-primary"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  )
}
