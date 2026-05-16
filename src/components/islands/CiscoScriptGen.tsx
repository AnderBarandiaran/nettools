import { useState } from 'react';
import { generateCiscoScript, type GeneratedScript } from '../../lib/network/cisco';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'interface-basic' | 'ospf-basic' | 'static-routes' | 'acl-extended';

const TABS: { id: Tab; label: string }[] = [
  { id: 'interface-basic', label: 'Interface'     },
  { id: 'ospf-basic',      label: 'OSPF'          },
  { id: 'static-routes',   label: 'Static Routes' },
  { id: 'acl-extended',    label: 'Extended ACL'  },
];

let _uid = 0;
const uid = () => ++_uid;

type OspfNet  = { id: number; network: string; wildcard: string; area: string };
type Passive  = { id: number; iface: string };
type SRoute   = { id: number; destination: string; mask: string; nextHop: string; dist: string; desc: string };
type AclRule  = { id: number; action: string; protocol: string; source: string; destination: string; port: string; remark: string };

// ─── Default state ────────────────────────────────────────────────────────────

const D_OSPF_NETS: OspfNet[] = [
  { id: uid(), network: '192.168.1.0', wildcard: '0.0.0.255', area: '0' },
  { id: uid(), network: '10.0.0.0',    wildcard: '0.0.0.3',   area: '0' },
];
const D_OSPF_PASS: Passive[] = [{ id: uid(), iface: 'GigabitEthernet0/1' }];

const D_ROUTES: SRoute[] = [
  { id: uid(), destination: '0.0.0.0', mask: '0.0.0.0',     nextHop: '203.0.113.1',  dist: '',   desc: 'Default route — ISP' },
  { id: uid(), destination: '10.0.0.0', mask: '255.255.0.0', nextHop: '192.168.1.254', dist: '10', desc: 'Branch offices' },
];

const D_ACL_RULES: AclRule[] = [
  { id: uid(), action: 'permit', protocol: 'tcp',  source: '192.168.1.0 0.0.0.255', destination: 'any', port: 'eq 80',  remark: 'Allow HTTP'  },
  { id: uid(), action: 'permit', protocol: 'tcp',  source: '192.168.1.0 0.0.0.255', destination: 'any', port: 'eq 443', remark: 'Allow HTTPS' },
  { id: uid(), action: 'permit', protocol: 'icmp', source: '192.168.1.0 0.0.0.255', destination: 'any', port: '',       remark: 'Allow ping'  },
  { id: uid(), action: 'deny',   protocol: 'ip',   source: 'any',                   destination: 'any', port: '',       remark: ''            },
];

// ─── Terminal renderer ────────────────────────────────────────────────────────

function TerminalLine({ line, index }: { line: string; index: number }) {
  const t = line.trimStart();

  if (t.startsWith('!')) {
    return <span key={index} className="block text-[#5c6370]">{line || ' '}</span>;
  }

  // Color permit/deny keywords
  if (/\b(permit|deny)\b/.test(t)) {
    const parts = line.split(/(\bpermit\b|\bdeny\b)/);
    return (
      <span key={index} className="block">
        {parts.map((p, j) =>
          p === 'permit' ? <span key={j} className="text-[#98c379]">{p}</span> :
          p === 'deny'   ? <span key={j} className="text-[#e06c75]">{p}</span> :
          <span key={j} className="text-[#abb2bf]">{p}</span>
        )}
      </span>
    );
  }

  return <span key={index} className="block text-[#abb2bf]">{line || ' '}</span>;
}

// ─── Small helpers ────────────────────────────────────────────────────────────

const FL = ({ text }: { text: string }) => (
  <p className="text-xs font-medium text-[#495057] mb-1">{text}</p>
);

const RemoveBtn = ({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="h-9 w-8 flex items-center justify-center text-[#adb5bd] hover:text-red-500 transition-colors rounded disabled:opacity-30"
    aria-label="Remove row"
  >
    ×
  </button>
);

const AddBtn = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button onClick={onClick} className="text-xs font-medium text-brand-600 hover:text-brand-700">
    {label}
  </button>
);

// ─── Main component ───────────────────────────────────────────────────────────

