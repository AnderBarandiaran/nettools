import { describe, it, expect } from 'vitest'
import {
  ipToInt,
  intToIp,
  prefixToMask,
  maskToPrefix,
  calculateSubnet,
  calculateSubnetFromMask,
  ipInSubnet,
  subnetsOverlap,
  subnetDivide,
} from '../../src/lib/network/ipv4'

// ─── ipToInt / intToIp ───────────────────────────────────────────────────────

describe('ipToInt / intToIp roundtrip', () => {
  it('roundtrip for 10 representative IPs', () => {
    const ips = [
      '0.0.0.0',
      '255.255.255.255',
      '192.168.1.1',
      '10.0.0.1',
      '172.16.254.1',
      '127.0.0.1',
      '8.8.8.8',
      '1.1.1.1',
      '169.254.1.1',
      '224.0.0.1',
    ]
    for (const ip of ips) {
      expect(intToIp(ipToInt(ip)), `roundtrip failed for ${ip}`).toBe(ip)
    }
  })

  it('boundary values', () => {
    expect(ipToInt('0.0.0.0')).toBe(0)
    expect(ipToInt('255.255.255.255')).toBe(4294967295)
    expect(intToIp(0)).toBe('0.0.0.0')
    expect(intToIp(4294967295)).toBe('255.255.255.255')
  })

  it('throws for too many octets', () => {
    expect(() => ipToInt('1.2.3.4.5')).toThrow()
  })

  it('throws for too few octets', () => {
    expect(() => ipToInt('192.168.1')).toThrow()
  })

  it('throws for octet > 255', () => {
    expect(() => ipToInt('256.0.0.1')).toThrow()
  })

  it('throws for non-numeric octet', () => {
    expect(() => ipToInt('abc.def.ghi.jkl')).toThrow()
  })
})

// ─── prefixToMask ────────────────────────────────────────────────────────────

describe('prefixToMask', () => {
  it('/0  → 0.0.0.0',         () => expect(intToIp(prefixToMask(0))).toBe('0.0.0.0'))
  it('/8  → 255.0.0.0',       () => expect(intToIp(prefixToMask(8))).toBe('255.0.0.0'))
  it('/12 → 255.240.0.0',     () => expect(intToIp(prefixToMask(12))).toBe('255.240.0.0'))
  it('/16 → 255.255.0.0',     () => expect(intToIp(prefixToMask(16))).toBe('255.255.0.0'))
  it('/24 → 255.255.255.0',   () => expect(intToIp(prefixToMask(24))).toBe('255.255.255.0'))
  it('/30 → 255.255.255.252', () => expect(intToIp(prefixToMask(30))).toBe('255.255.255.252'))
  it('/31 → 255.255.255.254', () => expect(intToIp(prefixToMask(31))).toBe('255.255.255.254'))
  it('/32 → 255.255.255.255', () => expect(intToIp(prefixToMask(32))).toBe('255.255.255.255'))
})

// ─── maskToPrefix ────────────────────────────────────────────────────────────

describe('maskToPrefix', () => {
  it('255.255.255.0  → 24', () => expect(maskToPrefix(ipToInt('255.255.255.0'))).toBe(24))
  it('255.0.0.0      → 8',  () => expect(maskToPrefix(ipToInt('255.0.0.0'))).toBe(8))
  it('255.240.0.0    → 12', () => expect(maskToPrefix(ipToInt('255.240.0.0'))).toBe(12))
  it('0.0.0.0        → 0',  () => expect(maskToPrefix(ipToInt('0.0.0.0'))).toBe(0))
  it('255.255.255.255 → 32', () => expect(maskToPrefix(ipToInt('255.255.255.255'))).toBe(32))

  it('throws for non-contiguous mask 255.0.255.0', () => {
    expect(() => maskToPrefix(ipToInt('255.0.255.0'))).toThrow(/non-contiguous/i)
  })
})

// ─── calculateSubnet ─────────────────────────────────────────────────────────

