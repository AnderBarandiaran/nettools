import { ipToInt, intToIp, calculateSubnet, type SubnetInfo } from './ipv4';

export interface VLSMRequirement {
  name: string
  requiredHosts: number
}

export interface VLSMAllocation {
  requirement: VLSMRequirement
  subnet: SubnetInfo
  prefix: number
  wastedHosts: number
  utilizationPct: number
}

export interface VLSMPlan {
  parentBlock: string
  allocations: VLSMAllocation[]
  totalRequiredHosts: number
  totalUsableHosts: number
  totalWastedHosts: number
  remainingAddresses: number
  overallUtilizationPct: number
  fits: boolean
}

/**
 * Returns the longest prefix (smallest block) where usableHosts >= requiredHosts.
 * /32 → 1 host, /31 → 2 hosts (RFC 3021), /30 → 2 usable, /29 → 6, etc.
 */
export function minPrefixForHosts(requiredHosts: number): number {
  if (requiredHosts <= 0) throw new Error(`requiredHosts must be >= 1, got ${requiredHosts}`);
  for (let p = 32; p >= 0; p--) {
    const usable = p === 32 ? 1 : p === 31 ? 2 : Math.pow(2, 32 - p) - 2;
    if (usable >= requiredHosts) return p;
  }
  throw new Error(`Cannot fit ${requiredHosts} hosts in IPv4 address space`);
}

export function planVLSM(parentBlock: string, requirements: VLSMRequirement[]): VLSMPlan {
  const parentInfo = calculateSubnet(parentBlock);
  const parentNet = ipToInt(parentInfo.networkAddress);
  const parentBcast = ipToInt(parentInfo.broadcastAddress);
  const parentTotalHosts = parentInfo.totalHosts;

  const sorted = [...requirements].sort((a, b) => b.requiredHosts - a.requiredHosts);

  let nextIp = parentNet;
  let fits = true;
  const allocations: VLSMAllocation[] = [];

  for (const req of sorted) {
    const prefix = minPrefixForHosts(req.requiredHosts);
    const blockSize = prefix === 0 ? 4294967296 : Math.pow(2, 32 - prefix);

    // Align nextIp to the block boundary (next multiple of blockSize >= nextIp)
    const alignedStart = Math.ceil(nextIp / blockSize) * blockSize;
    const blockEnd = alignedStart + blockSize - 1;

    if (alignedStart > parentBcast || blockEnd > parentBcast) {
      fits = false;
      continue;
    }

    const subnet = calculateSubnet(`${intToIp(alignedStart)}/${prefix}`);
    const wastedHosts = subnet.usableHosts - req.requiredHosts;
    const utilizationPct = Math.round((req.requiredHosts / subnet.usableHosts) * 1000) / 10;

    allocations.push({ requirement: req, subnet, prefix, wastedHosts, utilizationPct });

    nextIp = alignedStart + blockSize;
  }

  // Return allocations ordered by network address ascending
  allocations.sort((a, b) => ipToInt(a.subnet.networkAddress) - ipToInt(b.subnet.networkAddress));

  const totalRequiredHosts = requirements.reduce((sum, r) => sum + r.requiredHosts, 0);
  const totalUsableHosts = allocations.reduce((sum, a) => sum + a.subnet.usableHosts, 0);
  const totalWastedHosts = allocations.reduce((sum, a) => sum + a.wastedHosts, 0);
  const usedAddresses = allocations.reduce((sum, a) => sum + a.subnet.totalHosts, 0);
  const remainingAddresses = parentTotalHosts - usedAddresses;
  const overallUtilizationPct =
    totalUsableHosts > 0
      ? Math.round((totalRequiredHosts / totalUsableHosts) * 1000) / 10
      : 0;

  return {
    parentBlock: `${parentInfo.networkAddress}/${parentInfo.prefix}`,
    allocations,
    totalRequiredHosts,
    totalUsableHosts,
    totalWastedHosts,
    remainingAddresses,
    overallUtilizationPct,
    fits,
  };
}

export function hasOverlaps(plan: VLSMPlan): boolean {
  const allocs = plan.allocations;
  for (let i = 0; i < allocs.length; i++) {
    for (let j = i + 1; j < allocs.length; j++) {
      const a = allocs[i].subnet;
      const b = allocs[j].subnet;
      const aNet = ipToInt(a.networkAddress);
      const aBcast = ipToInt(a.broadcastAddress);
      const bNet = ipToInt(b.networkAddress);
      const bBcast = ipToInt(b.broadcastAddress);
      if (aNet <= bBcast && bNet <= aBcast) return true;
    }
  }
  return false;
}
