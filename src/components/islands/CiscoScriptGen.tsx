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

type OspfNet = { id: number; network: string; wildcard: string; area: string };
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
    return (
      <span key={index} style={{ display: 'block', color: 'oklch(45% 0.04 250)' }}>
        {line || ' '}
      </span>
    );
  }

  if (/\b(permit|deny)\b/.test(t)) {
    const parts = line.split(/(\bpermit\b|\bdeny\b)/);
    return (
      <span key={index} style={{ display: 'block' }}>
        {parts.map((p, j) =>
          p === 'permit'
            ? <span key={j} style={{ color: 'oklch(65% 0.15 160)' }}>{p}</span>
            : p === 'deny'
            ? <span key={j} style={{ color: 'oklch(62% 0.18 25)' }}>{p}</span>
            : <span key={j} style={{ color: 'oklch(72% 0.06 250)' }}>{p}</span>
        )}
      </span>
    );
  }

  return (
    <span key={index} style={{ display: 'block', color: 'oklch(72% 0.06 250)' }}>
      {line || ' '}
    </span>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

const FL = ({ text }: { text: string }) => (
  <p style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-2)', marginBottom: '0.375rem' }}>{text}</p>
);

const RemoveBtn = ({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    aria-label="Remove row"
    style={{
      height: '36px',
      width: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-3)',
      background: 'none',
      border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      borderRadius: '6px',
      fontSize: '1.125rem',
      opacity: disabled ? 0.3 : 1,
      transition: 'color 150ms ease',
      flexShrink: 0,
    }}
  >
    ×
  </button>
);

