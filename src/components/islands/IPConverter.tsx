import { useState } from 'react';
import { ipToInt, intToIp } from '../../lib/network/ipv4';

interface ConversionResult {
  decimal: string;
  binary: string;
  hex: string;
  integer: number;
}

function ipToBinary(ip: string): string {
  return ip
    .split('.')
    .map(octet => parseInt(octet, 10).toString(2).padStart(8, '0'))
    .join('.');
}

function ipToHex(ip: string): string {
  return ip
    .split('.')
    .map(octet => parseInt(octet, 10).toString(16).padStart(2, '0').toUpperCase())
    .join(':');
}

function parseInput(raw: string): ConversionResult | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Try decimal dotted (e.g. 192.168.1.1)
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed)) {
    try {
      const int = ipToInt(trimmed);
      return {
        decimal: trimmed,
        binary: ipToBinary(trimmed),
        hex: ipToHex(trimmed),
        integer: int,
      };
    } catch {
      return null;
    }
  }

  // Try binary dotted (e.g. 11000000.10101000.00000001.00000001)
  if (/^[01]{8}(\.[01]{8}){3}$/.test(trimmed)) {
    const decimal = trimmed
      .split('.')
      .map(b => parseInt(b, 2).toString(10))
      .join('.');
    try {
      const int = ipToInt(decimal);
      return {
        decimal,
        binary: trimmed,
        hex: ipToHex(decimal),
        integer: int,
      };
    } catch {
      return null;
    }
  }

  // Try hex colon-separated (e.g. C0:A8:01:01)
  if (/^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){3}$/.test(trimmed)) {
    const decimal = trimmed
      .split(':')
      .map(h => parseInt(h, 16).toString(10))
      .join('.');
    try {
      const int = ipToInt(decimal);
      return {
        decimal,
        binary: ipToBinary(decimal),
        hex: trimmed.toUpperCase(),
        integer: int,
      };
    } catch {
      return null;
    }
  }

  // Try 32-bit decimal integer
  const asInt = parseInt(trimmed, 10);
  if (/^\d+$/.test(trimmed) && asInt >= 0 && asInt <= 0xffffffff) {
    const decimal = intToIp(asInt);
    return {
      decimal,
      binary: ipToBinary(decimal),
      hex: ipToHex(decimal),
      integer: asInt,
    };
  }

  return null;
}

export default function IPConverter() {
  const [input, setInput] = useState('192.168.1.1');
  const [result, setResult] = useState<ConversionResult | null>(() => parseInput('192.168.1.1'));
  const [error, setError] = useState<string | null>(null);

  const handleChange = (value: string) => {
    setInput(value);
    if (!value.trim()) {
      setResult(null);
      setError(null);
      return;
    }
    const parsed = parseInput(value);
    if (parsed) {
      setResult(parsed);
      setError(null);
    } else {
      setResult(null);
      setError('Enter a dotted-decimal IP, dotted-binary, hex (C0:A8:01:01), or 32-bit integer');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <input
          type="text"
          value={input}
          onChange={e => handleChange(e.target.value)}
          placeholder="192.168.1.1 or C0:A8:01:01 or binary"
          className="input-field"
          style={{ width: '100%' }}
          aria-label="IP address input"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
        />
        <p style={{ marginTop: '0.375rem', fontSize: 'var(--t-body-s)', color: 'var(--fg-3)' }}>
          Enter dotted-decimal, dotted-binary, hex (C0:A8:01:01), or a 32-bit integer
        </p>
      </div>

      {error && (
        <p role="alert" style={{ fontSize: 'var(--t-body-s)', color: 'var(--nt-stop)', margin: 0 }}>
          {error}
        </p>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <ResultRow label="Dotted decimal" value={result.decimal} />
          <ResultRow label="Binary" value={result.binary} mono />
          <ResultRow label="Hexadecimal" value={result.hex} mono />
          <ResultRow label="32-bit integer" value={result.integer.toLocaleString()} />

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-1)', margin: '0.25rem 0' }} />

          <OctetGrid binary={result.binary} decimal={result.decimal} />
        </div>
      )}
    </div>
  );
}

function ResultRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.5rem',
        padding: '0.625rem 0.75rem',
        background: 'var(--bg-2)',
        borderRadius: '6px',
        border: '1px solid var(--border-1)',
      }}
    >
      <span style={{ fontSize: 'var(--t-body-s)', color: 'var(--fg-3)', flexShrink: 0, minWidth: '8rem' }}>
        {label}
      </span>
      <span
        style={{
          fontFamily: mono ? 'var(--font-mono, monospace)' : 'inherit',
          fontSize: 'var(--t-body-s)',
          color: 'var(--fg-1)',
          flex: 1,
          wordBreak: 'break-all',
        }}
      >
        {value}
      </span>
      <button
        onClick={copy}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.75rem',
          color: copied ? 'var(--nt-go)' : 'var(--fg-3)',
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          flexShrink: 0,
        }}
        aria-label={`Copy ${label}`}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function OctetGrid({ binary, decimal }: { binary: string; decimal: string }) {
  const octetsDecimal = decimal.split('.');
  const octetsBinary = binary.split('.');

  return (
    <div>
      <p style={{ fontSize: 'var(--t-body-s)', color: 'var(--fg-3)', marginBottom: '0.5rem' }}>
        Bit breakdown
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
        {octetsDecimal.map((dec, i) => (
          <div
            key={i}
            style={{
              padding: '0.5rem',
              background: 'var(--bg-2)',
              borderRadius: '6px',
              border: '1px solid var(--border-1)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.65rem', color: 'var(--fg-3)', marginBottom: '0.25rem' }}>
              Octet {i + 1}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.7rem',
                color: 'var(--nt-data)',
                letterSpacing: '0.05em',
                marginBottom: '0.25rem',
              }}
            >
              {octetsBinary[i]}
            </div>
            <div style={{ fontWeight: 600, fontSize: 'var(--t-body-s)', color: 'var(--fg-1)' }}>
              {dec}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
