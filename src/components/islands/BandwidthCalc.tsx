import { useState } from 'react';

interface TransferTime {
  label: string;
  sizeBytes: number;
}

const FILE_SIZES: TransferTime[] = [
  { label: '1 MB', sizeBytes: 1_000_000 },
  { label: '10 MB', sizeBytes: 10_000_000 },
  { label: '100 MB', sizeBytes: 100_000_000 },
  { label: '1 GB', sizeBytes: 1_000_000_000 },
  { label: '10 GB', sizeBytes: 10_000_000_000 },
  { label: '1 TB', sizeBytes: 1_000_000_000_000 },
];

const PROTOCOLS = [
  { label: 'Raw (no overhead)', overhead: 0 },
  { label: 'Ethernet II (~1%)', overhead: 0.01 },
  { label: 'TCP/IP (~3%)', overhead: 0.03 },
  { label: 'HTTPS/TLS (~5%)', overhead: 0.05 },
  { label: 'IPsec/VPN (~15%)', overhead: 0.15 },
  { label: 'GRE tunnel (~7%)', overhead: 0.07 },
];

const LINK_SPEEDS = [
  { label: '56 Kbps (modem)', bps: 56_000 },
  { label: '1.5 Mbps (T1)', bps: 1_544_000 },
  { label: '10 Mbps', bps: 10_000_000 },
  { label: '100 Mbps (Fast Ethernet)', bps: 100_000_000 },
  { label: '1 Gbps (GigE)', bps: 1_000_000_000 },
  { label: '10 Gbps', bps: 10_000_000_000 },
  { label: '40 Gbps', bps: 40_000_000_000 },
  { label: '100 Gbps', bps: 100_000_000_000 },
];

function formatDuration(seconds: number): string {
  if (seconds < 0.001) return `${(seconds * 1_000_000).toFixed(2)} µs`;
  if (seconds < 1) return `${(seconds * 1000).toFixed(2)} ms`;
  if (seconds < 60) return `${seconds.toFixed(2)} s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatThroughput(bps: number): string {
  if (bps >= 1e12) return `${(bps / 1e12).toFixed(2)} Tbps`;
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(2)} Gbps`;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(2)} Mbps`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(2)} Kbps`;
  return `${bps.toFixed(0)} bps`;
}

export default function BandwidthCalc() {
  const [speedIndex, setSpeedIndex] = useState(4); // 1 Gbps default
  const [protocolIndex, setProtocolIndex] = useState(2); // TCP/IP
  const [customSpeed, setCustomSpeed] = useState('');
  const [useCustom, setUseCustom] = useState(false);

  const selectedSpeed = LINK_SPEEDS[speedIndex];
  const selectedProtocol = PROTOCOLS[protocolIndex];

  let rawBps = selectedSpeed.bps;
  let customError = '';

  if (useCustom) {
    const parsed = parseFloat(customSpeed);
    if (!isNaN(parsed) && parsed > 0) {
      // Try to detect unit from input
      const lower = customSpeed.toLowerCase();
      if (lower.includes('g')) rawBps = parsed * 1e9;
      else if (lower.includes('m')) rawBps = parsed * 1e6;
      else if (lower.includes('k')) rawBps = parsed * 1e3;
      else rawBps = parsed * 1e6; // default: Mbps
    } else {
      customError = 'Enter a number (e.g. 500M, 1G, 100K, or 50 for 50 Mbps)';
      rawBps = 0;
    }
  }

  const effectiveBps = rawBps * (1 - selectedProtocol.overhead);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <label style={{ fontSize: 'var(--t-body-s)', color: 'var(--fg-2)', fontWeight: 500 }}>
            Link speed
          </label>
          {!useCustom ? (
            <select
              value={speedIndex}
              onChange={e => setSpeedIndex(Number(e.target.value))}
              className="input-field"
              aria-label="Link speed selector"
            >
              {LINK_SPEEDS.map((s, i) => (
                <option key={i} value={i}>{s.label}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={customSpeed}
              onChange={e => setCustomSpeed(e.target.value)}
              placeholder="e.g. 500M, 1G, 100K"
              className="input-field"
              aria-label="Custom link speed input"
              autoComplete="off"
            />
          )}
          {customError && (
            <p style={{ fontSize: '0.75rem', color: 'var(--nt-stop)', margin: 0 }}>{customError}</p>
          )}
          <button
            onClick={() => { setUseCustom(v => !v); setCustomSpeed(''); }}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontSize: '0.75rem',
              color: 'var(--nt-brand)',
              textAlign: 'left',
              textDecoration: 'underline',
            }}
          >
            {useCustom ? 'Use preset speeds' : 'Enter custom speed'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <label style={{ fontSize: 'var(--t-body-s)', color: 'var(--fg-2)', fontWeight: 500 }}>
            Protocol overhead
          </label>
          <select
            value={protocolIndex}
            onChange={e => setProtocolIndex(Number(e.target.value))}
            className="input-field"
            aria-label="Protocol overhead selector"
          >
            {PROTOCOLS.map((p, i) => (
              <option key={i} value={i}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Throughput summary */}
      {effectiveBps > 0 && (
        <>
          <div
            style={{
              padding: '0.875rem 1rem',
              background: 'var(--nt-brand-tint)',
              borderRadius: '8px',
              border: '1px solid color-mix(in oklch, var(--nt-brand) 20%, transparent)',
              display: 'flex',
              gap: '2rem',
              flexWrap: 'wrap',
            }}
          >
            <Stat label="Raw bandwidth" value={formatThroughput(rawBps)} />
            <Stat label="Effective throughput" value={formatThroughput(effectiveBps)} accent />
            <Stat
              label="Overhead"
              value={`${(selectedProtocol.overhead * 100).toFixed(0)}% (${formatThroughput(rawBps - effectiveBps)} lost)`}
            />
          </div>

          {/* Transfer time table */}
          <div>
            <p style={{ fontSize: 'var(--t-body-s)', color: 'var(--fg-3)', marginBottom: '0.5rem' }}>
              Estimated transfer times at {formatThroughput(effectiveBps)} effective
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {FILE_SIZES.map(({ label, sizeBytes }) => {
                const seconds = (sizeBytes * 8) / effectiveBps;
                return (
                  <div
                    key={label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      background: 'var(--bg-2)',
                      borderRadius: '6px',
                      border: '1px solid var(--border-1)',
                    }}
                  >
                    <span style={{ fontSize: 'var(--t-body-s)', color: 'var(--fg-3)', minWidth: '5rem' }}>
                      {label}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: 'var(--t-body-s)',
                        color: 'var(--fg-1)',
                        fontWeight: 500,
                      }}
                    >
                      {formatDuration(seconds)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Unit note */}
          <p style={{ fontSize: '0.75rem', color: 'var(--fg-3)', margin: 0 }}>
            Transfer times use bits (1 byte = 8 bits). 1 MB = 1,000,000 bytes (SI). Actual speeds depend on TCP window size, RTT, and host I/O.
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
      <span style={{ fontSize: '0.7rem', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <span
        style={{
          fontSize: '1.125rem',
          fontWeight: 700,
          color: accent ? 'var(--nt-brand)' : 'var(--fg-1)',
          fontFamily: 'var(--font-mono, monospace)',
        }}
      >
        {value}
      </span>
    </div>
  );
}
