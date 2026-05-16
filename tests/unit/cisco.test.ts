import { describe, it, expect } from 'vitest'
import { generateCiscoScript } from '../../src/lib/network/cisco'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** True when the script contains at least one line that, when trimmed, equals `text`. */
function hasLine(script: string, text: string): boolean {
  return script.split('\n').some(l => l.trim() === text);
}

/** Index of the first line containing `substr`, or -1. */
function lineIndex(script: string, substr: string): number {
  return script.split('\n').findIndex(l => l.includes(substr));
}

// ─── interface-basic ─────────────────────────────────────────────────────────

describe('interface-basic', () => {
  const base = {
    type: 'interface-basic' as const,
    interfaceName: 'GigabitEthernet0/0',
    ipAddress: '192.168.1.1',
    subnetMask: '255.255.255.0',
  };

  it('generates ip address command', () => {
    const { script } = generateCiscoScript(base);
    expect(script).toContain('ip address 192.168.1.1 255.255.255.0');
  });

  it('generates no shutdown by default', () => {
    const { script } = generateCiscoScript(base);
    expect(hasLine(script, 'no shutdown')).toBe(true);
  });

  it('includes description when provided', () => {
    const { script } = generateCiscoScript({ ...base, description: 'LAN-Sales' });
    expect(script).toContain('description LAN-Sales');
  });

  it('does not include description when omitted', () => {
    const { script } = generateCiscoScript(base);
    expect(script).not.toContain('description');
  });

  it('shutdown=true generates shutdown instead of no shutdown', () => {
    const { script } = generateCiscoScript({ ...base, shutdown: true });
    // Line must be exactly "shutdown", not "no shutdown"
    expect(hasLine(script, 'shutdown')).toBe(true);
    expect(hasLine(script, 'no shutdown')).toBe(false);
  });

  it('wraps in configure terminal / end', () => {
    const { script } = generateCiscoScript(base);
    expect(hasLine(script, 'configure terminal')).toBe(true);
    expect(hasLine(script, 'end')).toBe(true);
  });

  it('includes duplex auto and speed auto when requested', () => {
    const { script } = generateCiscoScript({ ...base, duplexAuto: true, speedAuto: true });
    expect(hasLine(script, 'duplex auto')).toBe(true);
    expect(hasLine(script, 'speed auto')).toBe(true);
  });
});

// ─── interface-trunk ─────────────────────────────────────────────────────────

describe('interface-trunk', () => {
  const base = {
    type: 'interface-trunk' as const,
    interfaceName: 'GigabitEthernet0/1',
    allowedVlans: [30, 10, 20],
  };

  it('generates switchport mode trunk', () => {
    const { script } = generateCiscoScript(base);
    expect(hasLine(script, 'switchport mode trunk')).toBe(true);
  });

  it('generates switchport trunk allowed vlan with sorted VLANs', () => {
    const { script } = generateCiscoScript(base);
    expect(script).toContain('switchport trunk allowed vlan 10,20,30');
  });

  it('generates switchport trunk encapsulation dot1q', () => {
    const { script } = generateCiscoScript(base);
    expect(hasLine(script, 'switchport trunk encapsulation dot1q')).toBe(true);
  });

  it('uses specified native VLAN', () => {
    const { script } = generateCiscoScript({ ...base, nativeVlan: 99 });
    expect(script).toContain('switchport trunk native vlan 99');
  });

  it('warns when native VLAN is 1 (default)', () => {
    const { warnings } = generateCiscoScript(base);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some(w => w.toLowerCase().includes('vlan 1'))).toBe(true);
  });

  it('warns when nativeVlan is explicitly set to 1', () => {
    const { warnings } = generateCiscoScript({ ...base, nativeVlan: 1 });
    expect(warnings.some(w => w.toLowerCase().includes('vlan 1'))).toBe(true);
  });

  it('no warning when native VLAN is not 1', () => {
    const { warnings } = generateCiscoScript({ ...base, nativeVlan: 99 });
    expect(warnings).toHaveLength(0);
  });
});

