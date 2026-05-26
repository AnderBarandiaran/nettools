import { useState } from 'react';
import { ipToInt, intToIp, prefixToMask, maskToPrefix } from '../../lib/network/ipv4';

interface WildcardResult {
  subnetMask: string;
  wildcardMask: string;
  prefix: number;
  networkBits: number;
  hostBits: number;
  networkAddress?: string;
}

function parseInput(raw: string): WildcardResult {
  const trimmed = raw.trim();

  // CIDR: 192.168.1.0/24 or just /24 or 24
  const cidrSlash = trimmed.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/);
  if (cidrSlash) {
    const ip = cidrSlash[1];
    const prefix = parseInt(cidrSlash[2], 10);
    if (prefix < 0 || prefix > 32) throw new Error('Prefix must be 0–32');
    const maskInt = prefixToMask(prefix);
    const subnetMask = intToIp(maskInt);
    const wildcardInt = (~maskInt) >>> 0;
    const wildcardMask = intToIp(wildcardInt);
    const networkInt = (ipToInt(ip) & maskInt) >>> 0;
    return { subnetMask, wildcardMask, prefix, networkBits: prefix, hostBits: 32 - prefix, networkAddress: intToIp(networkInt) };
  }

  // Bare prefix: /24 or 24
  const barePrefix = trimmed.match(/^\/?(\d{1,2})$/);
  if (barePrefix) {
    const prefix = parseInt(barePrefix[1], 10);
    if (prefix < 0 || prefix > 32) throw new Error('Prefix must be 0–32');
    const maskInt = prefixToMask(prefix);
    const subnetMask = intToIp(maskInt);
    const wildcardInt = (~maskInt) >>> 0;
    return { subnetMask, wildcardMask: intToIp(wildcardInt), prefix, networkBits: prefix, hostBits: 32 - prefix };
  }

  // Subnet mask alone: 255.255.255.0
  const dotted = trimmed.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (dotted) {
    const maskInt = ipToInt(trimmed);
    // Could be a subnet mask (contiguous 1s) or a wildcard (contiguous 0s)
    // Detect: if all octets are in the set {0,128,192,224,240,248,252,254,255} treat as subnet mask
    const validMaskOctets = new Set([0, 128, 192, 224, 240, 248, 252, 254, 255]);
    const octs = [parseInt(dotted[1]), parseInt(dotted[2]), parseInt(dotted[3]), parseInt(dotted[4])];

    let isSubnetMask = true;
    let seenNon255 = false;
    for (const oct of octs) {
      if (!validMaskOctets.has(oct)) { isSubnetMask = false; break; }
      if (seenNon255 && oct !== 0) { isSubnetMask = false; break; }
      if (oct !== 255) seenNon255 = true;
    }

    if (isSubnetMask) {
      try {
        const prefix = maskToPrefix(maskInt);
        const wildcardInt = (~maskInt) >>> 0;
        return { subnetMask: trimmed, wildcardMask: intToIp(wildcardInt), prefix, networkBits: prefix, hostBits: 32 - prefix };
      } catch {
        // Non-contiguous, fall through to wildcard interpretation
      }
    }

    // Treat as wildcard mask — invert to get subnet mask
    const subnetMaskInt = (~maskInt) >>> 0;
    try {
      const prefix = maskToPrefix(subnetMaskInt);
      return { subnetMask: intToIp(subnetMaskInt), wildcardMask: trimmed, prefix, networkBits: prefix, hostBits: 32 - prefix };
    } catch {
      // Non-contiguous wildcard — still show both
      return {
        subnetMask: intToIp(subnetMaskInt),
        wildcardMask: trimmed,
        prefix: -1,
        networkBits: -1,
        hostBits: -1,
      };
    }
  }

  throw new Error('Enter a CIDR (192.168.1.0/24), a prefix (/24 or 24), or a subnet mask (255.255.255.0)');
}

export default function WildcardCalc() {
  const [input, setInput] = useState('192.168.1.0/24');
  const [result, setResult] = useState<WildcardResult | null>(() => {
    try { return parseInput('192.168.1.0/24'); } catch { return null; }
  });
  const [error, setError] = useState<string | null>(null);

  const handleChange = (value: string) => {
    setInput(value);
    if (!value.trim()) {
      setResult(null);
      setError(null);
      return;
    }
    try {
      setResult(parseInput(value));
      setError(null);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : 'Invalid input');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <input
          type="text"
          value={input}
          onChange={e => handleChange(e.target.value)}
          placeholder="192.168.1.0/24 or 255.255.255.0 or /24"
          className="input-field"
          style={{ width: '100%' }}
          aria-label="Subnet mask or CIDR input"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
        />
        <p style={{ marginTop: '0.375rem', fontSize: 'var(--t-body-s)', color: 'var(--fg-3)' }}>
          Enter CIDR notation, prefix length, or subnet mask
        </p>
      </div>

      {error && (
        <p role="alert" style={{ fontSize: 'var(--t-body-s)', color: 'var(--nt-stop)', margin: 0 }}>
          {error}
        </p>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          <Row label="Wildcard mask" value={result.wildcardMask} accent />
          <Row label="Subnet mask" value={result.subnetMask} />
          {result.prefix >= 0 && <Row label="Prefix length" value={`/${result.prefix}`} />}
          {result.networkBits >= 0 && <Row label="Network bits" value={String(result.networkBits)} />}
          {result.hostBits >= 0 && (
            <Row
              label="Host addresses"
              value={`${Math.pow(2, result.hostBits).toLocaleString()} (${(Math.pow(2, result.hostBits) - 2).toLocaleString()} usable)`}
            />
          )}
          {result.networkAddress && <Row label="Network address" value={result.networkAddress} />}

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-1)', margin: '0.25rem 0' }} />
          <CiscoExamples subnetMask={result.subnetMask} wildcardMask={result.wildcardMask} networkAddress={result.networkAddress} />
        </div>
      )}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
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
        gap: '0.5rem',
        padding: '0.625rem 0.75rem',
        background: accent ? 'var(--nt-brand-tint)' : 'var(--bg-2)',
        borderRadius: '6px',
        border: `1px solid ${accent ? 'color-mix(in oklch, var(--nt-brand) 25%, transparent)' : 'var(--border-1)'}`,
      }}
    >
      <span style={{ fontSize: 'var(--t-body-s)', color: 'var(--fg-3)', flexShrink: 0, minWidth: '9rem' }}>
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: 'var(--t-body-s)',
          color: accent ? 'var(--nt-brand)' : 'var(--fg-1)',
          fontWeight: accent ? 600 : 400,
          flex: 1,
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

function CiscoExamples({ subnetMask, wildcardMask, networkAddress }: { subnetMask: string; wildcardMask: string; networkAddress?: string }) {
  const net = networkAddress ?? '10.0.0.0';
  const aclExample = `access-list 10 permit ${net} ${wildcardMask}`;
  const ospfExample = `router ospf 1\n network ${net} ${wildcardMask} area 0`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <p style={{ fontSize: 'var(--t-body-s)', color: 'var(--fg-3)', margin: 0 }}>Cisco IOS examples</p>
      <pre
        style={{
          margin: 0,
          padding: '0.625rem 0.75rem',
          background: 'var(--bg-2)',
          borderRadius: '6px',
          border: '1px solid var(--border-1)',
          fontSize: '0.75rem',
          fontFamily: 'var(--font-mono, monospace)',
          color: 'var(--fg-1)',
          overflowX: 'auto',
          whiteSpace: 'pre',
        }}
      >
        {aclExample}{'\n'}{ospfExample}
      </pre>
    </div>
  );
}