describe('calculateSubnet', () => {
  it('caso base — 192.168.1.0/24', () => {
    const s = calculateSubnet('192.168.1.0/24')
    expect(s.networkAddress).toBe('192.168.1.0')
    expect(s.broadcastAddress).toBe('192.168.1.255')
    expect(s.firstHost).toBe('192.168.1.1')
    expect(s.lastHost).toBe('192.168.1.254')
    expect(s.subnetMask).toBe('255.255.255.0')
    expect(s.wildcardMask).toBe('0.0.0.255')
    expect(s.prefix).toBe(24)
    expect(s.totalHosts).toBe(256)
    expect(s.usableHosts).toBe(254)
    expect(s.ipClass).toBe('Private')
    expect(s.isPrivate).toBe(true)
    expect(s.isCidrNotation).toBe(true)
    expect(s.binaryNetworkAddress).toBe('11000000101010000000000100000000')
    expect(s.binaryNetworkAddress).toHaveLength(32)
    expect(s.binarySubnetMask).toBe('11111111111111111111111100000000')
  })

  it('clase A privada — 10.0.0.0/8', () => {
    const s = calculateSubnet('10.0.0.0/8')
    expect(s.networkAddress).toBe('10.0.0.0')
    expect(s.broadcastAddress).toBe('10.255.255.255')
    expect(s.firstHost).toBe('10.0.0.1')
    expect(s.lastHost).toBe('10.255.255.254')
    expect(s.prefix).toBe(8)
    expect(s.totalHosts).toBe(16777216)
    expect(s.usableHosts).toBe(16777214)
    expect(s.ipClass).toBe('Private')
    expect(s.isPrivate).toBe(true)
  })

  it('RFC 1918 borde — 172.16.0.0/12', () => {
    const s = calculateSubnet('172.16.0.0/12')
    expect(s.networkAddress).toBe('172.16.0.0')
    expect(s.broadcastAddress).toBe('172.31.255.255')
    expect(s.subnetMask).toBe('255.240.0.0')
    expect(s.prefix).toBe(12)
    expect(s.totalHosts).toBe(1048576)
    expect(s.usableHosts).toBe(1048574)
    expect(s.ipClass).toBe('Private')
    expect(s.isPrivate).toBe(true)
  })

  it('ruta default — 0.0.0.0/0', () => {
    const s = calculateSubnet('0.0.0.0/0')
    expect(s.networkAddress).toBe('0.0.0.0')
    expect(s.broadcastAddress).toBe('255.255.255.255')
    expect(s.firstHost).toBe('0.0.0.1')
    expect(s.lastHost).toBe('255.255.255.254')
    expect(s.subnetMask).toBe('0.0.0.0')
    expect(s.wildcardMask).toBe('255.255.255.255')
    expect(s.prefix).toBe(0)
    expect(s.totalHosts).toBe(4294967296)
    expect(s.usableHosts).toBe(4294967294)
  })

  it('normaliza IP de host — 192.168.1.1/24 → network 192.168.1.0', () => {
    const s = calculateSubnet('192.168.1.1/24')
    expect(s.networkAddress).toBe('192.168.1.0')
    expect(s.broadcastAddress).toBe('192.168.1.255')
    expect(s.firstHost).toBe('192.168.1.1')
    expect(s.lastHost).toBe('192.168.1.254')
  })

  it('red P2P /30 — usableHosts=2', () => {
    const s = calculateSubnet('10.10.10.0/30')
    expect(s.networkAddress).toBe('10.10.10.0')
    expect(s.broadcastAddress).toBe('10.10.10.3')
    expect(s.firstHost).toBe('10.10.10.1')
    expect(s.lastHost).toBe('10.10.10.2')
    expect(s.totalHosts).toBe(4)
    expect(s.usableHosts).toBe(2)
  })

  it('host route — 192.168.1.1/32', () => {
    const s = calculateSubnet('192.168.1.1/32')
    expect(s.networkAddress).toBe('192.168.1.1')
    expect(s.broadcastAddress).toBe('192.168.1.1')
    expect(s.firstHost).toBe('192.168.1.1')
    expect(s.lastHost).toBe('192.168.1.1')
    expect(s.totalHosts).toBe(1)
    expect(s.usableHosts).toBe(1)
  })

  it('RFC 3021 — 192.168.1.0/31, usableHosts=2', () => {
    const s = calculateSubnet('192.168.1.0/31')
    expect(s.networkAddress).toBe('192.168.1.0')
    expect(s.broadcastAddress).toBe('192.168.1.1')
    expect(s.firstHost).toBe('192.168.1.0')
    expect(s.lastHost).toBe('192.168.1.1')
    expect(s.totalHosts).toBe(2)
    expect(s.usableHosts).toBe(2)
  })
})

