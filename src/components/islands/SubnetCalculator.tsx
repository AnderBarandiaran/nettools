import { useState, useCallback, useRef } from 'react';
import { calculateSubnet, type SubnetInfo } from '../../lib/network/ipv4';

export default function SubnetCalculator() {
  const [input, setInput] = useState('192.168.1.0/24');
  const inputElRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<SubnetInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(() => {
    const value = inputElRef.current?.value ?? input;
    setError(null);
    try {
      const info = calculateSubnet(value.trim());
      setResult(info);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid input');
      setResult(null);
    }
  }, [input]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') calculate();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Input row */}
      <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'stretch' }}>
        <input
          ref={inputElRef}
          type="text"
          defaultValue={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="192.168.1.0/24 or 10.0.0.0 255.0.0.0"
          className="input-field"
          style={{ flex: 1 }}
          aria-label="IPv4 CIDR notation"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
        />
        <button
          onClick={calculate}
          className="btn-primary"
          aria-label="Calculate subnet"
          style={{ flexShrink: 0 }}
        >
          Calculate
        </button>
      </div>

      {/* Error */}
      {error && (
        <p
          role="alert"
          style={{
            fontSize: '0.875rem',
            color: 'var(--error)',
            padding: '0.625rem 0.875rem',
            backgroundColor: 'var(--error-subtle)',
            border: '1px solid var(--error)',
            borderRadius: '4px',
          }}
        >
          {error}
        </p>
      )}

      {/* Results table */}
      {result && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.9375rem',
            border: '1px solid var(--border)',
          }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--canvas)' }}>
                <th style={thStyle}>Parameter</th>
                <th style={thStyle}>Value</th>
              </tr>
            </thead>
            <tbody>
              <ResultRow label="Network address"   value={result.networkAddress}  accent />
              <ResultRow label="Broadcast address" value={result.broadcastAddress} warn />
              <ResultRow label="First usable host" value={result.firstHost} />
              <ResultRow label="Last usable host"  value={result.lastHost} />
              <ResultRow label="Usable hosts"      value={result.usableHosts.toLocaleString()} />
              <ResultRow label="Total addresses"   value={result.totalHosts.toLocaleString()} />
              <ResultRow label="Subnet mask"       value={result.subnetMask} />
              <ResultRow label="Wildcard mask"     value={result.wildcardMask} />
              <ResultRow label="CIDR prefix"       value={`/${result.prefix}`} />
              <ResultRow label="IP class"          value={`Class ${result.ipClass}`} />
              <ResultRow label="Private (RFC 1918)" value={result.isPrivate ? 'Yes' : 'No'} />
            </tbody>
          </table>

          {/* Binary section */}
          <div style={{ marginTop: '1.5rem' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '0.625rem' }}>
              Binary representation
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', border: '1px solid var(--border)' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--canvas)' }}>
                  <th style={thStyle}>Field</th>
                  <th style={thStyle}>Binary</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdLabel}>Network address</td>
                  <td style={{ ...tdMono, color: 'var(--accent-text)' }}>{fmt(result.binaryNetworkAddress)}</td>
                </tr>
                <tr style={{ backgroundColor: 'var(--canvas)' }}>
                  <td style={tdLabel}>Subnet mask</td>
                  <td style={tdMono}>{fmt(result.binarySubnetMask)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !error && (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-3)', padding: '1rem 0' }}>
          Enter a CIDR address above and press Calculate or Enter.
        </p>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.625rem 0.875rem',
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  color: 'var(--text-3)',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
};

const tdLabel: React.CSSProperties = {
  padding: '0.625rem 0.875rem',
  color: 'var(--text-2)',
  fontSize: '0.875rem',
  borderBottom: '1px solid var(--border-subtle)',
  whiteSpace: 'nowrap',
  fontWeight: 500,
};

const tdMono: React.CSSProperties = {
  padding: '0.625rem 0.875rem',
  fontFamily: "'Fira Code', monospace",
  fontSize: '0.8125rem',
  color: 'var(--text-1)',
  borderBottom: '1px solid var(--border-subtle)',
  wordBreak: 'break-all',
};

function ResultRow({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  warn?: boolean;
}) {
  const valueColor = accent ? 'var(--accent-text)' : warn ? 'var(--warning)' : 'var(--text-1)';
  return (
    <tr>
      <td style={tdLabel}>{label}</td>
      <td
        style={{
          ...tdMono,
          color: valueColor,
          fontWeight: accent || warn ? 600 : 400,
        }}
      >
        {String(value)}
      </td>
    </tr>
  );
}

function fmt(b: string) {
  return `${b.slice(0, 8)}.${b.slice(8, 16)}.${b.slice(16, 24)}.${b.slice(24, 32)}`;
}
