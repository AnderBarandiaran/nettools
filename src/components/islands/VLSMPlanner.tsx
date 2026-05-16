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

  const utilizationColor = (pct: number) =>
    pct >= 80 ? 'text-green-700 bg-green-50' :
    pct >= 50 ? 'text-amber-700 bg-amber-50' :
    'text-red-700 bg-red-50';

  return (
    <div className="space-y-6">
      {/* Bloque padre */}
      <div className="tool-card">
        <p className="section-label mb-3">Parent network block</p>
        <div className="flex gap-3">
          <input
            type="text"
            value={parentBlock}
            onChange={e => setParentBlock(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && calculate()}
            placeholder="192.168.1.0/24"
            className="input-field flex-1"
            aria-label="Parent network block CIDR"
            spellCheck={false}
          />
          <button onClick={calculate} className="btn-primary whitespace-nowrap">
            Plan VLSM
          </button>
        </div>
      </div>

      {/* Tabla de requerimientos */}
      <div className="tool-card">
        <div className="flex items-center justify-between mb-3">
          <p className="section-label">Subnet requirements</p>
          <button
            onClick={addRow}
            className="text-xs font-medium text-brand-600 hover:text-brand-700"
            aria-label="Add requirement row"
          >
            + Add row
          </button>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_120px_32px] gap-2 text-xs text-[#868e96] font-medium px-1">
            <span>Subnet name</span>
            <span>Hosts needed</span>
            <span></span>
          </div>
          {rows.map(row => (
            <div key={row.id} className="grid grid-cols-[1fr_120px_32px] gap-2 items-center">
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
                className="h-9 w-8 flex items-center justify-center text-[#adb5bd] hover:text-red-500 transition-colors rounded"
                aria-label="Remove row"
                disabled={rows.length === 1}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg" role="alert">
          {error}
        </div>
      )}

      {/* Resultados */}
      {plan && (
        <>
          {/* Resumen */}
          <div className="tool-card">
            <div className="flex items-center gap-3 mb-4">
              <p className="section-label">Plan summary</p>
              {!plan.fits && (
                <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  Does not fit — partial plan
                </span>
              )}
              {plan.fits && (
                <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  All subnets allocated
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Required hosts', value: plan.totalRequiredHosts.toLocaleString() },
                { label: 'Allocated hosts', value: plan.totalUsableHosts.toLocaleString() },
                { label: 'Wasted hosts', value: plan.totalWastedHosts.toLocaleString() },
                { label: 'Remaining space', value: `${plan.remainingAddresses} addrs` },
              ].map(stat => (
                <div key={stat.label} className="bg-surface-50 rounded-lg p-3">
                  <p className="text-xs text-[#868e96] mb-1">{stat.label}</p>
                  <p className="font-mono font-semibold text-[#1a1b1e]">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tabla de asignaciones */}
          <div className="tool-card overflow-x-auto">
            <p className="section-label mb-3">Allocation table</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200">
                  {['Subnet', 'Network', 'Mask', 'First host', 'Last host', 'Hosts req.', 'Usable', 'Util.'].map(h => (
                    <th key={h} className="text-left text-xs text-[#868e96] font-medium pb-2 pr-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.allocations.map((alloc, i) => (
                  <tr key={i} className="border-b border-surface-100 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-[#1a1b1e]">{alloc.requirement.name}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs">{alloc.subnet.networkAddress}/{alloc.prefix}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs">{alloc.subnet.subnetMask}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs">{alloc.subnet.firstHost}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs">{alloc.subnet.lastHost}</td>
                    <td className="py-2.5 pr-4 text-center">{alloc.requirement.requiredHosts}</td>
                    <td className="py-2.5 pr-4 text-center">{alloc.subnet.usableHosts}</td>
                    <td className="py-2.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${utilizationColor(alloc.utilizationPct)}`}>
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
        <p className="text-sm text-[#868e96] text-center py-4">
          Fill in the requirements and click Plan VLSM
        </p>
      )}
    </div>
  );
}