// ─── calculateSubnetFromMask ─────────────────────────────────────────────────

describe('calculateSubnetFromMask', () => {
  it('equivalent to calculateSubnet for same network', () => {
    const byCidr = calculateSubnet('192.168.1.0/24')
    const byMask = calculateSubnetFromMask('192.168.1.0', '255.255.255.0')
    expect(byMask.networkAddress).toBe(byCidr.networkAddress)
    expect(byMask.broadcastAddress).toBe(byCidr.broadcastAddress)
    expect(byMask.prefix).toBe(byCidr.prefix)
  })
})

// ─── ipInSubnet ──────────────────────────────────────────────────────────────

describe('ipInSubnet', () => {
  it('192.168.1.100 in 192.168.1.0/24 → true', () => {
    expect(ipInSubnet('192.168.1.100', '192.168.1.0/24')).toBe(true)
  })

  it('192.168.2.1 not in 192.168.1.0/24 → false', () => {
    expect(ipInSubnet('192.168.2.1', '192.168.1.0/24')).toBe(false)
  })

  it('network address itself is in subnet', () => {
    expect(ipInSubnet('192.168.1.0', '192.168.1.0/24')).toBe(true)
  })

  it('broadcast address is in subnet', () => {
    expect(ipInSubnet('192.168.1.255', '192.168.1.0/24')).toBe(true)
  })

  it('one address below network → false', () => {
    expect(ipInSubnet('192.168.0.255', '192.168.1.0/24')).toBe(false)
  })
})

// ─── subnetsOverlap ──────────────────────────────────────────────────────────

describe('subnetsOverlap', () => {
  it('10.0.0.0/8 contains 10.5.0.0/16 → true', () => {
    expect(subnetsOverlap('10.0.0.0/8', '10.5.0.0/16')).toBe(true)
  })

  it('192.168.0.0/24 and 192.168.1.0/24 are adjacent → false', () => {
    expect(subnetsOverlap('192.168.0.0/24', '192.168.1.0/24')).toBe(false)
  })

  it('identical subnets → true', () => {
    expect(subnetsOverlap('10.0.0.0/24', '10.0.0.0/24')).toBe(true)
  })

  it('completely disjoint → false', () => {
    expect(subnetsOverlap('172.16.0.0/12', '192.168.0.0/16')).toBe(false)
  })
})

// ─── subnetDivide ────────────────────────────────────────────────────────────

describe('subnetDivide', () => {
  it('192.168.0.0/24 ÷ 4 → 4 contiguous /26 blocks', () => {
    const subnets = subnetDivide('192.168.0.0/24', 4)
    expect(subnets).toHaveLength(4)

    for (const s of subnets) {
      expect(s.prefix).toBe(26)
      expect(s.totalHosts).toBe(64)
      expect(s.usableHosts).toBe(62)
    }

    expect(subnets[0].networkAddress).toBe('192.168.0.0')
    expect(subnets[1].networkAddress).toBe('192.168.0.64')
    expect(subnets[2].networkAddress).toBe('192.168.0.128')
    expect(subnets[3].networkAddress).toBe('192.168.0.192')

    // Contiguous: broadcast of block N + 1 = network of block N+1
    for (let i = 0; i < 3; i++) {
      const bcast = ipToInt(subnets[i].broadcastAddress)
      const nextNet = ipToInt(subnets[i + 1].networkAddress)
      expect(nextNet).toBe(bcast + 1)
    }
  })

  it('throws when not enough address space', () => {
    expect(() => subnetDivide('192.168.1.0/30', 8)).toThrow()
  })
})