// ─── ospf-basic ──────────────────────────────────────────────────────────────

describe('ospf-basic', () => {
  const base = {
    type: 'ospf-basic' as const,
    processId: 1,
    networks: [
      { network: '192.168.1.0', wildcardMask: '0.0.0.255', area: 0 },
      { network: '10.0.0.0',    wildcardMask: '0.0.0.3',   area: 0 },
    ],
  };

  it('generates router ospf with process ID', () => {
    const { script } = generateCiscoScript(base);
    expect(hasLine(script, 'router ospf 1')).toBe(true);
  });

  it('generates router-id when provided', () => {
    const { script } = generateCiscoScript({ ...base, routerId: '1.1.1.1' });
    expect(hasLine(script, 'router-id 1.1.1.1')).toBe(true);
  });

  it('does not generate router-id when omitted', () => {
    const { script } = generateCiscoScript(base);
    expect(script).not.toContain('router-id');
  });

  it('generates one passive-interface line per passive interface', () => {
    const { script } = generateCiscoScript({
      ...base,
      passiveInterfaces: ['GigabitEthernet0/1', 'GigabitEthernet0/2'],
    });
    expect(hasLine(script, 'passive-interface GigabitEthernet0/1')).toBe(true);
    expect(hasLine(script, 'passive-interface GigabitEthernet0/2')).toBe(true);
  });

  it('generates network statements for each entry', () => {
    const { script } = generateCiscoScript(base);
    expect(script).toContain('network 192.168.1.0 0.0.0.255 area 0');
    expect(script).toContain('network 10.0.0.0 0.0.0.3 area 0');
  });

  it('generates default-information originate when set', () => {
    const { script } = generateCiscoScript({ ...base, defaultInformationOriginate: true });
    expect(hasLine(script, 'default-information originate')).toBe(true);
  });
});

// ─── static-routes ───────────────────────────────────────────────────────────

describe('static-routes', () => {
  it('generates ip route without admin distance when not provided', () => {
    const { script } = generateCiscoScript({
      type: 'static-routes',
      routes: [{ destination: '192.168.2.0', mask: '255.255.255.0', nextHop: '10.0.0.1' }],
    });
    // Line should end at next-hop, no trailing number
    expect(hasLine(script, 'ip route 192.168.2.0 255.255.255.0 10.0.0.1')).toBe(true);
  });

  it('appends admin distance when provided', () => {
    const { script } = generateCiscoScript({
      type: 'static-routes',
      routes: [
        { destination: '0.0.0.0', mask: '0.0.0.0', nextHop: '10.0.0.1', adminDistance: 254 },
      ],
    });
    expect(hasLine(script, 'ip route 0.0.0.0 0.0.0.0 10.0.0.1 254')).toBe(true);
  });

  it('adds ! comment for routes with description', () => {
    const { script } = generateCiscoScript({
      type: 'static-routes',
      routes: [
        {
          destination: '10.1.0.0', mask: '255.255.0.0', nextHop: '172.16.0.1',
          description: 'Branch office',
        },
      ],
    });
    expect(script).toContain('! Branch office');
  });
});

// ─── acl-extended ────────────────────────────────────────────────────────────

describe('acl-extended — numeric name', () => {
  const base = {
    type: 'acl-extended' as const,
    name: '110',
    rules: [
      { action: 'permit' as const, protocol: 'tcp' as const, source: '192.168.1.0 0.0.0.255', destination: 'any', destinationPort: 'eq 80' },
      { action: 'deny' as const,   protocol: 'ip' as const,  source: 'any', destination: 'any' },
    ],
  };

  it('uses access-list N syntax for numeric name', () => {
    const { script } = generateCiscoScript(base);
    expect(script).toContain('access-list 110 permit tcp');
    expect(script).toContain('access-list 110 deny ip');
  });

  it('does NOT use ip access-list extended for numeric name', () => {
    const { script } = generateCiscoScript(base);
    expect(script).not.toContain('ip access-list extended');
  });

  it('includes destination port for tcp/udp rules', () => {
    const { script } = generateCiscoScript(base);
    expect(script).toContain('eq 80');
  });

  it('does NOT include port suffix for ip protocol rules', () => {
    const { script } = generateCiscoScript(base);
    // The deny ip line should not have a port suffix
    const denyLine = script.split('\n').find(l => l.includes('deny ip'));
    expect(denyLine).toBeDefined();
    expect(denyLine).not.toMatch(/eq \d+/);
  });
});