const AddBtn = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button
    onClick={onClick}
    style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
  >
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
    } catch { /* clipboard unavailable */ }
  };

  const inp = 'input-field';

  const checkboxLabel: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
    color: 'var(--text-2)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Script type tabs */}
      <div className="tool-card">
        <p className="section-label" style={{ marginBottom: '0.75rem' }}>Script type</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setResult(null); setError(null); }}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 150ms ease, color 150ms ease',
                backgroundColor: tab === t.id ? 'var(--accent)' : 'var(--surface-shell)',
                color:           tab === t.id ? 'oklch(99% 0.004 250)' : 'var(--text-2)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic form */}
      <div className="tool-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* interface-basic */}
        {tab === 'interface-basic' && (
          <>
            <p className="section-label">Interface parameters</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div><FL text="Interface name" /><input className={inp} value={ifName} onChange={e => setIfName(e.target.value)} placeholder="GigabitEthernet0/0" spellCheck={false} /></div>
              <div><FL text="Description (optional)" /><input className={inp} value={ifDesc} onChange={e => setIfDesc(e.target.value)} placeholder="LAN segment" spellCheck={false} /></div>
              <div><FL text="IP address" /><input className={inp} value={ifIp} onChange={e => setIfIp(e.target.value)} placeholder="192.168.1.1" spellCheck={false} /></div>
              <div><FL text="Subnet mask" /><input className={inp} value={ifMask} onChange={e => setIfMask(e.target.value)} placeholder="255.255.255.0" spellCheck={false} /></div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
              <label style={checkboxLabel}><input type="checkbox" checked={!ifShutdown} onChange={e => setIfShutdown(!e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }} />no shutdown (port enabled)</label>
              <label style={checkboxLabel}><input type="checkbox" checked={ifDuplex} onChange={e => setIfDuplex(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }} />duplex auto</label>
              <label style={checkboxLabel}><input type="checkbox" checked={ifSpeed} onChange={e => setIfSpeed(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }} />speed auto</label>
            </div>
          </>
        )}

        {/* ospf-basic */}
        {tab === 'ospf-basic' && (
          <>
            <p className="section-label">OSPF process</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div><FL text="Process ID (1–65535)" /><input type="number" className={inp} value={ospfPid} min={1} max={65535} onChange={e => setOspfPid(e.target.value)} /></div>
              <div><FL text="Router ID (optional)" /><input className={inp} value={ospfRid} onChange={e => setOspfRid(e.target.value)} placeholder="1.1.1.1" spellCheck={false} /></div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <FL text="Network statements" />
                <AddBtn onClick={addNet} label="+ Add network" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 72px 32px', gap: '0.5rem', padding: '0 0.25rem' }}>
                  {['Network address', 'Wildcard mask', 'Area', ''].map(h => (
                    <span key={h} style={{ fontSize: '0.6875rem', color: 'var(--text-3)', fontWeight: 500 }}>{h}</span>
                  ))}
                </div>
                {ospfNets.map(n => (
                  <div key={n.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 72px 32px', gap: '0.5rem', alignItems: 'center' }}>
                    <input className={inp} value={n.network}  onChange={e => updNet(n.id, 'network',  e.target.value)} placeholder="192.168.1.0" spellCheck={false} />
                    <input className={inp} value={n.wildcard} onChange={e => updNet(n.id, 'wildcard', e.target.value)} placeholder="0.0.0.255"   spellCheck={false} />
                    <input className={inp} value={n.area}     onChange={e => updNet(n.id, 'area',     e.target.value)} placeholder="0" />
                    <RemoveBtn onClick={() => rmNet(n.id)} disabled={ospfNets.length === 1} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <FL text="Passive interfaces (optional)" />
                <AddBtn onClick={addPass} label="+ Add" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {ospfPass.map(p => (
                  <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 32px', gap: '0.5rem', alignItems: 'center' }}>
                    <input className={inp} value={p.iface} onChange={e => updPass(p.id, e.target.value)} placeholder="GigabitEthernet0/1" spellCheck={false} />
                    <RemoveBtn onClick={() => rmPass(p.id)} />
                  </div>
                ))}
              </div>
            </div>

            <label style={checkboxLabel}>
              <input type="checkbox" checked={ospfDef} onChange={e => setOspfDef(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }} />
              Redistribute default route (default-information originate)
            </label>
          </>
        )}

        {/* static-routes */}
        {tab === 'static-routes' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p className="section-label">Static routes</p>
              <AddBtn onClick={addRoute} label="+ Add route" />
            </div>
            <div style={{ overflowX: 'auto', marginLeft: '-1.5rem', marginRight: '-1.5rem', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
              <div style={{ minWidth: '700px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 72px 1fr 32px', gap: '0.5rem', padding: '0 0.25rem' }}>
                  {['Destination', 'Mask', 'Next hop', 'AD', 'Description', ''].map(h => (
                    <span key={h} style={{ fontSize: '0.6875rem', color: 'var(--text-3)', fontWeight: 500 }}>{h}</span>
                  ))}
                </div>
                {routes.map(rt => (
                  <div key={rt.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 72px 1fr 32px', gap: '0.5rem', alignItems: 'center' }}>
                    <input className={inp} value={rt.destination} onChange={e => updRoute(rt.id, 'destination', e.target.value)} placeholder="0.0.0.0" spellCheck={false} />
                    <input className={inp} value={rt.mask}        onChange={e => updRoute(rt.id, 'mask',        e.target.value)} placeholder="0.0.0.0" spellCheck={false} />
                    <input className={inp} value={rt.nextHop}     onChange={e => updRoute(rt.id, 'nextHop',     e.target.value)} placeholder="10.0.0.1" spellCheck={false} />
                    <input className={inp} value={rt.dist}        onChange={e => updRoute(rt.id, 'dist',        e.target.value)} placeholder="—" type="number" min={1} max={255} />
                    <input className={inp} value={rt.desc}        onChange={e => updRoute(rt.id, 'desc',        e.target.value)} placeholder="optional" />
                    <RemoveBtn onClick={() => rmRoute(rt.id)} disabled={routes.length === 1} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* acl-extended */}
        {tab === 'acl-extended' && (
          <>
            <p className="section-label">Extended access list</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div>
                <FL text="ACL name or number (100–199 for numbered extended)" />
                <input className={inp} value={aclName} onChange={e => setAclName(e.target.value)} placeholder="INTERNET-ACCESS or 110" spellCheck={false} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <p className="section-label">Access rules</p>
                <AddBtn onClick={addRule} label="+ Add rule" />
              </div>
              <div style={{ overflowX: 'auto', marginLeft: '-1.5rem', marginRight: '-1.5rem', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                <div style={{ minWidth: '860px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '72px 80px 1fr 1fr 110px 1fr 32px', gap: '0.5rem', padding: '0 0.25rem' }}>
                    {['Action', 'Protocol', 'Source', 'Destination', 'Dst port', 'Remark', ''].map(h => (
                      <span key={h} style={{ fontSize: '0.6875rem', color: 'var(--text-3)', fontWeight: 500 }}>{h}</span>
                    ))}
                  </div>
                  {aclRules.map(rule => {
                    const noPort = rule.protocol === 'ip' || rule.protocol === 'icmp';
                    return (
                      <div key={rule.id} style={{ display: 'grid', gridTemplateColumns: '72px 80px 1fr 1fr 110px 1fr 32px', gap: '0.5rem', alignItems: 'center' }}>
                        <select className={inp} value={rule.action}   onChange={e => updRule(rule.id, 'action',   e.target.value)}><option value="permit">permit</option><option value="deny">deny</option></select>
                        <select className={inp} value={rule.protocol} onChange={e => updRule(rule.id, 'protocol', e.target.value)}><option value="ip">ip</option><option value="tcp">tcp</option><option value="udp">udp</option><option value="icmp">icmp</option></select>
                        <input className={inp} value={rule.source}      onChange={e => updRule(rule.id, 'source',      e.target.value)} placeholder="any" spellCheck={false} />
                        <input className={inp} value={rule.destination} onChange={e => updRule(rule.id, 'destination', e.target.value)} placeholder="any" spellCheck={false} />
                        <input
                          className={inp}
                          value={rule.port}
                          onChange={e => updRule(rule.id, 'port', e.target.value)}
                          placeholder="eq 80"
                          spellCheck={false}
                          disabled={noPort}
                          style={{ opacity: noPort ? 0.4 : 1, cursor: noPort ? 'not-allowed' : undefined }}
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
              <FL text="Apply to interface (optional — leave blank to skip)" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '0.5rem' }}>
                <input className={inp} value={aclAppIface} onChange={e => setAclAppIface(e.target.value)} placeholder="GigabitEthernet0/0" spellCheck={false} />
                <select className={inp} value={aclAppDir} onChange={e => setAclAppDir(e.target.value as 'in' | 'out')}><option value="in">in</option><option value="out">out</option></select>
              </div>
            </div>
          </>
        )}

        <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={generate} className="btn-primary">
            Generate Script
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--error-subtle)',
            border: '1px solid var(--error)',
            color: 'var(--error)',
            fontSize: '0.875rem',
            padding: '0.875rem 1rem',
            borderRadius: '12px',
          }}
        >
          {error}
        </div>
      )}

      {/* Warnings */}
      {result?.warnings.map((w, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            backgroundColor: 'var(--warning-subtle)',
            border: '1px solid var(--warning)',
            color: 'var(--warning)',
            fontSize: '0.875rem',
            padding: '0.875rem 1rem',
            borderRadius: '12px',
          }}
        >
          <span style={{ flexShrink: 0, marginTop: '1px' }}>⚠</span>
          <span>{w}</span>
        </div>
      ))}

      {/* Output terminal */}
      {result && (
        <div className="tool-card">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.875rem', gap: '1rem' }}>
            <div>
              <p className="section-label">{result.title}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>{result.commandCount} IOS commands</p>
            </div>
            <button
              onClick={copyScript}
              style={{
                flexShrink: 0,
                fontSize: '0.875rem',
                fontWeight: 500,
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 150ms ease',
                backgroundColor: copied ? 'var(--success-subtle)' : 'var(--surface-shell)',
                color:           copied ? 'var(--success)'        : 'var(--text-2)',
              }}
            >
              {copied ? 'Copied!' : 'Copy to clipboard'}
            </button>
          </div>
          <pre
            style={{
              backgroundColor: 'oklch(13% 0.016 250)',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              overflowX: 'auto',
              maxHeight: '520px',
              fontSize: '0.75rem',
              fontFamily: "'JetBrains Mono', monospace",
              lineHeight: 1.7,
              userSelect: 'all',
              margin: 0,
            }}
          >
            {result.script.split('\n').map((line, i) => (
              <TerminalLine key={i} line={line} index={i} />
            ))}
          </pre>
        </div>
      )}

      {!result && !error && (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-3)', textAlign: 'center', padding: '1rem 0' }}>
          Configure the parameters above and click Generate Script
        </p>
      )}
    </div>
  );
}
