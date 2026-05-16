import { describe, it, expect } from 'vitest'
import { ipToInt } from '../../src/lib/network/ipv4'
import { minPrefixForHosts, planVLSM, hasOverlaps } from '../../src/lib/network/vlsm'

// ─── minPrefixForHosts ───────────────────────────────────────────────────────

describe('minPrefixForHosts', () => {
  it('1 host → /32 (host route)', () => expect(minPrefixForHosts(1)).toBe(32))
  it('2 hosts → /31 (RFC 3021 P2P)', () => expect(minPrefixForHosts(2)).toBe(31))
  // /30 gives only 2 usables (4-2), so 3 hosts needs /29 (6 usables)
  it('3 hosts → /29', () => expect(minPrefixForHosts(3)).toBe(29))
  it('6 hosts → /29 (exactly fills /29)', () => expect(minPrefixForHosts(6)).toBe(29))
  // /29 gives 6 usables, /28 gives 14 — 7 hosts requires /28
  it('7 hosts → /28', () => expect(minPrefixForHosts(7)).toBe(28))
  it('254 hosts → /24', () => expect(minPrefixForHosts(254)).toBe(24))
  it('255 hosts → /23 (254 usables in /24 not enough)', () => expect(minPrefixForHosts(255)).toBe(23))
})

// ─── planVLSM — caso base ────────────────────────────────────────────────────

describe('planVLSM — base case 192.168.1.0/24', () => {
  // Requirements intentionally out of order; algorithm must sort them
  const requirements = [
    { name: 'WAN',   requiredHosts: 2  },
    { name: 'LAN-C', requiredHosts: 10 },
    { name: 'LAN-A', requiredHosts: 50 },
    { name: 'LAN-B', requiredHosts: 25 },
  ]

  const plan = planVLSM('192.168.1.0/24', requirements)

  it('fits entirely within parent block', () => expect(plan.fits).toBe(true))
  it('parentBlock normalized', () => expect(plan.parentBlock).toBe('192.168.1.0/24'))
  it('four allocations', () => expect(plan.allocations).toHaveLength(4))

  it('allocations sorted by network address ascending', () => {
    const nets = plan.allocations.map(a => ipToInt(a.subnet.networkAddress))
    for (let i = 1; i < nets.length; i++) {
      expect(nets[i]).toBeGreaterThan(nets[i - 1])
    }
  })

  it('LAN-A gets /26 (62 usable hosts)', () => {
    const a = plan.allocations.find(x => x.requirement.name === 'LAN-A')!
    expect(a.prefix).toBe(26)
    expect(a.subnet.usableHosts).toBe(62)
    expect(a.subnet.networkAddress).toBe('192.168.1.0')
    expect(a.wastedHosts).toBe(12)
  })

  it('LAN-B gets /27 (30 usable hosts)', () => {
    const b = plan.allocations.find(x => x.requirement.name === 'LAN-B')!
    expect(b.prefix).toBe(27)
    expect(b.subnet.usableHosts).toBe(30)
    expect(b.subnet.networkAddress).toBe('192.168.1.64')
    expect(b.wastedHosts).toBe(5)
  })

  it('LAN-C gets /28 (14 usable hosts)', () => {
    const c = plan.allocations.find(x => x.requirement.name === 'LAN-C')!
    expect(c.prefix).toBe(28)
    expect(c.subnet.usableHosts).toBe(14)
    expect(c.subnet.networkAddress).toBe('192.168.1.96')
    expect(c.wastedHosts).toBe(4)
  })

  // /31 (RFC 3021) is the most specific prefix that satisfies 2 hosts;
  // note: /30 also gives 2 usables but /31 is smaller and is returned first
  it('WAN gets /31 — 2 usable hosts (RFC 3021)', () => {
    const w = plan.allocations.find(x => x.requirement.name === 'WAN')!
    expect(w.prefix).toBe(31)
    expect(w.subnet.usableHosts).toBe(2)
    expect(w.subnet.networkAddress).toBe('192.168.1.112')
    expect(w.wastedHosts).toBe(0)
    expect(w.utilizationPct).toBe(100)
  })

  it('subnets are contiguous (no address gaps)', () => {
    const sorted = [...plan.allocations].sort(
      (a, b) => ipToInt(a.subnet.networkAddress) - ipToInt(b.subnet.networkAddress)
    )
    for (let i = 1; i < sorted.length; i++) {
      const prevBcast = ipToInt(sorted[i - 1].subnet.broadcastAddress)
      const currNet   = ipToInt(sorted[i].subnet.networkAddress)
      expect(currNet).toBe(prevBcast + 1)
    }
  })

  it('no overlaps', () => expect(hasOverlaps(plan)).toBe(false))

  it('totalRequiredHosts = 50+25+10+2', () => expect(plan.totalRequiredHosts).toBe(87))
  it('totalUsableHosts = 62+30+14+2', () => expect(plan.totalUsableHosts).toBe(108))
  it('totalWastedHosts = 12+5+4+0', () => expect(plan.totalWastedHosts).toBe(21))
  // 256 - (64+32+16+2) = 256 - 114 = 142
  it('remainingAddresses = 142', () => expect(plan.remainingAddresses).toBe(142))
})

