'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import axios from 'axios'

interface TraceNode {
  node: string
  description: string
  timestamp: number
  state_delta?: Record<string, any>
}

interface ExecutionTrace {
  id: string
  trace_id: string
  user_id: string
  agent_name: string
  llm_provider: string
  model_name: string
  status: string
  execution_time_ms: number
  latency_ms: number
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  credits_used: number
  credits_deducted: number
  input_text: string
  output_text: string
  error_message?: string
  nodes?: TraceNode[]
  metadata?: Record<string, any>
  created_at: string
}

interface CreditsInfo {
  user_id: string
  balance: number
  total_allocated: number
  total_used: number
  tier: string
  last_updated: string
}

interface StatsInfo {
  total_calls: number
  total_tokens: number
  total_credits_used: number
  avg_latency_ms: number
  success_calls: number
  error_calls: number
  success_rate: number
}

const agentIcons: Record<string, string> = {
  'Ask Yoda': '🧙‍♂️',
  'Code Advisor': '🧠',
  'Explain Code': '💡',
  'Code Explainer': '💡',
  'Spec Assistant': '📑',
  'Test Case Generator': '🧪',
  'Solution Advisor': '🏛️',
  'Prompt Generator': '✨',
  'Code Refactor': '🔨',
  'MYGO_Agent': '🤖',
}

const getAgentIcon = (name: string): string => {
  for (const key of Object.keys(agentIcons)) {
    if (name.toLowerCase().includes(key.toLowerCase())) {
      return agentIcons[key]
    }
  }
  return '⚡'
}

