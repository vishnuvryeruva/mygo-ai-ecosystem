'use client'

import ObservabilityPanel from '@/components/pages/ObservabilityPanel'
import { usePageHeader } from '@/context/PageHeaderContext'

export default function ObservabilityRoute() {
  usePageHeader({
    title: 'AI Observability',
    subtitle: 'Live execution logs, LLM model routing, latency metrics, and credit telemetry',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#034354" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    )
  })

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ObservabilityPanel />
    </div>
  )
}
