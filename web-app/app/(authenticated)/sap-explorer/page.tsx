'use client'

import React, { useState } from 'react'
import axios from 'axios'
import SapPasswordModal, { getSessionSapCreds, setSessionSapPassword } from '@/components/common/SapPasswordModal'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

function getEffectiveCreds(overridePassword?: string) {
  const session = getSessionSapCreds() || {}
  const password = overridePassword || session.password || ''
  return {
    sapHost: session.sapHost || '',
    sapClient: session.sapClient || '100',
    username: session.username || '',
    password: password,
    sapRouter: session.sapRouter || ''
  }
}


function authHeaders(overridePassword?: string) {
  const token = typeof window !== 'undefined' ? (localStorage.getItem('mygo-token') || localStorage.getItem('token') || '') : ''
  const creds = getEffectiveCreds(overridePassword)
  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  if (creds.password) {
    headers['X-SAP-Password'] = creds.password
    headers['X-SAP-Username'] = creds.username
    headers['X-SAP-Host'] = creds.sapHost
    headers['X-SAP-Client'] = creds.sapClient
  }
  return headers
}

const TYPE_COLORS: Record<string, string> = {
  CLAS: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  INTF: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
  PROG: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  INCL: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  FUGR: 'bg-pink-500/20 text-pink-300 border border-pink-500/30',
  TABL: 'bg-slate-500/20 text-slate-300 border border-slate-500/30',
  DDLS: 'bg-teal-500/20 text-teal-300 border border-teal-500/30',
  VIEW: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
}
function TypeBadge({ type }: { type: string }) {
  const cls = TYPE_COLORS[type?.toUpperCase()] ?? 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold ${cls}`}>{type}</span>
}
function Spinner({ size = 20 }: { size?: number }) {
  return <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
}

type SapObject = { name: string; type: string; description: string }
type Transport = { id: string; description: string; status: string }
type TabId = 'explore' | 'source' | 'write' | 'transports'

export default function SapExplorerPage() {
  const [activeTab, setActiveTab] = useState<TabId>('explore')
  const [toast, setToast] = useState<{msg:string;type:'success'|'error'|'info'}|null>(null)
  const showToast = (msg:string,type:'success'|'error'|'info'='info')=>{setToast({msg,type});setTimeout(()=>setToast(null),5000)}

  // Password modal state
  const [isSapPasswordModalOpen, setIsSapPasswordModalOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<((password: string) => void) | null>(null)

  function runWithAuth(action: (password: string) => void) {
    const creds = getEffectiveCreds()
    if (!creds.password) {
      setPendingAction(() => action)
      setIsSapPasswordModalOpen(true)
    } else {
      action(creds.password)
    }
  }

  function handleModalConfirm(password: string) {
    setIsSapPasswordModalOpen(false)
    const existing = getSessionSapCreds() || {}
    setSessionSapPassword(password, {
      username: existing.username || '',
      sapClient: existing.sapClient || '100',
      sapHost: existing.sapHost || ''
    })
    if (pendingAction) {
      const act = pendingAction
      setPendingAction(null)
      act(password)
    }
  }


  // Connection
  const [connStatus, setConnStatus] = useState<'idle'|'testing'|'ok'|'fail'>('idle')
  const [connHost, setConnHost] = useState('')
  function testConnection(){
    runWithAuth(async (pwd) => {
      setConnStatus('testing')
      try{
        const creds = getEffectiveCreds(pwd)
        const r = await axios.post(`${API}/api/sap/adt/connection-test`, creds, { headers: authHeaders(pwd) })
        if(r.data?.success){
          setConnStatus('ok')
          setConnHost(r.data?.host ?? creds.sapHost)
          showToast(`Connected to SAP (${r.data?.host ?? creds.sapHost})`, 'success')
        } else {
          setConnStatus('fail')
          showToast(r.data?.error ?? 'Connection failed', 'error')
        }
      }catch(e:any){
        setConnStatus('fail')
        showToast(e.response?.data?.error ?? e.message ?? 'Connection failed', 'error')
      }
    })
  }

  // Package Explorer
  const [pkgInput,setPkgInput]=useState('')
  const [pkgLoading,setPkgLoading]=useState(false)
  const [pkgObjects,setPkgObjects]=useState<SapObject[]>([])
  const [pkgFilter,setPkgFilter]=useState('')
  const [typeFilter,setTypeFilter]=useState('')
  function browsePackage(){
    if(!pkgInput.trim())return;
    runWithAuth(async (pwd) => {
      setPkgLoading(true);setPkgObjects([])
      try{
        const creds = getEffectiveCreds(pwd)
        const r=await axios.get(`${API}/api/sap/adt/packages/${pkgInput.trim().toUpperCase()}`,{headers:authHeaders(pwd), params: creds})
        if(r.data?.success){setPkgObjects(r.data.objects??[]);showToast(`Found ${r.data.total} objects`,'success')}
        else showToast(r.data?.error??'Failed','error')
      }catch(e:any){showToast('Package browse error','error')}finally{setPkgLoading(false)}
    })
  }
  const filtered=pkgObjects.filter(o=>(!pkgFilter||o.name.toLowerCase().includes(pkgFilter.toLowerCase()))&&(!typeFilter||o.type.toUpperCase()===typeFilter))
  const uniqueTypes=Array.from(new Set(pkgObjects.map(o=>o.type.toUpperCase()))).sort()

  // Source Viewer
  const [srcObject,setSrcObject]=useState('')
  const [srcType,setSrcType]=useState('CLAS')
  const [srcLoading,setSrcLoading]=useState(false)
  const [srcCode,setSrcCode]=useState('')
  const [srcVia,setSrcVia]=useState('')
  function fetchSource(){
    if(!srcObject.trim())return;
    runWithAuth(async (pwd) => {
      setSrcLoading(true);setSrcCode('')
      try{
        const creds = getEffectiveCreds(pwd)
        const r=await axios.get(`${API}/api/sap/adt/source`,{params:{object:srcObject.trim().toUpperCase(),type:srcType, ...creds},headers:authHeaders(pwd)})
        if(r.data?.success){setSrcCode(r.data.source_code??'');setSrcVia(r.data.source??'ADT');showToast('Source fetched','success')}
        else showToast(r.data?.error??'Fetch failed','error')
      }catch(e:any){showToast('Source fetch error','error')}finally{setSrcLoading(false)}
    })
  }

  // Write/Deploy
  const [wObj,setWObj]=useState('')
  const [wType,setWType]=useState('CLAS')
  const [wCode,setWCode]=useState('')
  const [wTR,setWTR]=useState('')
  const [wLoading,setWLoading]=useState(false)
  const [wResult,setWResult]=useState<any>(null)
  function pushSource(){
    if(!wObj.trim()||!wCode.trim()){showToast('Object name and source code required','error');return}
    runWithAuth(async (pwd) => {
      setWLoading(true);setWResult(null)
      try{
        const creds = getEffectiveCreds(pwd)
        const payload = { objectName:wObj.trim().toUpperCase(), objectType:wType, sourceCode:wCode, transportRequest:wTR.trim(), ...creds }
        const r=await axios.put(`${API}/api/sap/adt/source`, payload, {headers:authHeaders(pwd)})
        setWResult(r.data)
        if(r.data?.success)showToast(`${wObj} written and activated on SAP!`,'success')
        else showToast(r.data?.error??'Write failed','error')
      }catch(e:any){showToast('Write error','error');setWResult({success:false,error:e.response?.data?.error??e.message})}finally{setWLoading(false)}
    })
  }

  // Ingest
  const [ingestPkg,setIngestPkg]=useState('')
  const [ingestLoading,setIngestLoading]=useState(false)
  const [ingestResult,setIngestResult]=useState<any>(null)
  function ingestPackage(){
    if(!ingestPkg.trim())return;
    runWithAuth(async (pwd) => {
      setIngestLoading(true);setIngestResult(null)
      try{
        const creds = getEffectiveCreds(pwd)
        const r=await axios.post(`${API}/api/sap/adt/ingest-package`,{packageName:ingestPkg.trim().toUpperCase(), ...creds},{headers:authHeaders(pwd)})
        setIngestResult(r.data)
        if(r.data?.success)showToast(`Ingested ${r.data.total_ingested} objects into YODA`,'success')
        else showToast(r.data?.error??'Ingest failed','error')
      }catch(e:any){showToast('Ingest error','error')}finally{setIngestLoading(false)}
    })
  }

  // Transports
  const [trUser,setTrUser]=useState('')
  const [trLoading,setTrLoading]=useState(false)
  const [transports,setTransports]=useState<Transport[]>([])
  function listTransports(){
    runWithAuth(async (pwd) => {
      setTrLoading(true);setTransports([])
      try{
        const creds = getEffectiveCreds(pwd)
        const r=await axios.get(`${API}/api/sap/adt/transports`,{params:{user:trUser, ...creds},headers:authHeaders(pwd)})
        if(r.data?.success){setTransports(r.data.transports??[]);showToast(`${r.data.total} transports found`,'success')}
        else showToast(r.data?.error??'Failed','error')
      }catch(e:any){showToast('Transport error','error')}finally{setTrLoading(false)}
    })
  }

  const OBJECT_TYPES=['CLAS','INTF','PROG','INCL','FUGR','TABL','DDLS','VIEW','DTEL','DOMA']
  const TABS:[TabId,string,string][]=[['explore','📦','Package Explorer'],['source','📄','Source Viewer'],['write','✏️','Write / Deploy'],['transports','🚀','Transports']]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      {/* Toast */}
      {toast&&<div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl backdrop-blur-md text-white shadow-2xl border border-white/10 max-w-sm text-sm ${toast.type==='success'?'bg-gradient-to-r from-emerald-600/90 to-teal-600/90':toast.type==='error'?'bg-gradient-to-r from-red-600/90 to-rose-600/90':'bg-gradient-to-r from-blue-600/90 to-indigo-600/90'}`}>{toast.msg}<button onClick={()=>setToast(null)} className="ml-2 text-white/70 hover:text-white">✕</button></div>}

      {/* SAP Password Modal */}
      <SapPasswordModal
        isOpen={isSapPasswordModalOpen}
        onClose={() => setIsSapPasswordModalOpen(false)}
        onConfirm={handleModalConfirm}
        systemId={getSessionSapCreds()?.systemId || 'SAP'}
        username={getSessionSapCreds()?.username || ''}
        client={getSessionSapCreds()?.sapClient || '100'}
        title="SAP Authentication Required"
        description="Please enter your SAP password to execute live ADT tools."
      />


      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">SAP Explorer</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">ADT Embedded</span>
          </div>
          <p className="text-sm text-slate-400">Browse, read, and write ABAP code directly via SAP ADT REST</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${connStatus==='ok'?'bg-emerald-500/10 text-emerald-400 border-emerald-500/30':connStatus==='fail'?'bg-red-500/10 text-red-400 border-red-500/30':'bg-slate-700/50 text-slate-400 border-slate-600/30'}`}>
            <span className={`w-2 h-2 rounded-full ${connStatus==='ok'?'bg-emerald-400 animate-pulse':connStatus==='fail'?'bg-red-400':'bg-slate-500'}`}/>
            {connStatus==='ok'?`Connected · ${connHost}`:connStatus==='fail'?'Connection Failed':connStatus==='testing'?'Testing...':'Not tested'}
          </div>
          <button onClick={testConnection} disabled={connStatus==='testing'} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-all text-sm font-medium shadow-lg">
            {connStatus==='testing'?<Spinner size={14}/>:'⚡'} Test Connection
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 w-fit">
        {TABS.map(([id,icon,label])=>(
          <button key={id} onClick={()=>setActiveTab(id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab===id?'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg':'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ── Package Explorer ─────────────────────────────────────────── */}
      {activeTab==='explore'&&(
        <div className="space-y-4">
          <div className="flex gap-3">
            <input value={pkgInput} onChange={e=>setPkgInput(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&browsePackage()} placeholder="Package name  e.g. ZFIORI_SALES" className="flex-1 bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-sm font-mono placeholder:text-slate-500 focus:outline-none focus:border-blue-500/70"/>
            <button onClick={browsePackage} disabled={pkgLoading||!pkgInput.trim()} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 rounded-xl text-sm font-semibold transition-all shadow-lg">{pkgLoading?<Spinner size={14}/>:'🔍'} Browse</button>
          </div>
          {pkgObjects.length>0&&(
            <div className="flex gap-3">
              <input value={pkgFilter} onChange={e=>setPkgFilter(e.target.value)} placeholder="Filter by name..." className="flex-1 bg-slate-800/40 border border-slate-600/30 rounded-lg px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none"/>
              <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className="bg-slate-800/40 border border-slate-600/30 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none">
                <option value="">All types</option>
                {uniqueTypes.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              <span className="flex items-center px-3 py-2 bg-slate-800/40 rounded-lg text-xs text-slate-400 border border-slate-600/30">{filtered.length}/{pkgObjects.length}</span>
            </div>
          )}
          {pkgLoading?(
            <div className="flex items-center justify-center py-16 text-slate-400 gap-3"><Spinner size={20}/> Fetching from SAP ADT...</div>
          ):filtered.length>0?(
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map(obj=>(
                <div key={`${obj.name}-${obj.type}`} onClick={()=>{setSrcObject(obj.name);setSrcType(obj.type);setActiveTab('source')}} className="group p-4 bg-slate-800/40 hover:bg-slate-700/50 border border-slate-700/40 hover:border-blue-500/40 rounded-xl cursor-pointer transition-all">
                  <div className="flex items-start gap-3">
                    <TypeBadge type={obj.type}/>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono font-semibold text-white group-hover:text-blue-300 truncate">{obj.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{obj.description||'—'}</p>
                    </div>
                    <svg className="w-4 h-4 text-slate-600 group-hover:text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                  </div>
                </div>
              ))}
            </div>
          ):(
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <div className="text-4xl mb-4">📦</div>
              <p className="text-sm">Enter a package name and click Browse</p>
              <p className="text-xs mt-1 text-slate-600">e.g. $TMP · ZFIORI_SALES</p>
            </div>
          )}
        </div>
      )}

      {/* ── Source Viewer ─────────────────────────────────────────────── */}
      {activeTab==='source'&&(
        <div className="space-y-4">
          <div className="flex gap-3">
            <input value={srcObject} onChange={e=>setSrcObject(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&fetchSource()} placeholder="Object name  e.g. ZCL_SALES_ORDER" className="flex-1 bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-sm font-mono placeholder:text-slate-500 focus:outline-none focus:border-blue-500/70"/>
            <select value={srcType} onChange={e=>setSrcType(e.target.value)} className="bg-slate-800/60 border border-slate-600/50 rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none">
              {OBJECT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={fetchSource} disabled={srcLoading||!srcObject.trim()} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 rounded-xl text-sm font-semibold transition-all shadow-lg">{srcLoading?<Spinner size={14}/>:'⬇️'} Fetch</button>
          </div>
          {srcCode?(
            <div className="rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/50">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono font-semibold">{srcObject}</span>
                  <TypeBadge type={srcType}/>
                  {srcVia&&<span className="text-xs text-slate-400">via {srcVia}</span>}
                  <span className="text-xs text-slate-500">{srcCode.split('\n').length} lines</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>{navigator.clipboard.writeText(srcCode);showToast('Copied','success')}} className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg text-xs text-slate-300">📋 Copy</button>
                  <button onClick={()=>{setWObj(srcObject);setWType(srcType);setWCode(srcCode);setActiveTab('write');showToast('Loaded into Write tab','info')}} className="px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/30 rounded-lg text-xs text-blue-300">✏️ Edit & Deploy</button>
                </div>
              </div>
              <div className="bg-slate-950/80 overflow-auto max-h-[60vh]">
                <pre className="p-5 text-xs font-mono text-slate-300 leading-relaxed whitespace-pre">{srcCode}</pre>
              </div>
            </div>
          ):srcLoading?(
            <div className="flex items-center justify-center py-20 gap-3 text-slate-400"><Spinner size={20}/> Fetching source...</div>
          ):(
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <div className="text-4xl mb-4">📄</div>
              <p className="text-sm">Enter an object name and click Fetch</p>
            </div>
          )}
        </div>
      )}

      {/* ── Write / Deploy ─────────────────────────────────────────────── */}
      {activeTab==='write'&&(
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={wObj} onChange={e=>setWObj(e.target.value.toUpperCase())} placeholder="Object name e.g. ZCL_SALES_ORDER" className="bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-sm font-mono placeholder:text-slate-500 focus:outline-none focus:border-blue-500/70"/>
            <select value={wType} onChange={e=>setWType(e.target.value)} className="bg-slate-800/60 border border-slate-600/50 rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none">
              {OBJECT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <input value={wTR} onChange={e=>setWTR(e.target.value.toUpperCase())} placeholder="Transport request (optional)" className="bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-sm font-mono placeholder:text-slate-500 focus:outline-none focus:border-blue-500/70"/>
          </div>
          <div className="rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/50">
              <span className="text-xs text-slate-400 font-mono">ABAP Source Editor</span>
              <span className="text-xs text-slate-500">{wCode.split('\n').length} lines</span>
            </div>
            <textarea value={wCode} onChange={e=>setWCode(e.target.value)} placeholder={"CLASS zcl_my_class DEFINITION\n  PUBLIC\n  FINAL\n  CREATE PUBLIC.\nENDCLASS."} className="w-full h-72 bg-slate-950/80 p-5 text-xs font-mono text-slate-300 leading-relaxed resize-none focus:outline-none placeholder:text-slate-700" spellCheck={false}/>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={pushSource} disabled={wLoading||!wObj.trim()||!wCode.trim()} className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 rounded-xl text-sm font-semibold shadow-lg">{wLoading?<Spinner size={14}/>:'⬆️'} Write &amp; Activate on SAP</button>
            <div className="flex-1 flex gap-3 pl-4 border-l border-slate-700/50">
              <input value={ingestPkg} onChange={e=>setIngestPkg(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&ingestPackage()} placeholder="Package to ingest into RAG" className="flex-1 bg-slate-800/40 border border-slate-600/30 rounded-xl px-4 py-2.5 text-sm font-mono placeholder:text-slate-500 focus:outline-none"/>
              <button onClick={ingestPackage} disabled={ingestLoading||!ingestPkg.trim()} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/30 disabled:opacity-50 rounded-xl text-sm font-medium text-indigo-300">{ingestLoading?<Spinner size={14}/>:'🧠'} Ingest to RAG</button>
            </div>
          </div>
          {wResult&&<div className={`p-4 rounded-xl border text-sm ${wResult.success?'bg-emerald-500/10 border-emerald-500/30 text-emerald-300':'bg-red-500/10 border-red-500/30 text-red-300'}`}>{wResult.success?`✅ ${wResult.message||'Written successfully'}`:`❌ ${wResult.error}`}</div>}
          {ingestResult&&<div className={`p-4 rounded-xl border text-sm ${ingestResult.success?'bg-indigo-500/10 border-indigo-500/30':'bg-red-500/10 border-red-500/30'}`}>{ingestResult.success?<div className="space-y-1"><p className="text-indigo-300 font-semibold">🧠 Package ingested into YODA</p><div className="flex gap-4 text-xs text-slate-400"><span>✅ <strong className="text-emerald-400">{ingestResult.total_ingested}</strong></span><span>⏭ <strong className="text-yellow-400">{ingestResult.total_skipped}</strong></span><span>❌ <strong className="text-red-400">{ingestResult.total_errors}</strong></span></div></div>:<p className="text-red-300">❌ {ingestResult.error}</p>}</div>}
        </div>
      )}

      {/* ── Transports ─────────────────────────────────────────────────── */}
      {activeTab==='transports'&&(
        <div className="space-y-4">
          <div className="flex gap-3">
            <input value={trUser} onChange={e=>setTrUser(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&listTransports()} placeholder="SAP username (leave empty for connected user)" className="flex-1 bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-sm font-mono placeholder:text-slate-500 focus:outline-none focus:border-blue-500/70"/>
            <button onClick={listTransports} disabled={trLoading} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 rounded-xl text-sm font-semibold shadow-lg">{trLoading?<Spinner size={14}/>:'🚀'} List Transports</button>
          </div>
          {transports.length>0?(
            <div className="space-y-2">{transports.map(tr=>(
              <div key={tr.id} className="flex items-center gap-4 p-4 bg-slate-800/40 border border-slate-700/40 rounded-xl">
                <span className="font-mono text-sm font-bold text-blue-300">{tr.id}</span>
                <span className="flex-1 text-sm text-slate-300">{tr.description||'—'}</span>
                <span className={`text-xs px-2 py-0.5 rounded font-mono ${tr.status==='D'?'bg-yellow-500/20 text-yellow-300':'bg-emerald-500/20 text-emerald-300'}`}>{tr.status==='D'?'Draft':tr.status}</span>
              </div>
            ))}</div>
          ):trLoading?(
            <div className="flex items-center justify-center py-20 gap-3 text-slate-400"><Spinner size={20}/> Loading transports...</div>
          ):(
            <div className="flex flex-col items-center justify-center py-20 text-slate-500"><div className="text-4xl mb-4">🚀</div><p className="text-sm">Click List Transports to fetch open requests</p></div>
          )}
        </div>
      )}
    </div>
  )
}
