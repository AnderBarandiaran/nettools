import { useState, useCallback, useRef } from 'react';
import { calculateSubnet, type SubnetInfo } from '../../lib/network/ipv4';

type InputMode = 'cidr' | 'mask';

export default function SubnetCalculator() {
  const [input, setInput] = useState('192.168.1.0/24');
  const inputRef = useRef('192.168.1.0/24');
  // DOM ref: read actual input value when calculate fires, bypassing React state lag
  const inputElRef = useRef<HTMLInputElement>(null);
  const [mode] = useState<InputMode>('cidr');
  const [result, setResult] = useState<SubnetInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(() => {
    // Prefer DOM value (always current even when onChange hasn't fired yet)
    const value = inputElRef.current?.value ?? inputRef.current;
    setError(null);
    try {
      const info = calculateSubnet(value.trim());
      setResult(info);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid input');
      setResult(null);
    }
  }, []);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') calculate();
  };

  const ResultRow = ({ label, value, mono = false }: { label: string; value: string | number; mono?: boolean }) => (
    <div className="flex justify-between items-center py-2.5 border-b border-surface-100 last:border-0">
      <span className="text-sm text-[#495057]">{label}</span>
      <span className={`text-sm font-medium text-[#1a1b1e] ${mono ? 'font-mono' : ''}`}>
        {String(value)}
      </span>
    </div>
  );

  return (
    <div className="tool-card">
      {/* Input */}
      <div className="flex gap-3 mb-6">
        <input
          ref={inputElRef}
          type="text"
          value={input}
          onChange={e => { setInput(e.target.value); inputRef.current = e.target.value; }}
          onKeyDown={handleKey}
          placeholder="192.168.1.0/24"
          className="input-field flex-1"
          aria-label="IPv4 CIDR notation input"
          spellCheck={false}
        />
        <button
          onClick={calculate}
          className="btn-primary whitespace-nowrap"
          aria-label="Calculate subnet"
        >
          Calculate
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4" role="alert">
          {error}
        </div>
      )}

      {/* Resultados */}
      {result && (
        <div className="space-y-6">
          <div>
            <p className="section-label mb-3">Network information</p>
            <div className="bg-surface-50 rounded-lg px-4">
              <ResultRow label="Network address" value={result.networkAddress} mono />
              <ResultRow label="Broadcast address" value={result.broadcastAddress} mono />
              <ResultRow label="First usable host" value={result.firstHost} mono />
              <ResultRow label="Last usable host" value={result.lastHost} mono />
              <ResultRow label="Usable hosts" value={result.usableHosts.toLocaleString()} />
              <ResultRow label="Total addresses" value={result.totalHosts.toLocaleString()} />
            </div>
          </div>

          <div>
            <p className="section-label mb-3">Mask details</p>
            <div className="bg-surface-50 rounded-lg px-4">
              <ResultRow label="Subnet mask" value={result.subnetMask} mono />
              <ResultRow label="Wildcard mask" value={result.wildcardMask} mono />
              <ResultRow label="CIDR prefix" value={`/${result.prefix}`} mono />
            </div>
          </div>

          <div>
            <p className="section-label mb-3">Classification</p>
            <div className="bg-surface-50 rounded-lg px-4">
              <ResultRow label="IP class" value={`Class ${result.ipClass}`} />
              <ResultRow label="Private range (RFC 1918)" value={result.isPrivate ? 'Yes' : 'No'} />
            </div>
          </div>

          <div>
            <p className="section-label mb-3">Binary</p>
            <div className="bg-surface-50 rounded-lg px-4 py-3">
              <p className="text-xs text-[#868e96] mb-1">Network address</p>
              <p className="font-mono text-xs text-[#1a1b1e] break-all leading-relaxed">
                {result.binaryNetworkAddress.slice(0, 8)}.{result.binaryNetworkAddress.slice(8, 16)}.{result.binaryNetworkAddress.slice(16, 24)}.{result.binaryNetworkAddress.slice(24, 32)}
              </p>
              <p className="text-xs text-[#868e96] mt-3 mb-1">Subnet mask</p>
              <p className="font-mono text-xs text-[#1a1b1e] break-all leading-relaxed">
                {result.binarySubnetMask.slice(0, 8)}.{result.binarySubnetMask.slice(8, 16)}.{result.binarySubnetMask.slice(16, 24)}.{result.binarySubnetMask.slice(24, 32)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Estado inicial */}
      {!result && !error && (
        <p className="text-sm text-[#868e96] text-center py-8">
          Enter a CIDR notation above and press Calculate or Enter
        </p>
      )}
    </div>
  );
}
