import { useState, useCallback } from 'react';
import { planVLSM, type VLSMRequirement, type VLSMPlan } from '../../lib/network/vlsm';

interface RequirementRow {
  id: number;
  name: string;
  hosts: string;
}

let nextId = 1;

const DEFAULT_ROWS: RequirementRow[] = [
  { id: nextId++, name: 'LAN-Ventas', hosts: '50' },
  { id: nextId++, name: 'LAN-RRHH', hosts: '25' },
  { id: nextId++, name: 'LAN-Servidores', hosts: '10' },
  { id: nextId++, name: 'WAN-Link', hosts: '2' },
];

export default function VLSMPlanner() {
  const [parentBlock, setParentBlock] = useState('192.168.1.0/24');
  const [rows, setRows] = useState<RequirementRow[]>(DEFAULT_ROWS);
  const [plan, setPlan] = useState<VLSMPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addRow = () => setRows(r => [...r, { id: nextId++, name: '', hosts: '' }]);
  const removeRow = (id: number) => setRows(r => r.filter(row => row.id !== id));
  const updateRow = (id: number, field: 'name' | 'hosts', value: string) =>
    setRows(r => r.map(row => row.id === id ? { ...row, [field]: value } : row));

  const calculate = useCallback(() => {
    setError(null);
    try {
      const requirements: VLSMRequirement[] = rows
        .filter(r => r.name.trim() && r.hosts.trim())
        .map(r => ({
          name: r.name.trim(),
          requiredHosts: parseInt(r.hosts, 10),
        }));
      if (requirements.length === 0) throw new Error('Add at least one requirement');
      if (requirements.some(r => isNaN(r.requiredHosts) || r.requiredHosts < 1))
        throw new Error('All host counts must be positive integers');
      const result = planVLSM(parentBlock.trim(), requirements);
      setPlan(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid input');
      setPlan(null);
    }
  }, [parentBlock, rows]);

  const utilizationStyle = (pct: number) => ({
    color:           pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--error)',
    backgroundColor: pct >= 80 ? 'var(--success-subtle)' : pct >= 50 ? 'var(--warning-subtle)' : 'var(--error-subtle)',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Parent block input */}
      <div className="tool-card">
        <p className="section-label" style={{ marginBottom: '0.75rem' }}>Parent network block</p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <input
            type="text"
            value={parentBlock}
            onChange={e => setParentBlock(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && calculate()}
            placeholder="192.168.1.0/24"
            className="input-field"
            style={{ flex: 1 }}
            aria-label="Parent network block CIDR"
            spellCheck={false}
          />
          <button onClick={calculate} className="btn-primary">
            Plan VLSM
          </button>
        </div>
      </div>

      {/* Requirements table */}
      <div className="tool-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <p className="section-label">Subnet requirements</p>
          <button
            onClick={addRow}
            aria-label="Add requirement row"
            style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            + Add row
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 120px 32px',
              gap: '0.5rem',
              padding: '0 0.25rem',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 500 }}>Subnet name</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 500 }}>Hosts needed</span>
            <span />
          </div>

          {rows.map(row => (
            <div
              key={row.id}
              style={{ display: 'grid', gridTemplateColumns: '1fr 120px 32px', gap: '0.5rem', alignItems: 'center' }}
            >
              <input
                type="text"
                value={row.name}
                onChange={e => updateRow(row.id, 'name', e.target.value)}
                placeholder="LAN-Sales"
                className="input-field"
                aria-label="Subnet name"
              />
              <input
                type="number"
                value={row.hosts}
                onChange={e => updateRow(row.id, 'hosts', e.target.value)}
                placeholder="50"
                min="1"
                max="16777214"
                className="input-field"
                aria-label="Required hosts"
              />
              <button
                onClick={() => removeRow(row.id)}
                disabled={rows.length === 1}
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
                  cursor: rows.length === 1 ? 'not-allowed' : 'pointer',
                  borderRadius: '6px',
                  fontSize: '1.125rem',
                  transition: 'color 150ms ease',
                  opacity: rows.length === 1 ? 0.3 : 1,
                }}
              >
                ×
              </button>
            </div>
          ))}
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

      {/* Results */}
      {plan && (
        <>
          {/* Plan summary */}
          <div className="tool-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <p className="section-label">Plan summary</p>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: '0.25rem 0.625rem',
                  borderRadius: '9999px',
                  backgroundColor: plan.fits ? 'var(--success-subtle)' : 'var(--error-subtle)',
                  color: plan.fits ? 'var(--success)' : 'var(--error)',
                }}
              >
                {plan.fits ? 'All subnets allocated' : 'Does not fit — partial plan'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }} className="sm-4col">
              {[
                { label: 'Required hosts',  value: plan.totalRequiredHosts.toLocaleString() },
                { label: 'Allocated hosts', value: plan.totalUsableHosts.toLocaleString() },
                { label: 'Wasted hosts',    value: plan.totalWastedHosts.toLocaleString() },
                { label: 'Remaining space', value: `${plan.remainingAddresses} addrs` },
              ].map(stat => (
                <div
                  key={stat.label}
                  style={{
                    backgroundColor: 'var(--canvas)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    padding: '0.875rem',
                  }}
                >
                  <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginBottom: '0.375rem' }}>{stat.label}</p>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: 'var(--text-1)' }}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Allocation table */}
          <div className="tool-card" style={{ overflowX: 'auto' }}>
            <p className="section-label" style={{ marginBottom: '0.75rem' }}>Allocation table</p>
            <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid var(--border)` }}>
                  {['Subnet', 'Network', 'Mask', 'First host', 'Last host', 'Hosts req.', 'Usable', 'Util.'].map(h => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        fontSize: '0.6875rem',
                        color: 'var(--text-3)',
                        fontWeight: 600,
                        paddingBottom: '0.625rem',
                        paddingRight: '1rem',
                        whiteSpace: 'nowrap',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.allocations.map((alloc, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid var(--border-subtle)` }}>
                    <td style={{ padding: '0.625rem 1rem 0.625rem 0', fontWeight: 500, color: 'var(--text-1)', whiteSpace: 'nowrap' }}>
                      {alloc.requirement.name}
                    </td>
                    <td style={{ padding: '0.625rem 1rem 0.625rem 0', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem', color: 'var(--accent-text)', whiteSpace: 'nowrap' }}>
                      {alloc.subnet.networkAddress}/{alloc.prefix}
                    </td>
                    <td style={{ padding: '0.625rem 1rem 0.625rem 0', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                      {alloc.subnet.subnetMask}
                    </td>
                    <td style={{ padding: '0.625rem 1rem 0.625rem 0', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                      {alloc.subnet.firstHost}
                    </td>
                    <td style={{ padding: '0.625rem 1rem 0.625rem 0', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                      {alloc.subnet.lastHost}
                    </td>
                    <td style={{ padding: '0.625rem 1rem 0.625rem 0', textAlign: 'center', color: 'var(--text-2)' }}>
                      {alloc.requirement.requiredHosts}
                    </td>
                    <td style={{ padding: '0.625rem 1rem 0.625rem 0', textAlign: 'center', color: 'var(--text-2)' }}>
                      {alloc.subnet.usableHosts}
                    </td>
                    <td style={{ padding: '0.625rem 0' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '9999px',
                          ...utilizationStyle(alloc.utilizationPct),
                        }}
                      >
                        {alloc.utilizationPct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!plan && !error && (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-3)', textAlign: 'center', padding: '1rem 0' }}>
          Fill in the requirements and click Plan VLSM
        </p>
      )}
    </div>
  );
}
