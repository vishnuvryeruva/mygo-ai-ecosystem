'use client'

import React, { useState, useRef } from 'react'
import { EdmxParser } from '@/lib/capgen/EdmxParser'
import { PromptGenerator } from '@/lib/capgen/PromptGenerator'

interface CapPromptGeneratorModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function CapPromptGeneratorModal({ isOpen, onClose }: CapPromptGeneratorModalProps) {
    const [step, setStep] = useState(1)
    const fileInputRef = useRef<HTMLInputElement>(null)
    
    // Form data
    const [edmxLoaded, setEdmxLoaded] = useState(false)
    const [fileName, setFileName] = useState('')
    const [serviceName, setServiceName] = useState('')
    const [parsedEntities, setParsedEntities] = useState<any[]>([])
    const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set())
    
    // Actions mapping: entityName -> { create, read, update, delete }
    const [entityActions, setEntityActions] = useState<Record<string, {create:boolean, read:boolean, update:boolean, delete:boolean}>>({})
    
    // Services
    const [services, setServices] = useState({
        appRouter: true,
        xsSecurity: true,
        xsSecurityPlan: 'application',
        destination: true,
        dbType: 'hana'
    })
    
    const [backend, setBackend] = useState({
        destinationName: 'S4_BACKEND_DEST',
        proxyType: 'Internet',
        authType: 'BasicAuthentication',
        baseUrl: 'https://backend.example.com',
        servicePath: '/sap/opu/odata/sap/SRV/',
        user: 'TECH_USER',
        password: ''
    })
    
    const [promptText, setPromptText] = useState('')

    if (!isOpen) return null

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        
        setFileName(file.name)
        const reader = new FileReader()
        reader.onload = (evt) => {
            try {
                const xml = evt.target?.result as string
                const parsed = EdmxParser.parse(xml)
                setParsedEntities(parsed.entities)
                setServiceName(parsed.namespace || file.name.replace(/\.(edmx|xml)$/i, ""))
                setEdmxLoaded(true)
                
                // default actions
                const actions: Record<string, any> = {}
                parsed.entities.forEach((ent: any) => {
                    actions[ent.setName] = { create: true, read: true, update: true, delete: false }
                })
                setEntityActions(actions)
                
            } catch (err: any) {
                alert('Failed to parse EDMX: ' + err.message)
            }
        }
        reader.readAsText(file)
    }

    const toggleEntity = (setName: string) => {
        const newSet = new Set(selectedEntities)
        if (newSet.has(setName)) newSet.delete(setName)
        else newSet.add(setName)
        setSelectedEntities(newSet)
    }
    
    const toggleAction = (entity: string, action: string) => {
        setEntityActions((prev: any) => ({
            ...prev,
            [entity]: {
                ...prev[entity],
                [action]: !prev[entity][action]
            }
        }))
    }

    const generatePrompt = () => {
        const data = {
            selectedEntities: Array.from(selectedEntities),
            serviceName,
            backend,
            services,
            entityActions,
            mta: {
                id: 'com.sap.generated.cap',
                version: '1.0.0',
                memory: 512,
                diskQuota: 1024
            }
        }
        
        const prompt = PromptGenerator.generate(data)
        setPromptText(prompt)
        setStep(5)
    }
    
    const copyPrompt = () => {
        navigator.clipboard.writeText(promptText)
        alert('Copied to clipboard!')
    }

    return (
        <div className="settings-modal-overlay" onClick={onClose}>
            <div className="settings-modal sync-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%' }}>
                <div className="settings-modal-header">
                    <div>
                        <h3 className="settings-modal-title">CAP Prompt Generator</h3>
                        <p className="settings-modal-desc">Step {step} of 5: {
                            step === 1 ? 'Upload EDMX' :
                            step === 2 ? 'Select Entities' :
                            step === 3 ? 'Map Actions' : 
                            step === 4 ? 'Configuration' : 'Generated Prompt'
                        }</p>
                    </div>
                    <button className="settings-modal-close" onClick={onClose}>×</button>
                </div>

                <div className="settings-modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    {step === 1 && (
                        <div className="space-y-4">
                            <p className="text-gray-600">Upload your OData EDMX/XML file to start building your CAP application proxy.</p>
                            
                            <div 
                                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:bg-gray-50 flex flex-col items-center"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2">
                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                                <span className="font-semibold text-gray-700">Click to upload EDMX</span>
                                <span className="text-sm text-gray-400">or drag and drop here</span>
                                <input type="file" ref={fileInputRef} className="hidden" accept=".xml,.edmx" onChange={handleFileUpload} />
                            </div>
                            
                            {edmxLoaded && (
                                <div className="mt-4 p-4 bg-green-50 text-green-800 rounded-lg border border-green-200">
                                    <p className="font-bold">✓ Successfully loaded {fileName}</p>
                                    <p className="text-sm mt-1">Found {parsedEntities.length} entities.</p>
                                    
                                    <div className="mt-3">
                                        <label className="block text-sm font-semibold mb-1">Service Namespace/Name:</label>
                                        <input 
                                            type="text" 
                                            className="w-full p-2 border rounded-lg" 
                                            value={serviceName} 
                                            onChange={e => setServiceName(e.target.value)} 
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && (
                        <div>
                            <div className="mb-4 flex flex-col gap-2">
                                <p className="text-gray-600">Select the entities to include in the CAP deployment.</p>
                                <button 
                                    className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm w-max"
                                    onClick={() => {
                                        if(selectedEntities.size === parsedEntities.length) setSelectedEntities(new Set())
                                        else setSelectedEntities(new Set(parsedEntities.map((e: any) => e.setName)))
                                    }}
                                >
                                    {selectedEntities.size === parsedEntities.length ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {parsedEntities.map(ent => (
                                    <label key={ent.setName} className={`flex items-center p-3 border rounded-lg cursor-pointer ${selectedEntities.has(ent.setName) ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}>
                                        <input 
                                            type="checkbox" 
                                            className="mr-3 w-4 h-4 cursor-pointer"
                                            checked={selectedEntities.has(ent.setName)}
                                            onChange={() => toggleEntity(ent.setName)}
                                        />
                                        <div>
                                            <div className="font-semibold">{ent.setName}</div>
                                            <div className="text-xs text-gray-500">{ent.typeName}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {step === 3 && (
                        <div className="space-y-6">
                            <p className="text-gray-600">Enable CRUD operations for the selected entities down to the backend proxy.</p>
                            
                            {Array.from(selectedEntities).map(entName => (
                                <div key={entName} className="p-4 border rounded-lg bg-gray-50">
                                    <h4 className="font-bold mb-3">{entName}</h4>
                                    <div className="flex gap-4 flex-wrap">
                                        {['create', 'read', 'update', 'delete'].map(action => (
                                            <label key={action} className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox"
                                                    checked={entityActions[entName]?.[action as keyof typeof entityActions[string]] || false}
                                                    onChange={() => toggleAction(entName, action)}
                                                />
                                                <span className="capitalize">{action}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {selectedEntities.size === 0 && (
                                <p className="text-red-500 italic">No entities selected. Please go back.</p>
                            )}
                        </div>
                    )}
                    
                    {step === 4 && (
                        <div className="space-y-6">
                            <div className="p-4 border rounded-lg">
                                <h4 className="font-bold mb-4 border-b pb-2">BTP Services</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <label className="flex items-center gap-2">
                                        <input type="checkbox" checked={services.appRouter} onChange={e => setServices(s => ({...s, appRouter: e.target.checked}))} />
                                        App Router
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input type="checkbox" checked={services.xsSecurity} onChange={e => setServices(s => ({...s, xsSecurity: e.target.checked}))} />
                                        XSUAA Security
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input type="checkbox" checked={services.destination} onChange={e => setServices(s => ({...s, destination: e.target.checked}))} />
                                        Destination Service
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <span>DB Type:</span>
                                        <select className="border p-1 rounded" value={services.dbType} onChange={e => setServices(s => ({...s, dbType: e.target.value}))}>
                                            <option value="sqlite">SQLite (Dev)</option>
                                            <option value="hana">SAP HANA Cloud</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="p-4 border rounded-lg">
                                <h4 className="font-bold mb-4 border-b pb-2">Frontend-to-Backend Destination</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold mb-1">Destination Name</label>
                                        <input type="text" className="w-full border p-2 rounded" value={backend.destinationName} onChange={e => setBackend(b => ({...b, destinationName: e.target.value}))} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold mb-1">Proxy Type</label>
                                        <select className="w-full border p-2 rounded" value={backend.proxyType} onChange={e => setBackend(b => ({...b, proxyType: e.target.value}))}>
                                            <option value="Internet">Internet</option>
                                            <option value="OnPremise">OnPremise (Cloud Connector)</option>
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-semibold mb-1">Base URL</label>
                                        <input type="text" className="w-full border p-2 rounded" value={backend.baseUrl} onChange={e => setBackend(b => ({...b, baseUrl: e.target.value}))} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {step === 5 && (
                        <div className="flex flex-col h-full gap-4">
                            <p className="text-sm text-gray-600">Your production-ready prompt is generated! Paste this into your preferred LLM to generate your enterprise CAP project.</p>
                            <textarea 
                                className="w-full flex-1 min-h-[300px] p-4 border rounded-lg font-mono text-xs bg-gray-50 focus:outline-none focus:ring focus:ring-blue-200"
                                value={promptText}
                                readOnly
                            ></textarea>
                            <div className="flex gap-3 mt-2">
                                <button 
                                    className="btn btn-primary flex-1 py-3" 
                                    onClick={() => {
                                        window.dispatchEvent(new CustomEvent('prompt-studio-open', {
                                            detail: {
                                                prompt: promptText,
                                                language: 'CAP_NODEJS'
                                            }
                                        }))
                                        onClose()
                                    }}
                                >
                                    Code Studio 🚀
                                </button>
                                <button className="btn btn-secondary flex-1 py-3" onClick={copyPrompt}>
                                    📋 Copy
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="settings-modal-footer">
                    {step > 1 && step < 5 && (
                        <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>Back</button>
                    )}
                    
                    {step === 1 && (
                        <button 
                            className="btn btn-primary" 
                            disabled={!edmxLoaded} 
                            onClick={() => setStep(2)}
                        >Next</button>
                    )}
                    
                    {step === 2 && (
                        <button 
                            className="btn btn-primary" 
                            disabled={selectedEntities.size === 0} 
                            onClick={() => setStep(3)}
                        >Next</button>
                    )}
                    
                    {step === 3 && (
                        <button className="btn btn-primary" onClick={() => setStep(4)}>Next</button>
                    )}
                    
                    {step === 4 && (
                        <button className="btn btn-primary" onClick={generatePrompt}>Generat Prompt</button>
                    )}
                    
                    {step === 5 && (
                        <button className="btn btn-secondary" onClick={onClose}>Close</button>
                    )}
                </div>
            </div>
        </div>
    )
}