describe('acl-extended — named', () => {
  const base = {
    type: 'acl-extended' as const,
    name: 'BLOCK-SMTP',
    rules: [
      { action: 'deny' as const,   protocol: 'tcp' as const, source: 'any', destination: 'any', destinationPort: 'eq 25' },
      { action: 'permit' as const, protocol: 'ip' as const,  source: 'any', destination: 'any' },
    ],
  };

  it('uses ip access-list extended NAME syntax for string name', () => {
    const { script } = generateCiscoScript(base);
    expect(hasLine(script, 'ip access-list extended BLOCK-SMTP')).toBe(true);
  });

  it('uses sequence numbers starting at 10 incrementing by 10', () => {
    const { script } = generateCiscoScript(base);
    expect(script).toContain(' 10 deny tcp');
    expect(script).toContain(' 20 permit ip');
  });

  it('does NOT use access-list N syntax for string name', () => {
    const { script } = generateCiscoScript(base);
    expect(script).not.toMatch(/^access-list BLOCK/m);
  });

  it('applies to interface when applyToInterface is set', () => {
    const { script } = generateCiscoScript({
      ...base,
      applyToInterface: { interfaceName: 'GigabitEthernet0/0', direction: 'in' },
    });
    expect(script).toContain('ip access-group BLOCK-SMTP in');
    expect(hasLine(script, 'interface GigabitEthernet0/0')).toBe(true);
  });
});

// ─── vlan-config ─────────────────────────────────────────────────────────────

describe('vlan-config', () => {
  const base = {
    type: 'vlan-config' as const,
    vlans: [
      { id: 10, name: 'Sales',  sviIp: '192.168.10.1', sviMask: '255.255.255.0' },
      { id: 20, name: 'RRHH' },
    ],
  };

  it('generates vlan X / name Y for each VLAN', () => {
    const { script } = generateCiscoScript(base);
    expect(hasLine(script, 'vlan 10')).toBe(true);
    expect(hasLine(script, 'name Sales')).toBe(true);
    expect(hasLine(script, 'vlan 20')).toBe(true);
    expect(hasLine(script, 'name RRHH')).toBe(true);
  });

  it('generates interface VlanX with ip address for VLANs that have SVI', () => {
    const { script } = generateCiscoScript(base);
    expect(hasLine(script, 'interface Vlan10')).toBe(true);
    expect(script).toContain('ip address 192.168.10.1 255.255.255.0');
    expect(hasLine(script, 'no shutdown')).toBe(true);
  });

  it('does NOT generate SVI for VLANs without sviIp', () => {
    const { script } = generateCiscoScript(base);
    expect(script).not.toContain('interface Vlan20');
  });
});

// ─── dhcp-pool ───────────────────────────────────────────────────────────────

