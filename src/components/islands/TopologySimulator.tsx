import { useState, useRef, useEffect } from 'react'
import {
  createTopology,
  addDevice as libAddDevice,
  removeDevice as libRemoveDevice,
  connectDevices as libConnectDevices,
  removeLink as libRemoveLink,
  moveDevice as libMoveDevice,
  autoAssignIPs,
  analyzeTopology,
  exportToCiscoConfig,
  type Topology,
  type TopologyAnalysis,
  type DeviceType,
} from '../../lib/network/topology'
import { maskToPrefix, ipToInt } from '../../lib/network/ipv4'

// ─── Constants ────────────────────────────────────────────────────────────────

const DW = 80
const DH = 52

const COLORS: Record<DeviceType, string> = {
  router:   '#3b5bdb',
  switch:   '#2f9e44',
  host:     '#868e96',
  firewall: '#e8590c',
  cloud:    '#ae3ec9',
}

const ICONS: Record<DeviceType, string> = {
  router:   'R',
  switch:   'SW',
  host:     'H',
  firewall: 'FW',
  cloud:    '☁',
}

const DEVICE_TYPES: DeviceType[] = ['router', 'switch', 'host', 'firewall', 'cloud']

type Mode = 'select' | 'connect'

function maskToSlash(mask?: string): string {
  if (!mask) return ''
  try { return `/${maskToPrefix(ipToInt(mask))}` } catch { return '' }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TopologySimulator() {
  const [topo, setTopo] = useState<Topology>(() =>
    createTopology('My Network', '10.0.0.0/8')
  )
  const [selectedDevId,  setSelectedDevId]  = useState<string | null>(null)
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null)
  const [mode,           setMode]           = useState<Mode>('select')
  const [connectSrc,     setConnectSrc]     = useState<string | null>(null)
  const [analysis,       setAnalysis]       = useState<TopologyAnalysis | null>(null)
  const [showExport,     setShowExport]     = useState(false)
  const [exportText,     setExportText]     = useState('')
  const [copied,         setCopied]         = useState(false)
  const [editingId,      setEditingId]      = useState<string | null>(null)
  const [editingVal,     setEditingVal]     = useState('')
  const [isDragging,     setIsDragging]     = useState(false)
  const [connectError,   setConnectError]   = useState<string | null>(null)

  const svgRef        = useRef<SVGSVGElement>(null)
  const dragRef       = useRef<{ id: string; ox: number; oy: number } | null>(null)
  const hasDraggedRef = useRef(false)
  const editInputRef  = useRef<HTMLInputElement>(null)

  // Auto-focus label editor
  useEffect(() => {
    if (editingId) setTimeout(() => editInputRef.current?.focus(), 20)
  }, [editingId])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const inInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
      if (e.key === 'Escape') {
        if (editingId)    { setEditingId(null); return }
        if (showExport)   { setShowExport(false); return }
        if (mode === 'connect') { setMode('select'); setConnectSrc(null); return }
        setSelectedDevId(null); setSelectedLinkId(null)
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !inInput) {
        if (selectedDevId) {
          setTopo(prev => libRemoveDevice(prev, selectedDevId))
          setSelectedDevId(null); setAnalysis(null)
        } else if (selectedLinkId) {
          setTopo(prev => libRemoveLink(prev, selectedLinkId))
          setSelectedLinkId(null); setAnalysis(null)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editingId, showExport, mode, selectedDevId, selectedLinkId])

  // ── Add device ─────────────────────────────────────────────────────────────

  const handleAddDevice = (type: DeviceType) => {
    const n = topo.devices.length
    const x = 120 + (n % 5) * 130
    const y = 110 + Math.floor(n / 5) * 130
    const count = topo.devices.filter(d => d.type === type).length
    const prefix: Record<DeviceType, string> = { router: 'R', switch: 'SW', host: 'H', firewall: 'FW', cloud: 'Cloud' }
    const label = `${prefix[type]}${count + 1}`
    const { topology } = libAddDevice(topo, type, label, x, y)
    setTopo(topology)
    setAnalysis(null)
  }

  // ── Drag ───────────────────────────────────────────────────────────────────

  const handleDeviceMouseDown = (e: React.MouseEvent, deviceId: string) => {
    if (mode === 'connect' || editingId === deviceId) return
    e.stopPropagation()
    e.preventDefault()
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const device = topo.devices.find(d => d.id === deviceId)
    if (!device) return
    hasDraggedRef.current = false
    dragRef.current = {
      id: deviceId,
      ox: e.clientX - rect.left - device.x,
      oy: e.clientY - rect.top  - device.y,
    }
    setIsDragging(true)
  }

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const drag = dragRef.current
    if (!drag || !svgRef.current) return
    hasDraggedRef.current = true
    const rect = svgRef.current.getBoundingClientRect()
    const x = Math.max(DW / 2, Math.min(rect.width  - DW / 2, e.clientX - rect.left - drag.ox))
    const y = Math.max(DH / 2, Math.min(rect.height - DH / 2, e.clientY - rect.top  - drag.oy))
    const { id } = drag
    setTopo(prev => libMoveDevice(prev, id, x, y))
  }

  const handleSvgMouseUp = () => {
    dragRef.current = null
    setIsDragging(false)
  }

  // ── Click ──────────────────────────────────────────────────────────────────

  const handleDeviceClick = (e: React.MouseEvent, deviceId: string) => {
    e.stopPropagation()
    if (hasDraggedRef.current) { hasDraggedRef.current = false; return }

    if (mode === 'connect') {
      if (!connectSrc) {
        setConnectSrc(deviceId)
        setConnectError(null)
      } else if (connectSrc !== deviceId) {
        try {
          const { topology } = libConnectDevices(topo, connectSrc, deviceId)
          setTopo(topology)
          setAnalysis(null)
          setConnectError(null)
        } catch (err) {
          setConnectError(err instanceof Error ? err.message : 'Cannot connect')
        }
        setConnectSrc(null)
        setMode('select')
      }
      return
    }

    setSelectedDevId(deviceId)
    setSelectedLinkId(null)
    if (editingId && editingId !== deviceId) saveLabelEdit()
  }

  const handleDeviceDblClick = (e: React.MouseEvent, deviceId: string) => {
    e.stopPropagation()
    const device = topo.devices.find(d => d.id === deviceId)
    if (!device) return
    setEditingId(deviceId)
    setEditingVal(device.label)
    setSelectedDevId(deviceId)
  }

  const saveLabelEdit = () => {
    if (editingId && editingVal.trim()) {
      setTopo(prev => ({
        ...prev,
        devices: prev.devices.map(d =>
          d.id === editingId ? { ...d, label: editingVal.trim() } : d
        ),
        updatedAt: new Date(),
      }))
    }
    setEditingId(null)
  }

  const handleSvgClick = () => {
    if (editingId) { saveLabelEdit(); return }
    if (mode === 'connect') { setConnectSrc(null); setMode('select'); return }
    setSelectedDevId(null)
    setSelectedLinkId(null)
  }

  const handleLinkClick = (e: React.MouseEvent, linkId: string) => {
    e.stopPropagation()
    setSelectedLinkId(linkId)
    setSelectedDevId(null)
    if (editingId) saveLabelEdit()
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleAutoAssign = () => {
    try { setTopo(autoAssignIPs(topo)); setAnalysis(null) } catch {}
  }

  const handleAnalyze = () => setAnalysis(analyzeTopology(topo))

  const handleExport = () => {
    const text = exportToCiscoConfig(topo)
    setExportText(
      text.trim()
        ? text
        : '! No routers with assigned IPs found.\n! Add routers, connect them, and run Auto-assign IPs first.'
    )
    setShowExport(true)
    setCopied(false)
  }

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const handleClear = () => {
    setTopo(createTopology('My Network', '10.0.0.0/8'))
    setSelectedDevId(null); setSelectedLinkId(null)
    setAnalysis(null); setMode('select'); setConnectSrc(null)
    setEditingId(null); setConnectError(null)
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const selectedDev  = topo.devices.find(d => d.id === selectedDevId)
  const selectedLink = topo.links.find(l => l.id === selectedLinkId)
  const svgCursor    = isDragging ? 'grabbing' : mode === 'connect' ? 'crosshair' : 'default'

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="tool-card p-0 overflow-hidden">

      {/* ── Main layout ─────────────────────────────────────────── */}
      <div className="flex" style={{ height: 500 }}>

        {/* Toolbar */}
        <div className="w-36 shrink-0 border-r border-surface-200 flex flex-col gap-0.5 p-2 bg-surface-50">
          <p className="section-label px-2 pt-1 pb-2">Add device</p>
          {DEVICE_TYPES.map(type => (
            <button
              key={type}
              onClick={() => handleAddDevice(type)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[#495057] hover:bg-surface-100 transition-colors text-left"
            >
              <span
                className="w-8 h-5 rounded flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                style={{ background: COLORS[type] }}
              >
                {ICONS[type]}
              </span>
              <span className="capitalize text-xs font-medium">{type}</span>
            </button>
          ))}

          <div className="border-t border-surface-200 my-2" />

          <button
            onClick={() => { setMode(m => m === 'connect' ? 'select' : 'connect'); setConnectSrc(null) }}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              mode === 'connect' ? 'bg-brand-500 text-white' : 'text-[#495057] hover:bg-surface-100'
            }`}
          >
            <span className="font-bold">↔</span>
            <span>Connect</span>
          </button>

          {mode === 'connect' && (
            <p className="text-[10px] text-[#868e96] px-2 leading-tight mt-1">
              {connectSrc ? '→ click target' : '→ click source'}
            </p>
          )}

          {connectError && (
            <p className="text-[10px] text-red-500 px-2 leading-tight mt-1">{connectError}</p>
          )}
        </div>

        {/* SVG Canvas */}
        <div className="flex-1 overflow-hidden bg-white">
          <svg
            ref={svgRef}
            className="w-full h-full"
            style={{ cursor: svgCursor }}
            onMouseMove={handleSvgMouseMove}
            onMouseUp={handleSvgMouseUp}
            onMouseLeave={handleSvgMouseUp}
            onClick={handleSvgClick}
          >
            <defs>
              <pattern id="topo-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#f1f3f5" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#topo-grid)" />

            {/* Links */}
            {topo.links.map(link => {
              const src = topo.devices.find(d => d.id === link.sourceDeviceId)
              const tgt = topo.devices.find(d => d.id === link.targetDeviceId)
              if (!src || !tgt) return null
              const isSelected = link.id === selectedLinkId
              const mx = (src.x + tgt.x) / 2
              const my = (src.y + tgt.y) / 2
              return (
                <g key={link.id}>
                  <line
                    x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                    stroke="transparent" strokeWidth={16}
                    style={{ cursor: 'pointer' }}
                    onClick={e => handleLinkClick(e, link.id)}
                  />
                  <line
                    x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                    stroke={isSelected ? '#e8590c' : '#ced4da'}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    strokeDasharray={link.linkType === 'serial' ? '6,3' : undefined}
                    pointerEvents="none"
                  />
                  {link.subnet && (
                    <text
                      x={mx} y={my - 7}
                      textAnchor="middle" fontSize={9} fill="#868e96"
                      style={{ userSelect: 'none', pointerEvents: 'none' }}
                    >
                      {link.subnet}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Devices */}
            {topo.devices.map(device => {
              const isSel     = device.id === selectedDevId
              const isConnSrc = device.id === connectSrc
              const color     = COLORS[device.type]
              const isEditing = device.id === editingId
              const lx = device.x - DW / 2
              const ly = device.y - DH / 2

              return (
                <g
                  key={device.id}
                  style={{
                    cursor: mode === 'connect' ? 'pointer'
                      : isDragging && dragRef.current?.id === device.id ? 'grabbing'
                      : 'grab',
                  }}
                  onClick={e => handleDeviceClick(e, device.id)}
                  onMouseDown={e => handleDeviceMouseDown(e, device.id)}
                  onDoubleClick={e => handleDeviceDblClick(e, device.id)}
                >
                  {(isSel || isConnSrc) && (
                    <rect
                      x={lx - 3} y={ly - 3} width={DW + 6} height={DH + 6} rx={13}
                      fill="none"
                      stroke={isConnSrc ? '#2f9e44' : '#3b5bdb'}
                      strokeWidth={2.5}
                      pointerEvents="none"
                    />
                  )}
                  <rect x={lx} y={ly} width={DW} height={DH} rx={10} fill={color} />
                  <text
                    x={device.x} y={device.y - 7}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="rgba(255,255,255,0.9)" fontSize={12} fontWeight="700"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                  >
                    {ICONS[device.type]}
                  </text>

                  {!isEditing && (
                    <text
                      x={device.x} y={ly + DH - 11}
                      textAnchor="middle" dominantBaseline="middle"
                      fill="rgba(255,255,255,0.92)" fontSize={10} fontWeight="500"
                      style={{ userSelect: 'none', pointerEvents: 'none' }}
                    >
                      {device.label}
                    </text>
                  )}

                  {isEditing && (
                    <foreignObject x={lx + 4} y={ly + DH - 22} width={DW - 8} height={20}>
                      <input
                        ref={editInputRef}
                        value={editingVal}
                        onChange={e => setEditingVal(e.target.value)}
                        onBlur={saveLabelEdit}
                        onKeyDown={e => {
                          e.stopPropagation()
                          if (e.key === 'Enter') saveLabelEdit()
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        onClick={e => e.stopPropagation()}
                        style={{
                          width: '100%', background: 'white',
                          border: '1px solid #3b5bdb', borderRadius: 3,
                          padding: '1px 4px', fontSize: 10,
                          textAlign: 'center', outline: 'none',
                        }}
                      />
                    </foreignObject>
                  )}
                </g>
              )
            })}

            {topo.devices.length === 0 && (
              <text
                x="50%" y="50%"
                textAnchor="middle" dominantBaseline="middle"
                fill="#adb5bd" fontSize={13}
                style={{ userSelect: 'none' }}
              >
                Add devices from the toolbar — use Connect to link them
              </text>
            )}
          </svg>
        </div>

        {/* Properties panel */}
        <div className="w-52 shrink-0 border-l border-surface-200 flex flex-col bg-surface-50 overflow-y-auto">
          {selectedDev ? (
            <div className="p-3 space-y-3 flex-1">
              <p className="section-label">Device</p>

              <div>
                <p className="text-[10px] text-[#868e96] mb-1 uppercase font-semibold tracking-wider">Label</p>
                <input
                  className="input-field text-xs py-1"
                  value={selectedDev.label}
                  onChange={e => setTopo(prev => ({
                    ...prev,
                    devices: prev.devices.map(d =>
                      d.id === selectedDevId ? { ...d, label: e.target.value } : d
                    ),
                    updatedAt: new Date(),
                  }))}
                />
              </div>

              <div className="flex items-center gap-2">
                <span
                  className="inline-block px-2 py-0.5 rounded text-white text-[10px] font-semibold"
                  style={{ background: COLORS[selectedDev.type] }}
                >
                  {selectedDev.type}
                </span>
                {selectedDev.managementIp && (
                  <span className="font-mono text-[10px] text-[#495057]">{selectedDev.managementIp}</span>
                )}
              </div>

              <div>
                <p className="text-[10px] text-[#868e96] mb-1 uppercase font-semibold tracking-wider">Interfaces</p>
                <div className="space-y-1">
                  {selectedDev.interfaces.map(iface => (
                    <div key={iface.id} className="text-[10px] leading-snug">
                      <span className="font-mono text-[#495057]">{iface.id}</span>
                      {iface.ipAddress ? (
                        <span className="block font-mono text-brand-600 pl-2">
                          {iface.ipAddress}{maskToSlash(iface.subnetMask)}
                        </span>
                      ) : iface.connectedTo ? (
                        <span className="block text-[#adb5bd] pl-2">linked</span>
                      ) : (
                        <span className="block text-[#e0e0e0] pl-2">free</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  setTopo(prev => libRemoveDevice(prev, selectedDevId!))
                  setSelectedDevId(null); setAnalysis(null)
                }}
                className="w-full text-[10px] font-medium px-2 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
              >
                Remove device
              </button>
            </div>

          ) : selectedLink ? (
            <div className="p-3 space-y-3">
              <p className="section-label">Link</p>

              <div>
                <p className="text-[10px] text-[#868e96] mb-0.5 uppercase font-semibold tracking-wider">Type</p>
                <p className="text-xs text-[#495057] capitalize">{selectedLink.linkType}</p>
              </div>

              {selectedLink.subnet && (
                <div>
                  <p className="text-[10px] text-[#868e96] mb-0.5 uppercase font-semibold tracking-wider">Subnet</p>
                  <p className="font-mono text-xs text-brand-600">{selectedLink.subnet}</p>
                </div>
              )}

              <div>
                <p className="text-[10px] text-[#868e96] mb-1 uppercase font-semibold tracking-wider">Endpoints</p>
                <p className="text-[10px] font-mono text-[#495057]">
                  {topo.devices.find(d => d.id === selectedLink.sourceDeviceId)?.label}:{' '}
                  {selectedLink.sourceInterfaceId}
                </p>
                <p className="text-[10px] text-[#adb5bd] my-0.5 pl-1">↕</p>
                <p className="text-[10px] font-mono text-[#495057]">
                  {topo.devices.find(d => d.id === selectedLink.targetDeviceId)?.label}:{' '}
                  {selectedLink.targetInterfaceId}
                </p>
              </div>

              <button
                onClick={() => {
                  setTopo(prev => libRemoveLink(prev, selectedLinkId!))
                  setSelectedLinkId(null); setAnalysis(null)
                }}
                className="w-full text-[10px] font-medium px-2 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
              >
                Remove link
              </button>
            </div>

          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-[11px] text-[#adb5bd] text-center leading-relaxed">
                Click a device or link to see its properties
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Action bar ─────────────────────────────────────────────── */}
      <div className="border-t border-surface-200 px-4 py-2.5 flex flex-wrap items-center gap-2 bg-white">
        <button onClick={handleAutoAssign} className="btn-primary text-xs py-1.5 px-3">
          Auto-assign IPs
        </button>
        <button
          onClick={handleAnalyze}
          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-surface-100 text-[#495057] hover:bg-surface-200 transition-colors"
        >
          Analyze
        </button>
        <button
          onClick={handleExport}
          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-surface-100 text-[#495057] hover:bg-surface-200 transition-colors"
        >
          Export Cisco Config
        </button>
        <button
          onClick={handleClear}
          className="ml-auto text-xs font-medium px-3 py-1.5 rounded-lg border border-surface-200 text-[#868e96] hover:text-red-500 hover:border-red-200 transition-colors"
        >
          Clear all
        </button>
        <span className="text-[11px] text-[#ced4da]">
          {topo.devices.length}d · {topo.links.length}l
        </span>
      </div>

      {/* ── Analysis panel ─────────────────────────────────────────── */}
      {analysis && (
        <div className="border-t border-surface-200 bg-surface-50 p-4 space-y-4 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between">
            <p className="section-label">Analysis</p>
            <button onClick={() => setAnalysis(null)} className="text-[10px] text-[#868e96] hover:text-[#495057]">✕ close</button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([
              { label: 'Devices',  value: analysis.deviceCount },
              { label: 'Links',    value: analysis.linkCount },
              { label: 'Subnets',  value: analysis.subnetCount },
              { label: 'Loops',    value: analysis.hasLoops ? '⚠ Yes' : '✓ No' },
            ] as const).map(s => (
              <div key={s.label} className="bg-white border border-surface-200 rounded-lg p-2 text-center">
                <p className="text-base font-bold text-[#1a1b1e]">{s.value}</p>
                <p className="text-[10px] text-[#868e96] uppercase font-semibold">{s.label}</p>
              </div>
            ))}
          </div>

          {analysis.hasLoops && (
            <div className="flex gap-2 items-start bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-lg">
              <span className="shrink-0">⚠</span>
              <span>Loop detected — if using switches, ensure STP is enabled to prevent broadcast storms.</span>
            </div>
          )}
          {analysis.disconnectedDevices.length > 0 && (
            <div className="flex gap-2 items-start bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-lg">
              <span className="shrink-0">⚠</span>
              <span>
                Disconnected:{' '}
                {analysis.disconnectedDevices
                  .map(id => topo.devices.find(d => d.id === id)?.label ?? id)
                  .join(', ')}
              </span>
            </div>
          )}
          {analysis.ipConflicts.length > 0 && (
            <div className="flex gap-2 items-start bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
              <span className="shrink-0">✕</span>
              <span>IP conflicts: {analysis.ipConflicts.join(', ')}</span>
            </div>
          )}

          {analysis.adjacencyTable.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-[#495057] mb-2">Adjacency table</p>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-surface-100">
                      {['Device', 'Local IF', 'Neighbor', 'Remote IF', 'Subnet'].map(h => (
                        <th key={h} className="text-left px-2 py-1.5 text-[10px] text-[#868e96] font-semibold uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.adjacencyTable.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-surface-50'}>
                        <td className="px-2 py-1 font-medium text-[#1a1b1e] whitespace-nowrap">{row.deviceLabel}</td>
                        <td className="px-2 py-1 font-mono text-[#495057] whitespace-nowrap">{row.localInterface}</td>
                        <td className="px-2 py-1 font-medium text-[#1a1b1e] whitespace-nowrap">{row.neighborLabel}</td>
                        <td className="px-2 py-1 font-mono text-[#495057] whitespace-nowrap">{row.remoteInterface}</td>
                        <td className="px-2 py-1 font-mono text-brand-600 whitespace-nowrap">{row.subnet ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#adb5bd] text-center py-2">No links — connect devices to see adjacency data</p>
          )}
        </div>
      )}

      {/* ── Export modal ───────────────────────────────────────────── */}
      {showExport && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowExport(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-surface-200 shrink-0">
              <p className="font-semibold text-[#1a1b1e] text-sm">Cisco IOS Configuration</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyExport}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    copied
                      ? 'bg-green-100 text-green-700'
                      : 'bg-surface-100 text-[#495057] hover:bg-surface-200'
                  }`}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={() => setShowExport(false)}
                  className="text-[#868e96] hover:text-[#495057] text-lg leading-none w-7 h-7 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            </div>
            <pre className="flex-1 overflow-auto p-5 text-xs font-mono leading-relaxed bg-[#1a1b1e] text-[#abb2bf]">
              {exportText}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
