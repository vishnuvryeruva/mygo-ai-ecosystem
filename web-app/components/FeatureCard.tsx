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
  return (
    <div
      onClick={onClick}
      className={`feature-card ${variant}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="feature-icon">
        <span className="animate-float">{icon}</span>
      </div>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-description">{description}</p>

      {/* Hover Arrow */}
      <div className="absolute bottom-6 right-6 opacity-0 transform translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-indigo-400"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  )
}
