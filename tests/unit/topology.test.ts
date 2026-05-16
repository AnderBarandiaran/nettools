import { describe, it, expect } from 'vitest'
import {
  createTopology,
  addDevice,
  removeDevice,
  connectDevices,
  removeLink,
  autoAssignIPs,
  analyzeTopology,
  getNeighbors,
  detectLoops,
  exportToCiscoConfig,
} from '../../src/lib/network/topology'

describe('topology engine', () => {
  it('createTopology generates unique ID and default addressingPool "10.0.0.0/8"', () => {
    const t1 = createTopology('Test')
    const t2 = createTopology('Test')
    expect(t1.id).toBeTruthy()
    expect(t1.id).not.toBe(t2.id)
    expect(t1.addressingPool).toBe('10.0.0.0/8')
    expect(t1.devices).toHaveLength(0)
    expect(t1.links).toHaveLength(0)
  })

  it('addDevice(router) creates 4 GigabitEthernet interfaces', () => {
    const t = createTopology('Test')
    const { device } = addDevice(t, 'router', 'R1', 0, 0)
    expect(device.interfaces).toHaveLength(4)
    expect(device.interfaces[0].id).toBe('GigabitEthernet0/0')
    expect(device.interfaces[3].id).toBe('GigabitEthernet0/3')
  })

  it('addDevice(switch) creates 8 GigabitEthernet interfaces', () => {
    const t = createTopology('Test')
    const { device } = addDevice(t, 'switch', 'SW1', 0, 0)
    expect(device.interfaces).toHaveLength(8)
    expect(device.interfaces[0].id).toBe('GigabitEthernet0/1')
    expect(device.interfaces[7].id).toBe('GigabitEthernet0/8')
  })

  it('addDevice(host) creates 1 interface eth0', () => {
    const t = createTopology('Test')
    const { device } = addDevice(t, 'host', 'H1', 0, 0)
    expect(device.interfaces).toHaveLength(1)
    expect(device.interfaces[0].id).toBe('eth0')
  })

  it('connectDevices selects first free interface of each device', () => {
    let t = createTopology('Test')
    let r1: ReturnType<typeof addDevice>['device']
    let r2: ReturnType<typeof addDevice>['device']
    ;({ topology: t, device: r1 } = addDevice(t, 'router', 'R1', 0, 0))
    ;({ topology: t, device: r2 } = addDevice(t, 'router', 'R2', 100, 0))

    const { link } = connectDevices(t, r1.id, r2.id)
    expect(link.sourceInterfaceId).toBe('GigabitEthernet0/0')
    expect(link.targetInterfaceId).toBe('GigabitEthernet0/0')
  })

  it('connectDevices throws if device has no free interfaces', () => {
    let t = createTopology('Test')
    let h1: ReturnType<typeof addDevice>['device']
    let r1: ReturnType<typeof addDevice>['device']
    let r2: ReturnType<typeof addDevice>['device']
    ;({ topology: t, device: h1 } = addDevice(t, 'host', 'H1', 0, 0))
    ;({ topology: t, device: r1 } = addDevice(t, 'router', 'R1', 100, 0))
    ;({ topology: t, device: r2 } = addDevice(t, 'router', 'R2', 200, 0))
    ;({ topology: t } = connectDevices(t, h1.id, r1.id))

    expect(() => connectDevices(t, h1.id, r2.id)).toThrow()
  })

  it('removeDevice removes the device and all its associated links', () => {
    let t = createTopology('Test')
    let r1: ReturnType<typeof addDevice>['device']
    let r2: ReturnType<typeof addDevice>['device']
    let r3: ReturnType<typeof addDevice>['device']
    ;({ topology: t, device: r1 } = addDevice(t, 'router', 'R1', 0, 0))
    ;({ topology: t, device: r2 } = addDevice(t, 'router', 'R2', 100, 0))
    ;({ topology: t, device: r3 } = addDevice(t, 'router', 'R3', 200, 0))
    ;({ topology: t } = connectDevices(t, r1.id, r2.id))
    ;({ topology: t } = connectDevices(t, r2.id, r3.id))

    expect(t.links).toHaveLength(2)
    t = removeDevice(t, r2.id)
    expect(t.devices).toHaveLength(2)
    expect(t.links).toHaveLength(0)
  })

  it('removeLink frees the interfaces on both ends', () => {
    let t = createTopology('Test')
    let r1: ReturnType<typeof addDevice>['device']
    let r2: ReturnType<typeof addDevice>['device']
    let link: ReturnType<typeof connectDevices>['link']
    ;({ topology: t, device: r1 } = addDevice(t, 'router', 'R1', 0, 0))
    ;({ topology: t, device: r2 } = addDevice(t, 'router', 'R2', 100, 0))
    ;({ topology: t, link } = connectDevices(t, r1.id, r2.id))

    expect(t.devices.find(d => d.id === r1.id)!.interfaces[0].connectedTo).toBe(link.id)

    t = removeLink(t, link.id)

    expect(t.devices.find(d => d.id === r1.id)!.interfaces[0].connectedTo).toBeUndefined()
    expect(t.devices.find(d => d.id === r2.id)!.interfaces[0].connectedTo).toBeUndefined()
  })

  it('autoAssignIPs assigns contiguous /30 subnets starting from the pool', () => {
    let t = createTopology('Test', '10.0.0.0/8')
    let r1: ReturnType<typeof addDevice>['device']
    let r2: ReturnType<typeof addDevice>['device']
    let r3: ReturnType<typeof addDevice>['device']
    ;({ topology: t, device: r1 } = addDevice(t, 'router', 'R1', 0, 0))
    ;({ topology: t, device: r2 } = addDevice(t, 'router', 'R2', 100, 0))
    ;({ topology: t, device: r3 } = addDevice(t, 'router', 'R3', 200, 0))
    ;({ topology: t } = connectDevices(t, r1.id, r2.id))
    ;({ topology: t } = connectDevices(t, r2.id, r3.id))

    t = autoAssignIPs(t)

    expect(t.links[0].subnet).toBe('10.0.0.0/30')
    expect(t.links[1].subnet).toBe('10.0.0.4/30')
  })

  it('autoAssignIPs: R1 gets 10.0.0.1, R2 gets 10.0.0.2 for a single link', () => {
    let t = createTopology('Test', '10.0.0.0/8')
    let r1: ReturnType<typeof addDevice>['device']
    let r2: ReturnType<typeof addDevice>['device']
    ;({ topology: t, device: r1 } = addDevice(t, 'router', 'R1', 0, 0))
    ;({ topology: t, device: r2 } = addDevice(t, 'router', 'R2', 100, 0))
    ;({ topology: t } = connectDevices(t, r1.id, r2.id))

    t = autoAssignIPs(t)

    const r1Iface = t.devices.find(d => d.id === r1.id)!.interfaces.find(i => i.ipAddress)!
    const r2Iface = t.devices.find(d => d.id === r2.id)!.interfaces.find(i => i.ipAddress)!
    expect(r1Iface.ipAddress).toBe('10.0.0.1')
    expect(r2Iface.ipAddress).toBe('10.0.0.2')
  })

  it('autoAssignIPs does not overwrite pre-existing manual IPs', () => {
    let t = createTopology('Test', '10.0.0.0/8')
    let r1: ReturnType<typeof addDevice>['device']
    let r2: ReturnType<typeof addDevice>['device']
    ;({ topology: t, device: r1 } = addDevice(t, 'router', 'R1', 0, 0))
    ;({ topology: t, device: r2 } = addDevice(t, 'router', 'R2', 100, 0))
    ;({ topology: t } = connectDevices(t, r1.id, r2.id))

    // Manually set IP on R1's first interface before auto-assign
    t = {
      ...t,
      devices: t.devices.map(d =>
        d.id !== r1.id
          ? d
          : {
              ...d,
              interfaces: d.interfaces.map((iface, idx) =>
                idx === 0
                  ? { ...iface, ipAddress: '192.168.1.1', subnetMask: '255.255.255.252' }
                  : iface
              ),
            }
      ),
    }

    t = autoAssignIPs(t)

    const r1Iface = t.devices.find(d => d.id === r1.id)!.interfaces[0]
    expect(r1Iface.ipAddress).toBe('192.168.1.1')
  })

  it('analyzeTopology returns symmetric adjacency entries (A→B and B→A)', () => {
    let t = createTopology('Test')
    let r1: ReturnType<typeof addDevice>['device']
    let r2: ReturnType<typeof addDevice>['device']
    ;({ topology: t, device: r1 } = addDevice(t, 'router', 'R1', 0, 0))
    ;({ topology: t, device: r2 } = addDevice(t, 'router', 'R2', 100, 0))
    ;({ topology: t } = connectDevices(t, r1.id, r2.id))

    const analysis = analyzeTopology(t)
    expect(analysis.adjacencyTable).toHaveLength(2)
    expect(analysis.adjacencyTable.find(e => e.deviceId === r1.id && e.neighborId === r2.id)).toBeDefined()
    expect(analysis.adjacencyTable.find(e => e.deviceId === r2.id && e.neighborId === r1.id)).toBeDefined()
  })

  it('analyzeTopology detects disconnected devices', () => {
    let t = createTopology('Test')
    let r1: ReturnType<typeof addDevice>['device']
    let r2: ReturnType<typeof addDevice>['device']
    let r3: ReturnType<typeof addDevice>['device']
    ;({ topology: t, device: r1 } = addDevice(t, 'router', 'R1', 0, 0))
    ;({ topology: t, device: r2 } = addDevice(t, 'router', 'R2', 100, 0))
    ;({ topology: t, device: r3 } = addDevice(t, 'router', 'R3', 200, 0))
    ;({ topology: t } = connectDevices(t, r1.id, r2.id))

    const analysis = analyzeTopology(t)
    expect(analysis.disconnectedDevices).toContain(r3.id)
    expect(analysis.disconnectedDevices).not.toContain(r1.id)
    expect(analysis.disconnectedDevices).not.toContain(r2.id)
  })

  it('detectLoops returns false for linear topology R1-R2-R3', () => {
    let t = createTopology('Test')
    let r1: ReturnType<typeof addDevice>['device']
    let r2: ReturnType<typeof addDevice>['device']
    let r3: ReturnType<typeof addDevice>['device']
    ;({ topology: t, device: r1 } = addDevice(t, 'router', 'R1', 0, 0))
    ;({ topology: t, device: r2 } = addDevice(t, 'router', 'R2', 100, 0))
    ;({ topology: t, device: r3 } = addDevice(t, 'router', 'R3', 200, 0))
    ;({ topology: t } = connectDevices(t, r1.id, r2.id))
    ;({ topology: t } = connectDevices(t, r2.id, r3.id))

    expect(detectLoops(t)).toBe(false)
  })

  it('detectLoops returns true for triangle topology R1-R2-R3-R1', () => {
    let t = createTopology('Test')
    let r1: ReturnType<typeof addDevice>['device']
    let r2: ReturnType<typeof addDevice>['device']
    let r3: ReturnType<typeof addDevice>['device']
    ;({ topology: t, device: r1 } = addDevice(t, 'router', 'R1', 0, 0))
    ;({ topology: t, device: r2 } = addDevice(t, 'router', 'R2', 100, 0))
    ;({ topology: t, device: r3 } = addDevice(t, 'router', 'R3', 200, 0))
    ;({ topology: t } = connectDevices(t, r1.id, r2.id))
    ;({ topology: t } = connectDevices(t, r2.id, r3.id))
    ;({ topology: t } = connectDevices(t, r3.id, r1.id))

    expect(detectLoops(t)).toBe(true)
  })

  it('getNeighbors returns correct neighbors for the central device', () => {
    let t = createTopology('Test')
    let r1: ReturnType<typeof addDevice>['device']
    let r2: ReturnType<typeof addDevice>['device']
    let r3: ReturnType<typeof addDevice>['device']
    ;({ topology: t, device: r1 } = addDevice(t, 'router', 'R1', 0, 0))
    ;({ topology: t, device: r2 } = addDevice(t, 'router', 'R2', 100, 0))
    ;({ topology: t, device: r3 } = addDevice(t, 'router', 'R3', 200, 0))
    ;({ topology: t } = connectDevices(t, r1.id, r2.id))
    ;({ topology: t } = connectDevices(t, r2.id, r3.id))

    const neighbors = getNeighbors(t, r2.id)
    expect(neighbors).toHaveLength(2)
    const neighborIds = neighbors.map(n => n.device.id)
    expect(neighborIds).toContain(r1.id)
    expect(neighborIds).toContain(r3.id)
  })

  it('exportToCiscoConfig generates "hostname R1" for a router named R1', () => {
    let t = createTopology('Test', '10.0.0.0/8')
    let r1: ReturnType<typeof addDevice>['device']
    let r2: ReturnType<typeof addDevice>['device']
    ;({ topology: t, device: r1 } = addDevice(t, 'router', 'R1', 0, 0))
    ;({ topology: t, device: r2 } = addDevice(t, 'router', 'R2', 100, 0))
    ;({ topology: t } = connectDevices(t, r1.id, r2.id))
    t = autoAssignIPs(t)

    expect(exportToCiscoConfig(t)).toContain('hostname R1')
  })

  it('exportToCiscoConfig includes "ip address" commands for each interface with an IP', () => {
    let t = createTopology('Test', '10.0.0.0/8')
    let r1: ReturnType<typeof addDevice>['device']
    let r2: ReturnType<typeof addDevice>['device']
    ;({ topology: t, device: r1 } = addDevice(t, 'router', 'R1', 0, 0))
    ;({ topology: t, device: r2 } = addDevice(t, 'router', 'R2', 100, 0))
    ;({ topology: t } = connectDevices(t, r1.id, r2.id))
    t = autoAssignIPs(t)

    const config = exportToCiscoConfig(t)
    expect(config).toContain('ip address 10.0.0.1 255.255.255.252')
    expect(config).toContain('ip address 10.0.0.2 255.255.255.252')
  })
})