describe('dhcp-pool', () => {
  const base = {
    type: 'dhcp-pool' as const,
    pools: [
      {
        name: 'LAN-POOL',
        network: '192.168.1.0',
        mask: '255.255.255.0',
        defaultGateway: '192.168.1.1',
        dnsServers: ['8.8.8.8', '8.8.4.4'],
        domainName: 'corp.local',
        leaseTime: { days: 1, hours: 0, minutes: 0 },
        excludedRanges: [
          { start: '192.168.1.1', end: '192.168.1.10' },
          { start: '192.168.1.250', end: '192.168.1.254' },
        ],
      },
    ],
  };

  it('excluded-address lines appear before ip dhcp pool', () => {
    const { script } = generateCiscoScript(base);
    const exclIdx = lineIndex(script, 'ip dhcp excluded-address');
    const poolIdx = lineIndex(script, 'ip dhcp pool');
    expect(exclIdx).toBeGreaterThanOrEqual(0);
    expect(poolIdx).toBeGreaterThan(exclIdx);
  });

  it('generates all excluded ranges', () => {
    const { script } = generateCiscoScript(base);
    expect(script).toContain('ip dhcp excluded-address 192.168.1.1 192.168.1.10');
    expect(script).toContain('ip dhcp excluded-address 192.168.1.250 192.168.1.254');
  });

  it('generates pool with correct network, gateway, dns, domain, lease', () => {
    const { script } = generateCiscoScript(base);
    expect(hasLine(script, 'ip dhcp pool LAN-POOL')).toBe(true);
    expect(script).toContain('network 192.168.1.0 255.255.255.0');
    expect(hasLine(script, 'default-router 192.168.1.1')).toBe(true);
    expect(hasLine(script, 'dns-server 8.8.8.8 8.8.4.4')).toBe(true);
    expect(hasLine(script, 'domain-name corp.local')).toBe(true);
    expect(hasLine(script, 'lease 1 0 0')).toBe(true);
  });
});

// ─── commandCount ────────────────────────────────────────────────────────────

describe('commandCount', () => {
  it('excludes empty lines and lines starting with !', () => {
    // Minimal interface-basic without description, duplex, speed:
    // configure terminal  (1)
    // interface Gi0/0     (2)
    //  ip address ...     (3)
    //  no shutdown        (4)
    // end                 (5)
    const { script, commandCount } = generateCiscoScript({
      type: 'interface-basic',
      interfaceName: 'GigabitEthernet0/0',
      ipAddress: '10.0.0.1',
      subnetMask: '255.255.255.252',
    });

    // Verify manually: count non-empty, non-! lines
    const manualCount = script
      .split('\n')
      .filter(l => { const t = l.trim(); return t.length > 0 && !t.startsWith('!'); })
      .length;

    expect(commandCount).toBe(manualCount);
    expect(commandCount).toBe(5);
  });

  it('description adds one command to the count', () => {
    const withDesc = generateCiscoScript({
      type: 'interface-basic',
      interfaceName: 'GigabitEthernet0/0',
      ipAddress: '10.0.0.1',
      subnetMask: '255.255.255.252',
      description: 'WAN link',
    });
    expect(withDesc.commandCount).toBe(6);
  });

  it('commandCount matches manual count for OSPF script', () => {
    const result = generateCiscoScript({
      type: 'ospf-basic',
      processId: 10,
      networks: [
        { network: '10.0.0.0', wildcardMask: '0.0.0.3', area: 0 },
      ],
      routerId: '10.10.10.10',
      passiveInterfaces: ['Loopback0'],
    });
    const manual = result.script
      .split('\n')
      .filter(l => { const t = l.trim(); return t.length > 0 && !t.startsWith('!'); })
      .length;
    expect(result.commandCount).toBe(manual);
  });
});

// ─── Header ──────────────────────────────────────────────────────────────────

describe('script header', () => {
  it('starts with NetTools attribution comment', () => {
    const { script } = generateCiscoScript({
      type: 'interface-basic',
      interfaceName: 'Gi0/0',
      ipAddress: '1.1.1.1',
      subnetMask: '255.255.255.255',
    });
    expect(script.startsWith('! Generated by NetTools')).toBe(true);
  });

  it('includes a date line', () => {
    const { script } = generateCiscoScript({
      type: 'interface-basic',
      interfaceName: 'Gi0/0',
      ipAddress: '1.1.1.1',
      subnetMask: '255.255.255.255',
    });
    expect(script).toMatch(/! Date: \d{4}-\d{2}-\d{2}/);
  });
});
