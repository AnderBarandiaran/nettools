import { useState } from 'react';
import { ipToInt, intToIp, prefixToMask } from '../../lib/network/ipv4';

interface SummaryResult {
  supernet: string;
  prefix: number;
  networks: ParsedNetwork[];
  totalAddresses: number;
  efficiency: number; // % of supernet actually needed
  gaps: string[];
}

interface ParsedNetwork {
  cidr: string;
  networkInt: number;
  broadcastInt: number;
  prefix: number;
}

function parseCIDR(cidr: string): ParsedNetwork {
  const trimmed = cidr.trim();
  const match = trimmed.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/);
  if (!match) throw new Error(`Invalid CIDR: "${trimmed}"`);
  const prefix = parseInt(match[2], 10);
  if (prefix < 0 || prefix > 32) throw new Error(`Invalid prefix: /${prefix}`);
  const maskInt = prefixToMask(prefix);
  const networkInt = (ipToInt(match[1]) & maskInt) >>> 0;
  const broadcastInt = (networkInt | (~maskInt >>> 0)) >>> 0;
  return {
    cidr: `${intToIp(networkInt)}/${prefix}`,
    networkInt,
    broadcastInt,
    prefix,
  };
}

function summarize(networks: ParsedNetwork[]): SummaryResult {
  if (networks.length === 0) throw new Error('No valid networks');

  let minAddr = networks[0].networkInt;
  let maxAddr = networks[0].broadcastInt;
  let totalNeededAddresses = 0;

  for (const n of networks) {
    if (n.networkInt < minAddr) minAddr = n.networkInt;
    if (n.broadcastInt > maxAddr) maxAddr = n.broadcastInt;
    totalNeededAddresses += n.broadcastInt - n.networkInt + 1;
  }

  // Find the smallest prefix that covers minAddr to maxAddr
  const range = maxAddr - minAddr + 1;
  // Required host bits: smallest power of 2 >= range
  let hostBits = 0;
  while ((1 << hostBits) >>> 0 < range) hostBits++;
  let prefix = 32 - hostBits;

  // Align the supernet: the network address must be aligned to the block size
  const blockSize = (1 << hostBits) >>> 0;
  const supernetStart = (minAddr & (0xffffffff << hostBits)) >>> 0;

  // Verify all networks fit
  const supernetEnd = (supernetStart + blockSize - 1) >>> 0;
  if (maxAddr > supernetEnd) {
    // Need one more bit
    hostBits++;
    prefix = 32 - hostBits;
  }

  const finalBlockSize = Math.pow(2, 32 - prefix);
  const finalSupernetStart = (minAddr >>> (32 - prefix) << (32 - prefix)) >>> 0;
  const finalSupernetEnd = (finalSupernetStart + finalBlockSize - 1) >>> 0;

  // Check all networks fit in the aligned supernet
  // If not, keep expanding
  let finalPrefix = prefix;
  let attempts = 0;
  while (attempts < 32) {
    const bs = Math.pow(2, 32 - finalPrefix);
    const start = (minAddr >>> (32 - finalPrefix) << (32 - finalPrefix)) >>> 0;
    const end = (start + bs - 1) >>> 0;
    if (maxAddr <= end) break;
    finalPrefix--;
    attempts++;
  }

  const supernet = intToIp((minAddr >>> (32 - finalPrefix) << (32 - finalPrefix)) >>> 0) + `/${finalPrefix}`;
  const supernetAddresses = Math.pow(2, 32 - finalPrefix);
  const efficiency = Math.min(100, (totalNeededAddresses / supernetAddresses) * 100);

  // Find gaps between consecutive networks (sorted)
  const sorted = [...networks].sort((a, b) => a.networkInt - b.networkInt);
  const gaps: string[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = sorted[i - 1].broadcastInt;
    const nextStart = sorted[i].networkInt;
    if (nextStart > prevEnd + 1) {
      const gapStart = prevEnd + 1;
      const gapEnd = nextStart - 1;
      const gapCount = gapEnd - gapStart + 1;
      gaps.push(`${intToIp(gapStart)} – ${intToIp(gapEnd)} (${gapCount} address${gapCount !== 1 ? 'es' : ''})`);
    }
  }

  return {
    supernet,
    prefix: finalPrefix,
    networks: sorted,
    totalAddresses: supernetAddresses,
    efficiency,
    gaps,
  };
}