const providerColors: Record<string, { bg: string; text: string; border: string }> = {
  gemini: { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe' },
  openai: { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },
  claude: { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
  azure: { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd' },
}

export default function ObservabilityPanel() {
  const [credits, setCredits] = useState<CreditsInfo | null>(null)
  const [stats, setStats] = useState<StatsInfo | null>(null)
  const [traces, setTraces] = useState<ExecutionTrace[]>([])
  const [loading, setLoading] = useState(true)

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [agentFilter, setAgentFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Expanded trace IDs (Set for multi-expand)
  const [expandedTraceIds, setExpandedTraceIds] = useState<Set<string>>(new Set())

  // Credits Modal
  const [isTopUpOpen, setIsTopUpOpen] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState(1000)
  const [isAllocating, setIsAllocating] = useState(false)

  // Copy toast feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [credRes, traceRes, statsRes] = await Promise.all([
        axios.get('/api/credits/balance'),
        axios.get('/api/observability/traces?limit=150'),
        axios.get('/api/observability/stats')
      ])
      setCredits(credRes.data)
      setTraces(traceRes.data.traces || [])
      setStats(statsRes.data)
    } catch (err) {
      console.error('Error fetching observability data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 8000)
    return () => clearInterval(interval)
  }, [fetchData])

  const toggleExpand = (id: string) => {
    setExpandedTraceIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpandedTraceIds(new Set(filteredTraces.map(t => t.id || t.trace_id)))
  }

  const collapseAll = () => {
    setExpandedTraceIds(new Set())
  }

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleTopUp = async () => {
    setIsAllocating(true)
    try {
      const res = await axios.post('/api/credits/allocate', {
        amount: topUpAmount,
        reason: 'User Top-Up'
      })
      if (res.data.success) {
        setCredits(res.data.credits)
        setIsTopUpOpen(false)
        await fetchData()
      }
    } catch (err) {
      console.error('Failed to allocate credits:', err)
    } finally {
      setIsAllocating(false)
    }
  }

  const handleClearTraces = async () => {
    if (!window.confirm('Are you sure you want to clear all recorded AI logs from the database? This cannot be undone.')) {
      return
    }
    try {
      await axios.delete('/api/observability/traces')
      await fetchData()
    } catch (err) {
      console.error('Failed to clear traces:', err)
    }
  }

  // Filter traces
  const filteredTraces = useMemo(() => {
    return traces.filter(t => {
      const matchesAgent = agentFilter === 'ALL' || t.agent_name.toLowerCase() === agentFilter.toLowerCase()
      const matchesStatus = statusFilter === 'ALL' || t.status.toUpperCase() === statusFilter.toUpperCase()
      const searchLower = searchQuery.toLowerCase().trim()
      const matchesSearch = !searchLower ||
        t.agent_name.toLowerCase().includes(searchLower) ||
        (t.model_name || '').toLowerCase().includes(searchLower) ||
        (t.llm_provider || '').toLowerCase().includes(searchLower) ||
        (t.input_text || '').toLowerCase().includes(searchLower) ||
        (t.output_text || '').toLowerCase().includes(searchLower)
      return matchesAgent && matchesStatus && matchesSearch
    })
  }, [traces, agentFilter, statusFilter, searchQuery])

  // Extract unique agents for dropdown filter
  const uniqueAgents = useMemo(() => {
    return Array.from(new Set(traces.map(t => t.agent_name).filter(Boolean))).sort()
  }, [traces])

  return (
    <div className="space-y-6">
      {/* ── Top Overview & Metrics Bar ──────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-800/40 rounded-2xl p-6 shadow-xl text-white">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl">📊</span>
              <div>
                <h3 className="text-xl font-bold tracking-tight">AI Agent Observability & Telemetry</h3>
                <p className="text-indigo-200/80 text-sm">
                  Full database execution logs, LLM model routing, latency metrics, token breakdowns, and credit consumption
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsTopUpOpen(true)}
              className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
            >
              <span>💳</span> Manage Credits
            </button>
            <button
              onClick={fetchData}
              className="px-3 py-2 bg-indigo-900/60 hover:bg-indigo-800/60 border border-indigo-700/50 rounded-xl text-xs transition flex items-center gap-1"
            >
              <span>🔄</span> Refresh
            </button>
            {traces.length > 0 && (
              <button
                onClick={handleClearTraces}
                className="px-3 py-2 bg-rose-900/30 hover:bg-rose-900/50 border border-rose-700/40 text-rose-300 rounded-xl text-xs transition"
                title="Clear all trace logs from database"
              >
                🗑️ Clear Logs
              </button>
            )}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3.5">
            <div className="text-xs font-medium text-slate-400">Total AI Calls</div>
            <div className="text-2xl font-bold text-sky-400 mt-1">{stats?.total_calls ?? traces.length}</div>
            <div className="text-[10px] text-emerald-400 font-semibold mt-1">
              ✓ {stats?.success_rate ?? 100}% Success Rate
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3.5">
            <div className="text-xs font-medium text-slate-400">Available Credits</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              {credits ? credits.balance.toLocaleString() : '5,000'}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Tier: <span className="text-indigo-300 font-semibold">{credits?.tier || 'ENTERPRISE'}</span>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3.5">
            <div className="text-xs font-medium text-slate-400">Credits Consumed</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">
              {stats ? stats.total_credits_used.toLocaleString() : (credits?.total_used ?? 0).toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Deducted per token rate</div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3.5">
            <div className="text-xs font-medium text-slate-400">Total Tokens</div>
            <div className="text-2xl font-bold text-purple-400 mt-1">
              {stats ? stats.total_tokens.toLocaleString() : 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Prompt + Completion</div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3.5">
            <div className="text-xs font-medium text-slate-400">Avg Execution Time</div>
            <div className="text-2xl font-bold text-teal-400 mt-1">
              {stats?.avg_latency_ms ?? 0} ms
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Pipeline & LLM inference</div>
          </div>
        </div>
      </div>

      {/* ── Filters & Controls Bar ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2"
              className="absolute left-3 top-1/2 -translate-y-1/2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search agent calls by prompt, output, model..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-indigo-500 bg-slate-50/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Agent Filter */}
          <select
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value)}
            className="text-xs py-2 px-3 border border-slate-200 rounded-lg outline-none bg-white font-medium text-slate-700"
          >
            <option value="ALL">All Agents</option>
            {uniqueAgents.map(ag => (
              <option key={ag} value={ag}>{ag}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs py-2 px-3 border border-slate-200 rounded-lg outline-none bg-white font-medium text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUCCESS">Success Only</option>
            <option value="ERROR">Error Only</option>
          </select>
        </div>

        {/* Expand / Collapse Actions */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">
            <strong>{filteredTraces.length}</strong> calls found
          </span>
          <div className="h-4 w-[1px] bg-slate-200 mx-1"></div>
          <button
            onClick={expandAll}
            className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* ── AI Agent Calls List View (Expandable Rows) ──────────────────── */}
      <div className="space-y-3">
        {loading && traces.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-500 rounded-full border-t-transparent mx-auto mb-3"></div>
            <p className="text-sm font-medium text-slate-600">Loading AI execution logs from database...</p>
          </div>
        ) : filteredTraces.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-400">
            <span className="text-4xl block mb-2">🔍</span>
            <p className="text-sm font-semibold text-slate-700">No AI agent calls match the current filters</p>
            <p className="text-xs text-slate-400 mt-1">
              Trigger any agent like Ask Yoda, Code Advisor, or Spec Assistant to see full live execution telemetry here.
            </p>
          </div>
        ) : (
          filteredTraces.map((trace, index) => {
            const traceId = trace.id || trace.trace_id || `trace_${index}`
            const isExpanded = expandedTraceIds.has(traceId)
            const providerKey = (trace.llm_provider || 'gemini').toLowerCase()
            const provColor = providerColors[providerKey] || providerColors.gemini

            return (
              <div
                key={traceId}
                className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden shadow-sm ${
                  isExpanded ? 'border-indigo-300 ring-2 ring-indigo-500/10' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* ── Collapsed Header Row ── */}
                <div
                  onClick={() => toggleExpand(traceId)}
                  className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none bg-slate-50/40 hover:bg-slate-50 transition-colors"
                >
                  {/* Left: Agent, Model, Status */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-2xl" title={trace.agent_name}>
                      {getAgentIcon(trace.agent_name)}
                    </span>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 tracking-tight">
                          {trace.agent_name}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider"
                          style={{
                            backgroundColor: provColor.bg,
                            color: provColor.text,
                            border: `1px solid ${provColor.border}`
                          }}
                        >
                          {trace.llm_provider} · {trace.model_name || 'standard'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            trace.status === 'SUCCESS'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {trace.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>📅 {new Date(trace.created_at).toLocaleString()}</span>
                        <span>•</span>
                        <span className="font-mono text-[10px] text-slate-400 truncate max-w-xs">
                          ID: {trace.trace_id}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Metrics & Expand Toggle */}
                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-right hidden sm:block">
                      <div className="flex items-center gap-3 font-medium text-slate-700">
                        <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-mono font-semibold">
                          ⏱️ {trace.execution_time_ms || trace.latency_ms} ms
                        </span>
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-mono font-semibold">
                          🪙 {trace.credits_used || trace.credits_deducted} cr
                        </span>
                        <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-mono">
                          🔤 {trace.total_tokens} tokens
                        </span>
                      </div>
                    </div>

                    <button
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
                      title={isExpanded ? 'Collapse' : 'Expand full details'}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* ── Expanded Detail View ── */}
                {isExpanded && (
                  <div className="p-5 border-t border-slate-200 bg-white space-y-5 animate-in fade-in duration-150">
                    {/* Key Attributes Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Agent Name</span>
                        <span className="font-semibold text-slate-800">{trace.agent_name}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">LLM Provider</span>
                        <span className="font-semibold text-indigo-700 uppercase">{trace.llm_provider}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Model</span>
                        <span className="font-semibold font-mono text-slate-800">{trace.model_name}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Execution Time</span>
                        <span className="font-semibold font-mono text-emerald-700">{trace.execution_time_ms || trace.latency_ms} ms</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Credits Used</span>
                        <span className="font-semibold font-mono text-amber-700">{trace.credits_used || trace.credits_deducted} credits</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Token Metrics</span>
                        <span className="font-semibold font-mono text-slate-700">
                          {trace.prompt_tokens} in / {trace.completion_tokens} out ({trace.total_tokens} total)
                        </span>
                      </div>
                    </div>

                    {/* Error Box if Failed */}
                    {trace.status === 'ERROR' && trace.error_message && (
                      <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                        <div className="font-bold flex items-center gap-1.5 mb-1">
                          <span>⚠️</span> Execution Failure Reason:
                        </div>
                        <pre className="font-mono whitespace-pre-wrap text-rose-700 text-[11px]">{trace.error_message}</pre>
                      </div>
                    )}

                    {/* Input Prompt Block */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-slate-100 px-4 py-2 flex items-center justify-between border-b border-slate-200">
                        <span className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
                          <span>📥</span> Full Input Prompt
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 font-mono">
                            {trace.input_text ? trace.input_text.length : 0} characters
                          </span>
                          <button
                            onClick={() => handleCopy(trace.input_text, `in_${traceId}`)}
                            className="text-xs px-2.5 py-0.5 rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 transition"
                          >
                            {copiedKey === `in_${traceId}` ? '✓ Copied!' : 'Copy Input'}
                          </button>
                        </div>
                      </div>
                      <div className="p-4 bg-slate-950 max-h-64 overflow-y-auto">
                        <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {trace.input_text || 'No input prompt provided.'}
                        </pre>
                      </div>
                    </div>

                    {/* Output Response Block */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-slate-100 px-4 py-2 flex items-center justify-between border-b border-slate-200">
                        <span className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
                          <span>📤</span> Full AI Agent Output
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 font-mono">
                            {trace.output_text ? trace.output_text.length : 0} characters
                          </span>
                          <button
                            onClick={() => handleCopy(trace.output_text, `out_${traceId}`)}
                            className="text-xs px-2.5 py-0.5 rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 transition"
                          >
                            {copiedKey === `out_${traceId}` ? '✓ Copied!' : 'Copy Output'}
                          </button>
                        </div>
                      </div>
                      <div className="p-4 bg-slate-950 max-h-96 overflow-y-auto">
                        <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap leading-relaxed selection:bg-emerald-800 selection:text-white">
                          {trace.output_text || 'No response generated.'}
                        </pre>
                      </div>
                    </div>

                    {/* Step-by-Step Graph Pipeline (if available) */}
                    {trace.nodes && trace.nodes.length > 0 && (
                      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                        <span className="font-bold text-xs text-slate-700 block mb-3">
                          🔄 Execution Node Pipeline:
                        </span>
                        <div className="space-y-2">
                          {trace.nodes.map((node, nodeIdx) => (
                            <div key={nodeIdx} className="flex items-start gap-3 bg-white p-2.5 rounded-lg border border-slate-200 text-xs">
                              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                                {nodeIdx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono font-bold text-indigo-900">{node.node}</span>
                                  {node.timestamp && (
                                    <span className="text-[10px] text-slate-400">
                                      {new Date(node.timestamp * 1000).toLocaleTimeString()}
                                    </span>
                                  )}
                                </div>
                                <p className="text-slate-600 mt-0.5">{node.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* ── Manage AI Credits Modal ─────────────────────────────────────── */}
      {isTopUpOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <span>💳</span> Manage AI Credits
              </h3>
              <button onClick={() => setIsTopUpOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div>
              <p className="text-xs text-slate-300">
                Allocate additional AI credits to your account. Credits are deducted per token rate across live LLM inference calls.
              </p>
              <div className="mt-4">
                <label className="block text-xs font-semibold text-slate-400 mb-2">Select Credit Allocation Amount</label>
                <div className="grid grid-cols-3 gap-2">
                  {[500, 1000, 5000].map(amt => (
                    <button
                      key={amt}
                      onClick={() => setTopUpAmount(amt)}
                      className={`py-2.5 rounded-xl border text-xs font-bold transition ${
                        topUpAmount === amt
                          ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      +{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setIsTopUpOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleTopUp}
                disabled={isAllocating}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition flex items-center gap-2"
              >
                {isAllocating ? 'Allocating...' : 'Confirm Allocation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
