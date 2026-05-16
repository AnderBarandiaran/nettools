import { calculateSubnet, ipToInt, intToIp, prefixToMask } from './ipv4'

export type DeviceType = 'router' | 'switch' | 'host' | 'firewall' | 'cloud'

export interface NetworkInterface {
  id: string
  ipAddress?: string
  subnetMask?: string
  connectedTo?: string
  autoAssigned?: boolean
}

export interface TopologyDevice {
  id: string
  type: DeviceType
  label: string
  interfaces: NetworkInterface[]
  x: number
  y: number
  managementIp?: string
}

export interface TopologyLink {
  id: string
  sourceDeviceId: string
  sourceInterfaceId: string
  targetDeviceId: string
  targetInterfaceId: string
  linkType: 'ethernet' | 'serial' | 'fiber'
  subnet?: string
  autoAssigned?: boolean
}

export interface Topology {
  id: string
  name: string
  devices: TopologyDevice[]
  links: TopologyLink[]
  addressingPool: string
  createdAt: Date
  updatedAt: Date
}

export interface AdjacencyEntry {
  deviceId: string
  deviceLabel: string
  deviceType: DeviceType
  neighborId: string
  neighborLabel: string
  neighborType: DeviceType
  localInterface: string
  remoteInterface: string
  linkType: string
  subnet?: string
}

export interface TopologyAnalysis {
  adjacencyTable: AdjacencyEntry[]
  deviceCount: number
  linkCount: number
  subnetCount: number
  hasLoops: boolean
  disconnectedDevices: string[]
  ipConflicts: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID()
}

function defaultInterfaces(type: DeviceType): NetworkInterface[] {
  switch (type) {
    case 'router':
      return Array.from({ length: 4 }, (_, i) => ({ id: `GigabitEthernet0/${i}` }))
    case 'switch':
      return Array.from({ length: 8 }, (_, i) => ({ id: `GigabitEthernet0/${i + 1}` }))
    case 'host':
      return [{ id: 'eth0' }]
    case 'firewall':
      return [{ id: 'outside' }, { id: 'inside' }, { id: 'dmz' }]
    case 'cloud':
      return [{ id: 'uplink' }]
  }
}

// ─── Gestión del grafo ────────────────────────────────────────────────────────

