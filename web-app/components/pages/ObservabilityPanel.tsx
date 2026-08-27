'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

interface TraceNode {
  node: string
  description: string
  timestamp: number
  state_delta?: Record<string, any>
}

interface ExecutionTrace {
  trace_id: string
  agent_name: string
  status: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  credits_deducted: number
  latency_ms: number
  created_at: string
  nodes: TraceNode[]
  input_preview?: string
  output_preview?: string
}

interface CreditsInfo {
  user_id: string
  balance: number
  total_allocated: number
  total_used: number
  tier: string
  last_updated: string
}

export default function ObservabilityPanel() {
  const [credits, setCredits] = useState<CreditsInfo | null>(null)
  const [traces, setTraces] = useState<ExecutionTrace[]>([])
  const [selectedTrace, setSelectedTrace] = useState<ExecutionTrace | null>(null)
  const [loading, setLoading] = useState(true)
  const [agentFilter, setAgentFilter] = useState('ALL')
  const [topUpAmount, setTopUpAmount] = useState(1000)
  const [isTopUpOpen, setIsTopUpOpen] = useState(false)
  const [isAllocating, setIsAllocating] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [credRes, traceRes] = await Promise.all([
        axios.get('/api/credits/balance'),
        axios.get('/api/observability/traces')
      ])
      setCredits(credRes.data)
      setTraces(traceRes.data.traces || [])
      if (traceRes.data.traces && traceRes.data.traces.length > 0) {
        setSelectedTrace(traceRes.data.traces[0])
      }
    } catch (err) {
      console.error('Error fetching observability data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleTopUp = async () => {
    setIsAllocating(true)
    try {
      const response = await axios.post('/api/credits/allocate', {
        amount: topUpAmount,
        reason: 'User Top-Up'
      })
      if (response.data.success) {
        setCredits(response.data.credits)
        setIsTopUpOpen(false)
      }
    } catch (err) {
      console.error('Failed to allocate credits:', err)
    } finally {
      setIsAllocating(false)
    }
  }

  const filteredTraces = traces.filter(t => 
    agentFilter === 'ALL' || t.agent_name.toLowerCase() === agentFilter.toLowerCase()
  )

  const totalTokens = traces.reduce((acc, t) => acc + (t.total_tokens || 0), 0)
  const totalSpent = traces.reduce((acc, t) => acc + (t.credits_deducted || 0), 0)
  const avgLatency = traces.length ? Math.round(traces.reduce((acc, t) => acc + (t.latency_ms || 0), 0) / traces.length) : 0

  return (
    <div className="space-y-6">
      {/* ── Top Overview & AI Credits Banner ────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-800/40 rounded-2xl p-6 shadow-xl text-white">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚡</span>
              <div>
                <h3 className="text-xl font-bold tracking-tight">AI Credits & LangGraph Observability</h3>
                <p className="text-indigo-200/80 text-sm">Real-time LangChain model tracing, execution state graphs & credit consumption telemetry</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsTopUpOpen(true)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-xl transition text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <span>➕</span> Manage AI Credits
            </button>
            <button
              onClick={fetchData}
              className="px-3 py-2 bg-indigo-900/60 hover:bg-indigo-800/60 border border-indigo-700/50 rounded-xl text-xs transition"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Credit Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-400">Available Credits</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{credits ? credits.balance.toLocaleString() : '5,000'}</div>
            <div className="text-[10px] text-slate-400 mt-1">Tier: <span className="text-indigo-300 font-semibold">{credits?.tier || 'ENTERPRISE'}</span></div>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-400">Total Credits Used</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{credits ? credits.total_used.toLocaleString() : '0'}</div>
            <div className="text-[10px] text-slate-400 mt-1">Deducted per 100 tokens</div>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-400">Total Tokens Processed</div>
            <div className="text-2xl font-bold text-sky-400 mt-1">{totalTokens.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 mt-1">Prompt + Completion</div>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-400">Avg Execution Latency</div>
            <div className="text-2xl font-bold text-purple-400 mt-1">{avgLatency} ms</div>
            <div className="text-[10px] text-slate-400 mt-1">LangChain Node Pipeline</div>
          </div>
        </div>
      </div>

      {/* ── LangGraph Tracing Section ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Trace List Sidebar */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
              <span>🕸️</span> LangGraph Execution Traces
            </h4>
            <select
              value={agentFilter}
              onChange={e => setAgentFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1 outline-none"
            >
              <option value="ALL">All Agents</option>
              <option value="AskYoda">Ask Yoda</option>
              <option value="CodeAdvisor">Code Advisor</option>
              <option value="SpecAssistant">Spec Assistant</option>
              <option value="CodeExplainer">Code Explainer</option>
              <option value="TestCaseGen">Test Case Generator</option>
            </select>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[480px] pr-1">
            {filteredTraces.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No LangGraph traces recorded yet. Trigger any AI action to generate live traces.
              </div>
            ) : (
              filteredTraces.map(trace => (
                <div
                  key={trace.trace_id}
                  onClick={() => setSelectedTrace(trace)}
                  className={`p-3 rounded-xl border transition cursor-pointer text-left ${
                    selectedTrace?.trace_id === trace.trace_id
                      ? 'bg-indigo-950/70 border-indigo-500 shadow-md shadow-indigo-500/10'
                      : 'bg-slate-800/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-indigo-300">{trace.agent_name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      trace.status === 'SUCCESS' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50' : 'bg-rose-950 text-rose-400 border border-rose-800/50'
                    }`}>
                      {trace.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-1">
                    📅 {trace.created_at ? new Date(trace.created_at).toLocaleString() : 'Just now'}
                  </div>
                  <p className="text-[11px] text-slate-300 truncate mt-1">{trace.input_preview || 'No prompt preview'}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 border-t border-slate-800/60 pt-1.5">
                    <span>⏱️ {trace.latency_ms} ms</span>
                    <span>🔤 {trace.prompt_tokens} in / {trace.completion_tokens} out</span>
                    <span>🪙 {trace.credits_deducted} cr</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selected Trace Node Tree Visualization */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col">
          {selectedTrace ? (
            <div>
              <div className="border-b border-slate-800 pb-4 mb-4 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-100 text-base flex items-center gap-2">
                    <span>🔄</span> LangGraph State Graph
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">Trace ID: <span className="font-mono text-indigo-300">{selectedTrace.trace_id}</span></p>
                </div>
                <div className="text-right text-xs">
                  <div className="text-emerald-400 font-semibold">{selectedTrace.credits_deducted} Credits Deducted</div>
                  <div className="text-slate-400 text-[10px]">{selectedTrace.total_tokens} Tokens ({selectedTrace.prompt_tokens} prompt / {selectedTrace.completion_tokens} completion)</div>
                </div>
              </div>

              {/* Visual Node Tree */}
              <div className="space-y-3 mb-6">
                <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <span>🌱</span> Execution Node Graph Steps:
                </div>
                
                {selectedTrace.nodes && selectedTrace.nodes.length > 0 ? (
                  selectedTrace.nodes.map((node, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-7 h-7 rounded-full bg-indigo-900 border border-indigo-500 text-indigo-200 text-xs font-bold flex items-center justify-center shadow">
                          {index + 1}
                        </div>
                        {index < selectedTrace.nodes.length - 1 && (
                          <div className="w-0.5 h-6 bg-indigo-800/60 my-1"></div>
                        )}
                      </div>
                      <div className="flex-1 bg-slate-800/60 border border-slate-700/60 rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-sky-300">{node.node}</span>
                          <span className="text-[10px] text-slate-400">{new Date(node.timestamp * 1000).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">{node.description}</p>
                        {node.state_delta && Object.keys(node.state_delta).length > 0 && (
                          <div className="mt-2 text-[10px] font-mono bg-slate-950/60 p-2 rounded border border-slate-800 text-indigo-200">
                            {JSON.stringify(node.state_delta)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-500">Standard 5-node graph pipeline executed cleanly.</div>
                )}
              </div>

              {/* Input & Output Preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Input Prompt State</div>
                  <p className="text-slate-300 font-mono text-[11px] whitespace-pre-wrap max-h-32 overflow-y-auto">{selectedTrace.input_preview || 'N/A'}</p>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Output Sanitized State</div>
                  <p className="text-slate-300 font-mono text-[11px] whitespace-pre-wrap max-h-32 overflow-y-auto">{selectedTrace.output_preview || 'N/A'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-24 text-center text-slate-500 text-xs">
              Select a trace on the left to inspect its visual LangGraph node state tree.
            </div>
          )}
        </div>
      </div>

      {/* ── Top-Up / Manage AI Credits Modal ────────────────────────────── */}
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
                Allocate additional AI credits to your account. Credits are consumed proportionally based on token metrics across standard LangChain model calls.
              </p>
              <div className="mt-4">
                <label className="block text-xs font-semibold text-slate-400 mb-1">Select Credit Allocation Amount</label>
                <div className="grid grid-cols-3 gap-2">
                  {[500, 1000, 5000].map(amt => (
                    <button
                      key={amt}
                      onClick={() => setTopUpAmount(amt)}
                      className={`py-2 rounded-xl border text-xs font-bold transition ${
                        topUpAmount === amt
                          ? 'bg-emerald-600 border-emerald-400 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      +{amt.toLocaleString()} Credits
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
