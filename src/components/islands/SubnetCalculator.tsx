import { useState, useCallback, useRef } from 'react';
import { calculateSubnet, type SubnetInfo } from '../../lib/network/ipv4';

type InputMode = 'cidr' | 'mask';

export default function SubnetCalculator() {
  const [input, setInput] = useState('192.168.1.0/24');
  const inputRef = useRef('192.168.1.0/24');
  const inputElRef = useRef<HTMLInputElement>(null);
  const [mode] = useState<InputMode>('cidr');
  const [result, setResult] = useState<SubnetInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(() => {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Input row — terminal style ─────────────────────────────── */}
      <div
        style={{
          backgroundColor: 'var(--surface-shell)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '5px',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--surface)',
            borderRadius: '16px',
            padding: '1.25rem 1.5rem',
            boxShadow: 'inset 0 1px 0 oklch(100% 0 0 / 0.08)',
          }}
        >
          <p
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              marginBottom: '0.875rem',
            }}
          >
            Enter network address
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <input
              ref={inputElRef}
              type="text"
              value={input}
              onChange={e => {
                setInput(e.target.value);
                inputRef.current = e.target.value;
              }}
              onKeyDown={handleKey}
              placeholder="192.168.1.0/24 or 10.0.0.0 255.0.0.0"
              className="input-terminal"
              style={{ flex: 1 }}
              aria-label="IPv4 CIDR notation input"
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
            />

            {/* Button with trailing icon circle */}
            <button
              onClick={calculate}
              className="btn-terminal"
              aria-label="Calculate subnet"
            >
              Calculate
              <span
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  backgroundColor: 'oklch(30% 0.05 150)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  flexShrink: 0,
                  color: 'oklch(78% 0.14 150)',
                }}
              >
                ↵
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────────── */}
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

      {/* ── Results ─────────────────────────────────────────────────── */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Network information */}
          <ResultSection label="Network information">
            <ResultRow label="Network address"  value={result.networkAddress}  mono semantic="network" />
            <ResultRow label="Broadcast address" value={result.broadcastAddress} mono semantic="broadcast" />
            <ResultRow label="First usable host" value={result.firstHost}        mono />
            <ResultRow label="Last usable host"  value={result.lastHost}         mono />
            <ResultRow label="Usable hosts"      value={result.usableHosts.toLocaleString()} />
            <ResultRow label="Total addresses"   value={result.totalHosts.toLocaleString()} />
          </ResultSection>

          {/* Mask details */}
          <ResultSection label="Mask details">
            <ResultRow label="Subnet mask"    value={result.subnetMask}   mono />
            <ResultRow label="Wildcard mask"  value={result.wildcardMask} mono />
            <ResultRow label="CIDR prefix"    value={`/${result.prefix}`} mono />
          </ResultSection>

          {/* Classification */}
          <ResultSection label="Classification">
            <ResultRow label="IP class"                  value={`Class ${result.ipClass}`} />
            <ResultRow label="Private range (RFC 1918)"  value={result.isPrivate ? 'Yes' : 'No'} />
          </ResultSection>

          {/* Binary */}
          <BinarySection result={result} />
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────── */}
      {!result && !error && (
        <p
          style={{
            fontSize: '0.875rem',
            color: 'var(--text-3)',
            textAlign: 'center',
            padding: '2rem 0',
          }}
        >
          Enter a CIDR notation above and press Calculate or Enter
        </p>
      )}
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────────────── */

function ResultSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--surface-shell)',
        border: '1px solid var(--border)',
        borderRadius: '20px',
        padding: '5px',
        boxShadow: '0 1px 3px oklch(50% 0.06 250 / 0.06)',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--surface)',
          borderRadius: '16px',
          padding: '1rem 1.25rem',
          boxShadow: 'inset 0 1px 0 oklch(100% 0 0 / 0.08)',
        }}
      >
        <p
          style={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-3)',
            marginBottom: '0.5rem',
          }}
        >
          {label}
        </p>
        {children}
      </div>
    </div>
  );
}

type Semantic = 'network' | 'broadcast' | undefined;

function ResultRow({
  label,
  value,
  mono = false,
  semantic,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
  semantic?: Semantic;
}) {
  const valueColor =
    semantic === 'network'   ? 'var(--accent-text)'  :
    semantic === 'broadcast' ? 'var(--warning)'       :
    'var(--text-1)';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.5625rem 0',
        borderBottom: '1px solid var(--border-subtle)',
      }}
      className="result-row"
    >
      <span style={{ fontSize: '0.875rem', color: 'var(--text-2)' }}>{label}</span>
      <span
        style={{
          fontSize: '0.875rem',
          fontWeight: 500,
          color: valueColor,
          fontFamily: mono ? "'JetBrains Mono', monospace" : undefined,
          letterSpacing: mono ? '-0.01em' : undefined,
        }}
      >
        {String(value)}
      </span>
    </div>
  );
}

function BinarySection({ result }: { result: SubnetInfo }) {
  const fmt = (b: string) =>
    `${b.slice(0,8)}.${b.slice(8,16)}.${b.slice(16,24)}.${b.slice(24,32)}`;

  return (
    <div
      style={{
        backgroundColor: 'var(--surface-shell)',
        border: '1px solid var(--border)',
        borderRadius: '20px',
        padding: '5px',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--surface)',
          borderRadius: '16px',
          padding: '1rem 1.25rem',
          boxShadow: 'inset 0 1px 0 oklch(100% 0 0 / 0.08)',
        }}
      >
        <p
          style={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-3)',
            marginBottom: '0.875rem',
          }}
        >
          Binary representation
        </p>

        <div style={{ marginBottom: '0.875rem' }}>
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginBottom: '0.25rem' }}>
            Network address
          </p>
          <p
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.75rem',
              color: 'var(--accent-text)',
              wordBreak: 'break-all',
              lineHeight: 1.6,
            }}
          >
            {fmt(result.binaryNetworkAddress)}
          </p>
        </div>

        <div>
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginBottom: '0.25rem' }}>
            Subnet mask
          </p>
          <p
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.75rem',
              color: 'var(--text-2)',
              wordBreak: 'break-all',
              lineHeight: 1.6,
            }}
          >
            {fmt(result.binarySubnetMask)}
          </p>
        </div>
      </div>
    </div>
  );
}