// ─── planVLSM — no cabe ─────────────────────────────────────────────────────

describe('planVLSM — does not fit', () => {
  it('192.168.1.0/28 with 100-host requirement → fits=false', () => {
    const plan = planVLSM('192.168.1.0/28', [{ name: 'BIG', requiredHosts: 100 }])
    expect(plan.fits).toBe(false)
    expect(plan.allocations).toHaveLength(0)
  })
})

// ─── planVLSM — requerimientos desordenados ──────────────────────────────────

describe('planVLSM — unordered requirements produce same plan', () => {
  const ordered = [
    { name: 'LAN-A', requiredHosts: 50 },
    { name: 'LAN-B', requiredHosts: 25 },
    { name: 'LAN-C', requiredHosts: 10 },
    { name: 'WAN',   requiredHosts: 2  },
  ]
  const shuffled = [
    { name: 'LAN-C', requiredHosts: 10 },
    { name: 'WAN',   requiredHosts: 2  },
    { name: 'LAN-B', requiredHosts: 25 },
    { name: 'LAN-A', requiredHosts: 50 },
  ]

  const planA = planVLSM('192.168.1.0/24', ordered)
  const planB = planVLSM('192.168.1.0/24', shuffled)

  it('same number of allocations', () =>
    expect(planB.allocations).toHaveLength(planA.allocations.length))

  it('same network addresses in same order', () => {
    for (let i = 0; i < planA.allocations.length; i++) {
      expect(planB.allocations[i].subnet.networkAddress).toBe(
        planA.allocations[i].subnet.networkAddress
      )
      expect(planB.allocations[i].prefix).toBe(planA.allocations[i].prefix)
    }
  })

  it('fits=true for both', () => {
    expect(planA.fits).toBe(true)
    expect(planB.fits).toBe(true)
  })
})

// ─── hasOverlaps ─────────────────────────────────────────────────────────────

describe('hasOverlaps', () => {
  it('returns false for valid VLSM plan', () => {
    const plan = planVLSM('192.168.1.0/24', [
      { name: 'LAN-A', requiredHosts: 50 },
      { name: 'LAN-B', requiredHosts: 25 },
      { name: 'LAN-C', requiredHosts: 10 },
      { name: 'WAN',   requiredHosts: 2  },
    ])
    expect(hasOverlaps(plan)).toBe(false)
  })
})

// ─── planVLSM — single subnet fills parent exactly ───────────────────────────

describe('planVLSM — single requirement fills parent exactly', () => {
  it('192.168.0.0/24 with 254 hosts → fits=true, wastedHosts=0', () => {
    const plan = planVLSM('192.168.0.0/24', [{ name: 'LAN', requiredHosts: 254 }])
    expect(plan.fits).toBe(true)
    expect(plan.allocations).toHaveLength(1)
    const alloc = plan.allocations[0]
    expect(alloc.prefix).toBe(24)
    expect(alloc.subnet.networkAddress).toBe('192.168.0.0')
    expect(alloc.subnet.usableHosts).toBe(254)
    expect(alloc.wastedHosts).toBe(0)
    expect(alloc.utilizationPct).toBe(100)
    expect(plan.remainingAddresses).toBe(0)
  })
})