export function createTopology(name: string, addressingPool?: string): Topology {
  return {
    id: generateId(),
    name,
    devices: [],
    links: [],
    addressingPool: addressingPool ?? '10.0.0.0/8',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

export function addDevice(
  topology: Topology,
  type: DeviceType,
  label: string,
  x: number,
  y: number
): { topology: Topology; device: TopologyDevice } {
  const device: TopologyDevice = {
    id: generateId(),
    type,
    label,
    interfaces: defaultInterfaces(type),
    x,
    y,
  }
  const updated: Topology = {
    ...topology,
    devices: [...topology.devices, device],
    updatedAt: new Date(),
  }
  return { topology: updated, device }
}

export function removeDevice(topology: Topology, deviceId: string): Topology {
  const linksToRemove = new Set(
    topology.links
      .filter(l => l.sourceDeviceId === deviceId || l.targetDeviceId === deviceId)
      .map(l => l.id)
  )

  const updatedDevices = topology.devices
    .filter(d => d.id !== deviceId)
    .map(d => ({
      ...d,
      interfaces: d.interfaces.map(iface =>
        iface.connectedTo && linksToRemove.has(iface.connectedTo)
          ? { ...iface, connectedTo: undefined }
          : iface
      ),
    }))

  return {
    ...topology,
    devices: updatedDevices,
    links: topology.links.filter(l => !linksToRemove.has(l.id)),
    updatedAt: new Date(),
  }
}

export function connectDevices(
  topology: Topology,
  sourceDeviceId: string,
  targetDeviceId: string,
  linkType: TopologyLink['linkType'] = 'ethernet'
): { topology: Topology; link: TopologyLink } {
  const sourceDevice = topology.devices.find(d => d.id === sourceDeviceId)
  const targetDevice = topology.devices.find(d => d.id === targetDeviceId)

  if (!sourceDevice) throw new Error(`Device not found: ${sourceDeviceId}`)
  if (!targetDevice) throw new Error(`Device not found: ${targetDeviceId}`)

  const srcFree = sourceDevice.interfaces.find(i => !i.connectedTo)
  if (!srcFree) throw new Error(`No free interfaces on device: ${sourceDevice.label}`)

  const tgtFree = targetDevice.interfaces.find(i => !i.connectedTo)
  if (!tgtFree) throw new Error(`No free interfaces on device: ${targetDevice.label}`)

  const link: TopologyLink = {
    id: generateId(),
    sourceDeviceId,
    sourceInterfaceId: srcFree.id,
    targetDeviceId,
    targetInterfaceId: tgtFree.id,
    linkType,
  }

  const updatedDevices = topology.devices.map(d => {
    if (d.id === sourceDeviceId) {
      return {
        ...d,
        interfaces: d.interfaces.map(i =>
          i.id === srcFree.id ? { ...i, connectedTo: link.id } : i
        ),
      }
    }
    if (d.id === targetDeviceId) {
      return {
        ...d,
        interfaces: d.interfaces.map(i =>
          i.id === tgtFree.id ? { ...i, connectedTo: link.id } : i
        ),
      }
    }
    return d
  })

  return {
    topology: { ...topology, devices: updatedDevices, links: [...topology.links, link], updatedAt: new Date() },
    link,
  }
}

export function removeLink(topology: Topology, linkId: string): Topology {
  const link = topology.links.find(l => l.id === linkId)
  if (!link) return topology

  const updatedDevices = topology.devices.map(d => {
    if (d.id === link.sourceDeviceId) {
      return {
        ...d,
        interfaces: d.interfaces.map(i =>
          i.id === link.sourceInterfaceId ? { ...i, connectedTo: undefined } : i
        ),
      }
    }
    if (d.id === link.targetDeviceId) {
      return {
        ...d,
        interfaces: d.interfaces.map(i =>
          i.id === link.targetInterfaceId ? { ...i, connectedTo: undefined } : i
        ),
      }
    }
    return d
  })

  return {
    ...topology,
    devices: updatedDevices,
    links: topology.links.filter(l => l.id !== linkId),
    updatedAt: new Date(),
  }
}

export function moveDevice(
  topology: Topology,
  deviceId: string,
  x: number,
  y: number
): Topology {
  return {
    ...topology,
    devices: topology.devices.map(d =>
      d.id === deviceId ? { ...d, x, y } : d
    ),
    updatedAt: new Date(),
  }
}

// ─── Asignación automática de IPs ─────────────────────────────────────────────

export function autoAssignIPs(topology: Topology): Topology {
  const poolInfo = calculateSubnet(topology.addressingPool)
  const poolNetworkInt = ipToInt(poolInfo.networkAddress)
  const poolBroadcastInt = ipToInt(poolInfo.broadcastAddress)
  const blockSize = 4 // /30 = 4 addresses

  // Subnets already in use (manual or previously auto-assigned)
  const usedSubnets = new Set<number>(
    topology.links
      .filter(l => l.subnet)
      .map(l => ipToInt(calculateSubnet(l.subnet!).networkAddress))
  )

  let cursor = poolNetworkInt

  function nextFreeBlock(): number {
    while (cursor + blockSize - 1 <= poolBroadcastInt) {
      const candidate = cursor
      cursor += blockSize
      if (!usedSubnets.has(candidate)) {
        usedSubnets.add(candidate)
        return candidate
      }
    }
    throw new Error('Address pool exhausted: not enough /30 subnets for all links')
  }

  const mask30 = intToIp(prefixToMask(30))

  // Deep-clone devices (mutable during assignment)
  const devices = topology.devices.map(d => ({
    ...d,
    interfaces: d.interfaces.map(i => ({ ...i })),
  }))

  const links = topology.links.map(l => ({ ...l }))

  for (const link of links) {
    if (link.subnet) continue

    const blockInt = nextFreeBlock()
    const firstHostIp = intToIp(blockInt + 1)
    const secondHostIp = intToIp(blockInt + 2)
    link.subnet = `${intToIp(blockInt)}/30`
    link.autoAssigned = true

    const srcDevice = devices.find(d => d.id === link.sourceDeviceId)
    if (srcDevice) {
      const srcIface = srcDevice.interfaces.find(i => i.id === link.sourceInterfaceId)
      if (srcIface && !srcIface.ipAddress) {
        srcIface.ipAddress = firstHostIp
        srcIface.subnetMask = mask30
        srcIface.autoAssigned = true
      }
      if (!srcDevice.managementIp) {
        srcDevice.managementIp = srcIface?.ipAddress ?? firstHostIp
      }
    }

    const tgtDevice = devices.find(d => d.id === link.targetDeviceId)
    if (tgtDevice) {
      const tgtIface = tgtDevice.interfaces.find(i => i.id === link.targetInterfaceId)
      if (tgtIface && !tgtIface.ipAddress) {
        tgtIface.ipAddress = secondHostIp
        tgtIface.subnetMask = mask30
        tgtIface.autoAssigned = true
      }
      if (!tgtDevice.managementIp) {
        tgtDevice.managementIp = tgtIface?.ipAddress ?? secondHostIp
      }
    }
  }

  return { ...topology, devices, links, updatedAt: new Date() }
}

export function clearAutoAssignedIPs(topology: Topology): Topology {
  const autoIps = new Set<string>()
  for (const d of topology.devices) {
    for (const i of d.interfaces) {
      if (i.autoAssigned && i.ipAddress) autoIps.add(i.ipAddress)
    }
  }

  const devices = topology.devices.map(d => {
    const interfaces = d.interfaces.map(i =>
      i.autoAssigned
        ? { id: i.id, ...(i.connectedTo !== undefined && { connectedTo: i.connectedTo }) }
        : i
    )
    const managementIp =
      d.managementIp && autoIps.has(d.managementIp) ? undefined : d.managementIp
    return { ...d, interfaces, managementIp }
  })

  const links = topology.links.map(l =>
    l.autoAssigned ? { ...l, subnet: undefined, autoAssigned: undefined } : l
  )

  return { ...topology, devices, links, updatedAt: new Date() }
}

// ─── Análisis ─────────────────────────────────────────────────────────────────

export function analyzeTopology(topology: Topology): TopologyAnalysis {
  const deviceMap = new Map(topology.devices.map(d => [d.id, d]))
  const adjacencyTable: AdjacencyEntry[] = []
  const subnets = new Set<string>()
  const connectedIds = new Set<string>()

  for (const link of topology.links) {
    const src = deviceMap.get(link.sourceDeviceId)
    const tgt = deviceMap.get(link.targetDeviceId)
    if (!src || !tgt) continue

    connectedIds.add(link.sourceDeviceId)
    connectedIds.add(link.targetDeviceId)
    if (link.subnet) subnets.add(link.subnet)

    adjacencyTable.push({
      deviceId: link.sourceDeviceId,
      deviceLabel: src.label,
      deviceType: src.type,
      neighborId: link.targetDeviceId,
      neighborLabel: tgt.label,
      neighborType: tgt.type,
      localInterface: link.sourceInterfaceId,
      remoteInterface: link.targetInterfaceId,
      linkType: link.linkType,
      subnet: link.subnet,
    })

    adjacencyTable.push({
      deviceId: link.targetDeviceId,
      deviceLabel: tgt.label,
      deviceType: tgt.type,
      neighborId: link.sourceDeviceId,
      neighborLabel: src.label,
      neighborType: src.type,
      localInterface: link.targetInterfaceId,
      remoteInterface: link.sourceInterfaceId,
      linkType: link.linkType,
      subnet: link.subnet,
    })
  }

  const ipCount = new Map<string, number>()
  for (const d of topology.devices) {
    for (const i of d.interfaces) {
      if (i.ipAddress) ipCount.set(i.ipAddress, (ipCount.get(i.ipAddress) ?? 0) + 1)
    }
  }

  return {
    adjacencyTable,
    deviceCount: topology.devices.length,
    linkCount: topology.links.length,
    subnetCount: subnets.size,
    hasLoops: detectLoops(topology),
    disconnectedDevices: topology.devices.filter(d => !connectedIds.has(d.id)).map(d => d.id),
    ipConflicts: [...ipCount.entries()].filter(([, n]) => n > 1).map(([ip]) => ip),
  }
}

export function getNeighbors(
  topology: Topology,
  deviceId: string
): Array<{ device: TopologyDevice; link: TopologyLink }> {
  const deviceMap = new Map(topology.devices.map(d => [d.id, d]))
  return topology.links
    .filter(l => l.sourceDeviceId === deviceId || l.targetDeviceId === deviceId)
    .flatMap(link => {
      const neighborId =
        link.sourceDeviceId === deviceId ? link.targetDeviceId : link.sourceDeviceId
      const device = deviceMap.get(neighborId)
      return device ? [{ device, link }] : []
    })
}

export function detectLoops(topology: Topology): boolean {
  // Undirected cycle detection via DFS, tracking parent edge to handle multigraphs
  const adj = new Map<string, Array<{ neighborId: string; linkId: string }>>()
  for (const d of topology.devices) adj.set(d.id, [])
  for (const l of topology.links) {
    adj.get(l.sourceDeviceId)?.push({ neighborId: l.targetDeviceId, linkId: l.id })
    adj.get(l.targetDeviceId)?.push({ neighborId: l.sourceDeviceId, linkId: l.id })
  }

  const visited = new Set<string>()

  function dfs(nodeId: string, parentLinkId: string | null): boolean {
    visited.add(nodeId)
    for (const { neighborId, linkId } of adj.get(nodeId) ?? []) {
      if (linkId === parentLinkId) continue
      if (visited.has(neighborId)) return true
      if (dfs(neighborId, linkId)) return true
    }
    return false
  }

  for (const d of topology.devices) {
    if (!visited.has(d.id) && dfs(d.id, null)) return true
  }
  return false
}

// ─── Exportación ──────────────────────────────────────────────────────────────

export function exportToCiscoConfig(topology: Topology): string {
  return topology.devices
    .filter(d => d.type === 'router')
    .map(router => {
      const lines: string[] = [`! Device: ${router.label}`, `hostname ${router.label}`, '!']
      for (const iface of router.interfaces) {
        if (!iface.ipAddress || !iface.subnetMask) continue
        lines.push(`interface ${iface.id}`)
        lines.push(` ip address ${iface.ipAddress} ${iface.subnetMask}`)
        lines.push(' no shutdown')
        lines.push('!')
      }
      return lines.join('\n')
    })
    .join('\n\n')
}
