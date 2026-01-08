'use client'

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg'
    color?: 'white' | 'orange' | 'teal' | 'gray'
    text?: string
}

export default function LoadingSpinner({
    size = 'md',
    color = 'white',
    text
}: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
        lg: 'w-8 h-8'
    }

    const colorClasses = {
        white: 'border-white border-t-transparent',
        orange: 'border-orange-500 border-t-transparent',
        teal: 'border-teal-500 border-t-transparent',
        gray: 'border-gray-400 border-t-transparent'
    }

    return (
        <div className="flex items-center justify-center gap-2">
            <div
                className={`${sizeClasses[size]} border-2 ${colorClasses[color]} rounded-full animate-spin`}
            />
            {text && <span>{text}</span>}
        </div>
    )
}

// Full page/section loading overlay
export function LoadingOverlay({ text = 'Loading...' }: { text?: string }) {
    return (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-600 font-medium">{text}</span>
            </div>
        </div>
    )
}

// Skeleton loader for content
export function SkeletonLoader({ lines = 3 }: { lines?: number }) {
    return (
        <div className="animate-pulse space-y-3">
            {Array.from({ length: lines }).map((_, i) => (
                <div
                    key={i}
                    className="h-4 bg-gray-200 rounded"
                    style={{ width: `${Math.random() * 40 + 60}%` }}
                />
            ))}
        </div>
    )
}