export default function CIDRSummarizer() {
  const [inputText, setInputText] = useState('10.1.0.0/24\n10.1.1.0/24\n10.1.2.0/24\n10.1.3.0/24');
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const calculate = () => {
    const lines = inputText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      setResult(null);
      setErrors(['Enter at least one network']);
      return;
    }

    const parsed: ParsedNetwork[] = [];
    const errs: string[] = [];

    for (const line of lines) {
      try {
        parsed.push(parseCIDR(line));
      } catch (e) {
        errs.push(e instanceof Error ? e.message : `Invalid: ${line}`);
      }
    }

    setErrors(errs);

    if (parsed.length === 0) {
      setResult(null);
      return;
    }

    try {
      setResult(summarize(parsed));
    } catch (e) {
      setErrors(prev => [...prev, e instanceof Error ? e.message : 'Summarization failed']);
      setResult(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label style={{ fontSize: 'var(--t-body-s)', color: 'var(--fg-2)', fontWeight: 500 }}>
          Networks to summarize (one per line)
        </label>
        <textarea
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          rows={6}
          placeholder={'10.1.0.0/24\n10.1.1.0/24\n10.1.2.0/24'}
          className="input-field"
          style={{ width: '100%', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.875rem', resize: 'vertical' }}
          aria-label="CIDR networks input"
          spellCheck={false}
        />
        <button onClick={calculate} className="btn-primary" style={{ alignSelf: 'flex-start' }}>
          Summarize
        </button>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div role="alert">
          {errors.map((e, i) => (
            <p key={i} style={{ fontSize: 'var(--t-body-s)', color: 'var(--nt-stop)', margin: '0 0 0.25rem' }}>
              {e}
            </p>
          ))}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Supernet */}
          <div
            style={{
              padding: '1rem',
              background: 'var(--nt-brand-tint)',
              borderRadius: '8px',
              border: '1px solid color-mix(in oklch, var(--nt-brand) 25%, transparent)',
            }}
          >
            <p style={{ fontSize: '0.75rem', color: 'var(--fg-3)', margin: '0 0 0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Summary route
            </p>
            <p
              style={{
                fontSize: '1.5rem',
                fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 700,
                color: 'var(--nt-brand)',
                margin: 0,
              }}
            >
              {result.supernet}
            </p>
            <p style={{ fontSize: 'var(--t-body-s)', color: 'var(--fg-3)', margin: '0.375rem 0 0' }}>
              {result.totalAddresses.toLocaleString()} addresses · {result.efficiency.toFixed(1)}% utilised
            </p>
          </div>

          {/* Individual networks */}
          <div>
            <p style={{ fontSize: 'var(--t-body-s)', color: 'var(--fg-3)', marginBottom: '0.5rem' }}>
              {result.networks.length} component network{result.networks.length !== 1 ? 's' : ''} (sorted)
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {result.networks.map(n => (
                <div
                  key={n.cidr}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    background: 'var(--bg-2)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-1)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 'var(--t-body-s)',
                      color: 'var(--fg-1)',
                      minWidth: '16rem',
                    }}
                  >
                    {n.cidr}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--fg-3)' }}>
                    {intToIp(n.networkInt)} – {intToIp(n.broadcastInt)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Gaps */}
          {result.gaps.length > 0 && (
            <div
              style={{
                padding: '0.75rem 1rem',
                background: 'var(--nt-warn-tint)',
                borderRadius: '6px',
                border: '1px solid color-mix(in oklch, var(--nt-warn) 25%, transparent)',
              }}
            >
              <p style={{ fontSize: 'var(--t-body-s)', color: 'var(--nt-warn)', fontWeight: 600, margin: '0 0 0.25rem' }}>
                Address gaps in supernet
              </p>
              {result.gaps.map((g, i) => (
                <p key={i} style={{ fontSize: 'var(--t-body-s)', color: 'var(--fg-2)', margin: '0.125rem 0 0', fontFamily: 'var(--font-mono, monospace)' }}>
                  {g}
                </p>
              ))}
              <p style={{ fontSize: '0.75rem', color: 'var(--fg-3)', margin: '0.375rem 0 0' }}>
                The supernet covers these addresses but they are not in any input network. Ensure this is intended before advertising the summary route.
              </p>
            </div>
          )}

          {/* Cisco config */}
          <div>
            <p style={{ fontSize: 'var(--t-body-s)', color: 'var(--fg-3)', marginBottom: '0.375rem' }}>
              Cisco IOS — advertise as summary
            </p>
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
              }}
            >
              {`! EIGRP summary\ninterface GigabitEthernet0/0\n ip summary-address eigrp 100 ${result.supernet.replace('/', ' ').replace(/\/\d+$/, '').split('/')[0]} ${intToIp(prefixToMask(result.prefix))}\n\n! OSPF inter-area summary (on ABR)\nrouter ospf 1\n area 0 range ${result.supernet.split('/')[0]} ${intToIp(prefixToMask(result.prefix))}`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
