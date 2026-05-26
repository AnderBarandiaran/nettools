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
          aria-label="IPv4 CIDR notation input"
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
            fontSize: 'var(--t-body-s)',
            color: 'var(--nt-stop)',
            padding: '0.625rem 0.875rem',
            backgroundColor: 'var(--nt-stop-tint)',
            border: '1px solid var(--nt-stop)',
            borderRadius: 'var(--r-2)',
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
            fontSize: 'var(--t-body-s)',
            border: '1px solid var(--border-1)',
          }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-2)' }}>
                <th style={thStyle}>Parameter</th>
                <th style={thStyle}>Value</th>
              </tr>
            </thead>
            <tbody>
              {/* Network address — data blue */}
              <ResultRow
                label="Network address"
                value={result.networkAddress}
                valueStyle={{ color: 'var(--nt-data)', fontFamily: 'var(--font-mono)' }}
              />
              {/* Broadcast address — stop red */}
              <ResultRow
                label="Broadcast address"
                value={result.broadcastAddress}
                valueStyle={{ color: 'var(--nt-stop)', fontFamily: 'var(--font-mono)' }}
              />
              {/* First/Last host — go green */}
              <ResultRow
                label="First usable host"
                value={result.firstHost}
                valueStyle={{ color: 'var(--nt-go)', fontFamily: 'var(--font-mono)' }}
              />
              <ResultRow
                label="Last usable host"
                value={result.lastHost}
                valueStyle={{ color: 'var(--nt-go)', fontFamily: 'var(--font-mono)' }}
              />
              {/* Usable hosts — go green, weight 600 */}
              <ResultRow
                label="Usable hosts"
                value={result.usableHosts.toLocaleString()}
                valueStyle={{ color: 'var(--nt-go)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}
              />
              <ResultRow
                label="Total addresses"
                value={result.totalHosts.toLocaleString()}
                valueStyle={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-1)' }}
              />
              {/* Subnet / Wildcard mask — mono, fg-1 */}
              <ResultRow
                label="Subnet mask"
                value={result.subnetMask}
                valueStyle={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-1)' }}
              />
              <ResultRow
                label="Wildcard mask"
                value={result.wildcardMask}
                valueStyle={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-1)' }}
              />
              <ResultRow
                label="CIDR prefix"
                value={`/${result.prefix}`}
                valueStyle={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-1)' }}
              />
              <ResultRow
                label="IP class"
                value={`Class ${result.ipClass}`}
                valueStyle={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-1)' }}
              />
              {/* Private range — go/fg-2 */}
              <ResultRow
                label="Private (RFC 1918)"
                value={result.isPrivate ? 'Yes' : 'No'}
                valueStyle={{
                  fontFamily: 'var(--font-mono)',
                  color: result.isPrivate ? 'var(--nt-go)' : 'var(--fg-2)',
                }}
              />
            </tbody>
          </table>

          {/* Binary section */}
          <div style={{ marginTop: 'var(--sp-6)' }}>
            <p style={{
              fontSize: 'var(--t-eyebrow)',
              fontWeight: 600,
              letterSpacing: 'var(--tr-eyebrow)',
              textTransform: 'uppercase',
              color: 'var(--fg-3)',
              marginBottom: 'var(--sp-3)',
            }}>
              Binary representation
            </p>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 'var(--t-body-s)',
              border: '1px solid var(--border-1)',
            }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-2)' }}>
                  <th style={thStyle}>Field</th>
                  <th style={thStyle}>Binary</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdLabel}>Network address</td>
                  <td style={{ ...tdMono, color: 'var(--nt-data)' }}>{fmt(result.binaryNetworkAddress)}</td>
                </tr>
                <tr style={{ backgroundColor: 'var(--bg-2)' }}>
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
        <p style={{ fontSize: 'var(--t-body-s)', color: 'var(--fg-3)', padding: 'var(--sp-4) 0' }}>
          Enter a CIDR address above and press Calculate or Enter.
        </p>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.625rem 0.875rem',
  fontSize: 'var(--t-eyebrow)' as string,
  fontWeight: 600,
  letterSpacing: 'var(--tr-eyebrow)' as string,
  textTransform: 'uppercase' as const,
  color: 'var(--fg-3)',
  borderBottom: '1px solid var(--border-1)',
  whiteSpace: 'nowrap',
  fontFamily: 'var(--font-sans)',
};

const tdLabel: React.CSSProperties = {
  padding: '0.625rem 0.875rem',
  color: 'var(--fg-2)',
  fontSize: 'var(--t-body-s)' as string,
  borderBottom: '1px solid var(--border-2)',
  whiteSpace: 'nowrap',
  fontWeight: 500,
  fontFamily: 'var(--font-sans)',
};

const tdMono: React.CSSProperties = {
  padding: '0.625rem 0.875rem',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--t-caption)' as string,
  color: 'var(--fg-1)',
  borderBottom: '1px solid var(--border-2)',
  wordBreak: 'break-all',
};

function ResultRow({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string | number;
  valueStyle?: React.CSSProperties;
}) {
  return (
    <tr>
      <td style={tdLabel}>{label}</td>
      <td
        style={{
          ...tdMono,
          ...valueStyle,
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