export default function CiscoScriptGen() {
  const [tab, setTab]       = useState<Tab>('interface-basic');
  const [result, setResult] = useState<GeneratedScript | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ── interface-basic state ────────────────────────────────────────────────
  const [ifName,     setIfName]     = useState('GigabitEthernet0/0');
  const [ifIp,       setIfIp]       = useState('192.168.1.1');
  const [ifMask,     setIfMask]     = useState('255.255.255.0');
  const [ifDesc,     setIfDesc]     = useState('LAN — Main office');
  const [ifShutdown, setIfShutdown] = useState(false);
  const [ifDuplex,   setIfDuplex]   = useState(true);
  const [ifSpeed,    setIfSpeed]    = useState(true);

  // ── ospf-basic state ─────────────────────────────────────────────────────
  const [ospfPid,  setOspfPid]  = useState('1');
  const [ospfRid,  setOspfRid]  = useState('1.1.1.1');
  const [ospfNets, setOspfNets] = useState<OspfNet[]>(D_OSPF_NETS);
  const [ospfPass, setOspfPass] = useState<Passive[]>(D_OSPF_PASS);
  const [ospfDef,  setOspfDef]  = useState(false);

  const updNet  = (id: number, f: keyof Omit<OspfNet, 'id'>, v: string) =>
    setOspfNets(rs => rs.map(r => r.id === id ? { ...r, [f]: v } : r));
  const addNet  = () => setOspfNets(rs => [...rs, { id: uid(), network: '', wildcard: '', area: '0' }]);
  const rmNet   = (id: number) => setOspfNets(rs => rs.filter(r => r.id !== id));

  const updPass = (id: number, v: string) =>
    setOspfPass(rs => rs.map(r => r.id === id ? { ...r, iface: v } : r));
  const addPass = () => setOspfPass(rs => [...rs, { id: uid(), iface: '' }]);
  const rmPass  = (id: number) => setOspfPass(rs => rs.filter(r => r.id !== id));

  // ── static-routes state ──────────────────────────────────────────────────
  const [routes, setRoutes] = useState<SRoute[]>(D_ROUTES);

  const updRoute = (id: number, f: keyof Omit<SRoute, 'id'>, v: string) =>
    setRoutes(rs => rs.map(r => r.id === id ? { ...r, [f]: v } : r));
  const addRoute = () =>
    setRoutes(rs => [...rs, { id: uid(), destination: '', mask: '', nextHop: '', dist: '', desc: '' }]);
  const rmRoute  = (id: number) => setRoutes(rs => rs.filter(r => r.id !== id));

  // ── acl-extended state ───────────────────────────────────────────────────
  const [aclName,     setAclName]     = useState('INTERNET-ACCESS');
  const [aclRules,    setAclRules]    = useState<AclRule[]>(D_ACL_RULES);
  const [aclAppIface, setAclAppIface] = useState('');
  const [aclAppDir,   setAclAppDir]   = useState<'in' | 'out'>('in');

  const updRule = (id: number, f: keyof Omit<AclRule, 'id'>, v: string) =>
    setAclRules(rs => rs.map(r => r.id === id ? { ...r, [f]: v } : r));
  const addRule = () =>
    setAclRules(rs => [...rs, { id: uid(), action: 'permit', protocol: 'ip', source: 'any', destination: 'any', port: '', remark: '' }]);
  const rmRule  = (id: number) => setAclRules(rs => rs.filter(r => r.id !== id));

  // ── generate ─────────────────────────────────────────────────────────────
  const generate = () => {
    setError(null);
    try {
      let r: GeneratedScript;

      if (tab === 'interface-basic') {
        r = generateCiscoScript({
          type:          'interface-basic',
          interfaceName: ifName.trim(),
          ipAddress:     ifIp.trim(),
          subnetMask:    ifMask.trim(),
          description:   ifDesc.trim() || undefined,
          shutdown:      ifShutdown,
          duplexAuto:    ifDuplex,
          speedAuto:     ifSpeed,
        });

      } else if (tab === 'ospf-basic') {
        r = generateCiscoScript({
          type:      'ospf-basic',
          processId: parseInt(ospfPid, 10) || 1,
          routerId:  ospfRid.trim() || undefined,
          networks:  ospfNets.filter(n => n.network.trim()).map(n => ({
            network:      n.network.trim(),
            wildcardMask: n.wildcard.trim(),
            area:         parseInt(n.area, 10) || 0,
          })),
          passiveInterfaces:           ospfPass.map(p => p.iface).filter(Boolean),
          defaultInformationOriginate: ospfDef,
        });

      } else if (tab === 'static-routes') {
        r = generateCiscoScript({
          type:   'static-routes',
          routes: routes.filter(rt => rt.destination.trim()).map(rt => ({
            destination:   rt.destination.trim(),
            mask:          rt.mask.trim(),
            nextHop:       rt.nextHop.trim(),
            adminDistance: rt.dist ? parseInt(rt.dist, 10) : undefined,
            description:   rt.desc.trim() || undefined,
          })),
        });

      } else {
        r = generateCiscoScript({
          type:  'acl-extended',
          name:  aclName.trim(),
          rules: aclRules.map(rule => ({
            action:          rule.action   as 'permit' | 'deny',
            protocol:        rule.protocol as 'ip' | 'tcp' | 'udp' | 'icmp',
            source:          rule.source.trim(),
            destination:     rule.destination.trim(),
            destinationPort: rule.port.trim() || undefined,
            remark:          rule.remark.trim() || undefined,
          })),
          applyToInterface: aclAppIface.trim()
            ? { interfaceName: aclAppIface.trim(), direction: aclAppDir }
            : undefined,
        });
      }

      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error generating script');
      setResult(null);
    }
  };

  const copyScript = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const inp = 'input-field';

  return (
    <div className="space-y-6">

      {/* ── Script type tabs ────────────────────────────────────────── */}
      <div className="tool-card">
        <p className="section-label mb-3">Script type</p>
        <div className="flex flex-wrap gap-2">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setResult(null); setError(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-brand-500 text-white'
                  : 'bg-surface-100 text-[#495057] hover:bg-surface-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Dynamic form ─────────────────────────────────────────────── */}
      <div className="tool-card space-y-5">

        {/* interface-basic ─────────────────────────────────────────── */}
        {tab === 'interface-basic' && (
          <>
            <p className="section-label">Interface parameters</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FL text="Interface name" />
                <input className={inp} value={ifName} onChange={e => setIfName(e.target.value)}
                  placeholder="GigabitEthernet0/0" spellCheck={false} />
              </div>
              <div>
                <FL text="Description (optional)" />
                <input className={inp} value={ifDesc} onChange={e => setIfDesc(e.target.value)}
                  placeholder="LAN segment" spellCheck={false} />
              </div>
              <div>
                <FL text="IP address" />
                <input className={inp} value={ifIp} onChange={e => setIfIp(e.target.value)}
                  placeholder="192.168.1.1" spellCheck={false} />
              </div>
              <div>
                <FL text="Subnet mask" />
                <input className={inp} value={ifMask} onChange={e => setIfMask(e.target.value)}
                  placeholder="255.255.255.0" spellCheck={false} />
              </div>
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-[#495057]">
                <input type="checkbox" checked={!ifShutdown} onChange={e => setIfShutdown(!e.target.checked)}
                  className="w-4 h-4 accent-brand-500" />
                no shutdown (port enabled)
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-[#495057]">
                <input type="checkbox" checked={ifDuplex} onChange={e => setIfDuplex(e.target.checked)}
                  className="w-4 h-4 accent-brand-500" />
                duplex auto
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-[#495057]">
                <input type="checkbox" checked={ifSpeed} onChange={e => setIfSpeed(e.target.checked)}
                  className="w-4 h-4 accent-brand-500" />
                speed auto
              </label>
            </div>
          </>
        )}

        {/* ospf-basic ──────────────────────────────────────────────── */}
        {tab === 'ospf-basic' && (
          <>
            <p className="section-label">OSPF process</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FL text="Process ID (1–65535)" />
                <input type="number" className={inp} value={ospfPid} min={1} max={65535}
                  onChange={e => setOspfPid(e.target.value)} />
              </div>
              <div>
                <FL text="Router ID (optional — e.g. loopback IP)" />
                <input className={inp} value={ospfRid} onChange={e => setOspfRid(e.target.value)}
                  placeholder="1.1.1.1" spellCheck={false} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <FL text="Network statements" />
                <AddBtn onClick={addNet} label="+ Add network" />
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_72px_32px] gap-2 text-xs text-[#868e96] font-medium px-1">
                  <span>Network address</span><span>Wildcard mask</span><span>Area</span><span />
                </div>
                {ospfNets.map(n => (
                  <div key={n.id} className="grid grid-cols-[1fr_1fr_72px_32px] gap-2 items-center">
                    <input className={inp} value={n.network}  onChange={e => updNet(n.id, 'network',  e.target.value)} placeholder="192.168.1.0" spellCheck={false} />
                    <input className={inp} value={n.wildcard} onChange={e => updNet(n.id, 'wildcard', e.target.value)} placeholder="0.0.0.255"   spellCheck={false} />
                    <input className={inp} value={n.area}     onChange={e => updNet(n.id, 'area',     e.target.value)} placeholder="0" />
                    <RemoveBtn onClick={() => rmNet(n.id)} disabled={ospfNets.length === 1} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <FL text="Passive interfaces (optional — suppress OSPF hellos)" />
                <AddBtn onClick={addPass} label="+ Add" />
              </div>
              <div className="space-y-2">
                {ospfPass.map(p => (
                  <div key={p.id} className="grid grid-cols-[1fr_32px] gap-2 items-center">
                    <input className={inp} value={p.iface} onChange={e => updPass(p.id, e.target.value)}
                      placeholder="GigabitEthernet0/1" spellCheck={false} />
                    <RemoveBtn onClick={() => rmPass(p.id)} />
                  </div>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-sm text-[#495057]">
              <input type="checkbox" checked={ospfDef} onChange={e => setOspfDef(e.target.checked)}
                className="w-4 h-4 accent-brand-500" />
              Redistribute default route (default-information originate)
            </label>
          </>
        )}

        {/* static-routes ───────────────────────────────────────────── */}
        {tab === 'static-routes' && (
          <>
            <div className="flex items-center justify-between">
              <p className="section-label">Static routes</p>
              <AddBtn onClick={addRoute} label="+ Add route" />
            </div>
            <div className="overflow-x-auto -mx-6 px-6">
              <div className="min-w-[700px] space-y-2">
                <div className="grid grid-cols-[1fr_1fr_1fr_72px_1fr_32px] gap-2 text-xs text-[#868e96] font-medium px-1">
                  <span>Destination</span><span>Mask</span><span>Next hop / Interface</span>
                  <span>AD</span><span>Description</span><span />
                </div>
                {routes.map(rt => (
                  <div key={rt.id} className="grid grid-cols-[1fr_1fr_1fr_72px_1fr_32px] gap-2 items-center">
                    <input className={inp} value={rt.destination} onChange={e => updRoute(rt.id, 'destination', e.target.value)} placeholder="0.0.0.0"      spellCheck={false} />
                    <input className={inp} value={rt.mask}        onChange={e => updRoute(rt.id, 'mask',        e.target.value)} placeholder="0.0.0.0"      spellCheck={false} />
                    <input className={inp} value={rt.nextHop}     onChange={e => updRoute(rt.id, 'nextHop',     e.target.value)} placeholder="10.0.0.1"     spellCheck={false} />
                    <input className={inp} value={rt.dist}        onChange={e => updRoute(rt.id, 'dist',        e.target.value)} placeholder="—" type="number" min={1} max={255} />
                    <input className={inp} value={rt.desc}        onChange={e => updRoute(rt.id, 'desc',        e.target.value)} placeholder="optional" />
                    <RemoveBtn onClick={() => rmRoute(rt.id)} disabled={routes.length === 1} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* acl-extended ────────────────────────────────────────────── */}
        {tab === 'acl-extended' && (
          <>
            <p className="section-label">Extended access list</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FL text="ACL name or number (100–199 for numbered extended)" />
                <input className={inp} value={aclName} onChange={e => setAclName(e.target.value)}
                  placeholder="INTERNET-ACCESS or 110" spellCheck={false} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="section-label">Access rules</p>
                <AddBtn onClick={addRule} label="+ Add rule" />
              </div>
              <div className="overflow-x-auto -mx-6 px-6">
                <div className="min-w-[860px] space-y-2">
                  <div className="grid grid-cols-[72px_80px_1fr_1fr_110px_1fr_32px] gap-2 text-xs text-[#868e96] font-medium px-1">
                    <span>Action</span><span>Protocol</span><span>Source</span>
                    <span>Destination</span><span>Dst port</span><span>Remark</span><span />
                  </div>
                  {aclRules.map(rule => {
                    const noPort = rule.protocol === 'ip' || rule.protocol === 'icmp';
                    return (
                      <div key={rule.id} className="grid grid-cols-[72px_80px_1fr_1fr_110px_1fr_32px] gap-2 items-center">
                        <select className={inp} value={rule.action}   onChange={e => updRule(rule.id, 'action',   e.target.value)}>
                          <option value="permit">permit</option>
                          <option value="deny">deny</option>
                        </select>
                        <select className={inp} value={rule.protocol} onChange={e => updRule(rule.id, 'protocol', e.target.value)}>
                          <option value="ip">ip</option>
                          <option value="tcp">tcp</option>
                          <option value="udp">udp</option>
                          <option value="icmp">icmp</option>
                        </select>
                        <input className={inp} value={rule.source}      onChange={e => updRule(rule.id, 'source',      e.target.value)} placeholder="any" spellCheck={false} />
                        <input className={inp} value={rule.destination} onChange={e => updRule(rule.id, 'destination', e.target.value)} placeholder="any" spellCheck={false} />
                        <input
                          className={`${inp} ${noPort ? 'opacity-40 cursor-not-allowed' : ''}`}
                          value={rule.port}
                          onChange={e => updRule(rule.id, 'port', e.target.value)}
                          placeholder="eq 80"
                          spellCheck={false}
                          disabled={noPort}
                        />
                        <input className={inp} value={rule.remark} onChange={e => updRule(rule.id, 'remark', e.target.value)} placeholder="optional" />
                        <RemoveBtn onClick={() => rmRule(rule.id)} disabled={aclRules.length === 1} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <FL text="Apply to interface (optional — leave interface blank to skip)" />
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px] gap-2">
                <input className={inp} value={aclAppIface} onChange={e => setAclAppIface(e.target.value)}
                  placeholder="GigabitEthernet0/0" spellCheck={false} />
                <select className={inp} value={aclAppDir} onChange={e => setAclAppDir(e.target.value as 'in' | 'out')}>
                  <option value="in">in</option>
                  <option value="out">out</option>
                </select>
              </div>
            </div>
          </>
        )}

        <div className="pt-2 border-t border-surface-100 flex justify-end">
          <button onClick={generate} className="btn-primary">
            Generate Script
          </button>
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg" role="alert">
          {error}
        </div>
      )}

      {/* ── Warnings ──────────────────────────────────────────────────── */}
      {result?.warnings.map((w, i) => (
        <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-lg">
          <span className="shrink-0 mt-px">⚠</span>
          <span>{w}</span>
        </div>
      ))}

      {/* ── Output terminal ───────────────────────────────────────────── */}
      {result && (
        <div className="tool-card">
          <div className="flex items-start justify-between mb-3 gap-4">
            <div>
              <p className="section-label">{result.title}</p>
              <p className="text-xs text-[#868e96] mt-0.5">{result.commandCount} IOS commands</p>
            </div>
            <button
              onClick={copyScript}
              className={`shrink-0 text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                copied
                  ? 'bg-green-100 text-green-700'
                  : 'bg-surface-100 text-[#495057] hover:bg-surface-200'
              }`}
            >
              {copied ? 'Copied!' : 'Copy to clipboard'}
            </button>
          </div>
          <pre className="bg-[#1a1b1e] rounded-lg p-4 overflow-auto max-h-[520px] text-xs font-mono leading-relaxed select-all">
            {result.script.split('\n').map((line, i) => (
              <TerminalLine key={i} line={line} index={i} />
            ))}
          </pre>
        </div>
      )}

      {!result && !error && (
        <p className="text-sm text-[#868e96] text-center py-4">
          Configure the parameters above and click Generate Script
        </p>
      )}
    </div>
  );
}
