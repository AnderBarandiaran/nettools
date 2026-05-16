/**
 * IPv4 utility library — RFC 950, RFC 1519 (CIDR), RFC 1918, RFC 3021
 * Zero external dependencies. All bitwise ops use >>> 0 to stay unsigned.
 */

/**
 * Convierte una dirección IPv4 en notación decimal a su representación
 * como entero de 32 bits sin signo. Lanza si la IP es inválida.
 */
export function ipToInt(ip: string): number {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    throw new Error(`Invalid IPv4 address: "${ip}"`);
  }
  let result = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      throw new Error(`Invalid IPv4 address: "${ip}"`);
    }
    const n = parseInt(part, 10);
    if (n > 255) {
      throw new Error(`Invalid IPv4 address: "${ip}" — octet ${n} out of range`);
    }
    result = ((result << 8) | n) >>> 0;
  }
  return result;
}

/**
 * Convierte un entero de 32 bits de vuelta a notación decimal punteada.
 */
export function intToIp(n: number): string {
  const m = n >>> 0;
  return [
    (m >>> 24) & 0xff,
    (m >>> 16) & 0xff,
    (m >>> 8) & 0xff,
    m & 0xff,
  ].join('.');
}

/**
 * Dado un prefijo CIDR (0-32), retorna la máscara de subred como entero.
 * /24 → 0xFFFFFF00
 */
export function prefixToMask(prefix: number): number {
  if (prefix < 0 || prefix > 32) {
    throw new Error(`Invalid prefix length: ${prefix}`);
  }
  if (prefix === 0) return 0;
  return (0xffffffff << (32 - prefix)) >>> 0;
}

/**
 * Dado un entero de máscara, retorna el prefijo CIDR.
 * Lanza si la máscara no es contigua (e.g. 255.0.255.0).
 */
export function maskToPrefix(mask: number): number {
  const m = mask >>> 0;
  let prefix = 0;
  let seenZero = false;
  for (let i = 31; i >= 0; i--) {
    const bit = (m >>> i) & 1;
    if (bit === 1) {
      if (seenZero) {
        throw new Error(`Non-contiguous subnet mask: ${intToIp(m)}`);
      }
      prefix++;
    } else {
      seenZero = true;
    }
  }
  return prefix;
}

/**
 * Resultado completo del cálculo de una subred IPv4.
 */
export interface SubnetInfo {
  networkAddress: string;      // Ej: "192.168.1.0"
  broadcastAddress: string;    // Ej: "192.168.1.255"
  firstHost: string;           // Ej: "192.168.1.1"
  lastHost: string;            // Ej: "192.168.1.254"
  subnetMask: string;          // Ej: "255.255.255.0"
  wildcardMask: string;        // Ej: "0.0.0.255"
  prefix: number;              // Ej: 24
  totalHosts: number;          // 2^(32-prefix)
  usableHosts: number;         // totalHosts-2, excepto /31=2 y /32=1 (RFC 3021)
  ipClass: 'A' | 'B' | 'C' | 'D' | 'E' | 'Loopback' | 'Private' | 'Link-Local';
  isPrivate: boolean;          // RFC 1918
  isCidrNotation: boolean;     // true siempre
  binaryNetworkAddress: string;  // 32 chars
  binarySubnetMask: string;
}

function toBinary32(n: number): string {
  return (n >>> 0).toString(2).padStart(32, '0');
}

function classifyIp(ipInt: number): { ipClass: SubnetInfo['ipClass']; isPrivate: boolean } {
  const m = ipInt >>> 0;
  const b0 = m >>> 24; // first octet, always 0-255

  // Loopback 127.0.0.0/8
  if (b0 === 127) return { ipClass: 'Loopback', isPrivate: false };

  // RFC 1918 — private ranges
  if ((m & 0xff000000) >>> 0 === 0x0a000000) return { ipClass: 'Private', isPrivate: true };  // 10/8
  if ((m & 0xfff00000) >>> 0 === 0xac100000) return { ipClass: 'Private', isPrivate: true };  // 172.16/12
  if ((m & 0xffff0000) >>> 0 === 0xc0a80000) return { ipClass: 'Private', isPrivate: true };  // 192.168/16

  // Link-Local 169.254.0.0/16
  if ((m & 0xffff0000) >>> 0 === 0xa9fe0000) return { ipClass: 'Link-Local', isPrivate: false };

  // Class D — multicast 224.0.0.0/4
  if ((m & 0xf0000000) >>> 0 === 0xe0000000) return { ipClass: 'D', isPrivate: false };

  // Class E — reserved 240.0.0.0/4
  if ((m & 0xf0000000) >>> 0 === 0xf0000000) return { ipClass: 'E', isPrivate: false };

  if (b0 >= 1 && b0 <= 126) return { ipClass: 'A', isPrivate: false };
  if (b0 >= 128 && b0 <= 191) return { ipClass: 'B', isPrivate: false };
  if (b0 >= 192 && b0 <= 223) return { ipClass: 'C', isPrivate: false };

  // 0.x.x.x (this-network) or anything unclassified
  return { ipClass: 'A', isPrivate: false };
}

function calculateSubnetCore(ipInt: number, prefix: number): SubnetInfo {
  const mask = prefixToMask(prefix);
  const networkInt = (ipInt & mask) >>> 0;
  const wildcardInt = (~mask) >>> 0;
  const broadcastInt = (networkInt | wildcardInt) >>> 0;

  // 2^32 = 4294967296, safe as JS float
  const totalHosts = prefix === 0 ? 4294967296 : Math.pow(2, 32 - prefix);

  let usableHosts: number;
  if (prefix === 32) usableHosts = 1;       // host route
  else if (prefix === 31) usableHosts = 2;  // RFC 3021 point-to-point
  else usableHosts = totalHosts - 2;

  // /31 and /32: both endpoints are usable — no "reserved" network/broadcast
  const firstHostInt = prefix >= 31 ? networkInt : (networkInt + 1) >>> 0;
  const lastHostInt = prefix >= 31 ? broadcastInt : (broadcastInt - 1) >>> 0;

  const { ipClass, isPrivate } = classifyIp(networkInt);

  return {
    networkAddress: intToIp(networkInt),
    broadcastAddress: intToIp(broadcastInt),
    firstHost: intToIp(firstHostInt),
    lastHost: intToIp(lastHostInt),
    subnetMask: intToIp(mask),
    wildcardMask: intToIp(wildcardInt),
    prefix,
    totalHosts,
    usableHosts,
    ipClass,
    isPrivate,
    isCidrNotation: true,
    binaryNetworkAddress: toBinary32(networkInt),
    binarySubnetMask: toBinary32(mask),
  };
}

/**
 * Función principal: dado un CIDR como "192.168.1.0/24", retorna el SubnetInfo completo.
 * Si la IP de entrada no es la de red, se normaliza automáticamente.
 */
export function calculateSubnet(cidr: string): SubnetInfo {
  const slashIdx = cidr.lastIndexOf('/');
  if (slashIdx === -1) throw new Error(`Invalid CIDR notation: "${cidr}"`);
  const ipPart = cidr.slice(0, slashIdx);
  const prefixStr = cidr.slice(slashIdx + 1);
  const prefix = parseInt(prefixStr, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`Invalid prefix: "${prefixStr}"`);
  }
  return calculateSubnetCore(ipToInt(ipPart), prefix);
}

/**
 * Dado una IP y máscara en notación decimal, retorna el SubnetInfo completo.
 */
export function calculateSubnetFromMask(ip: string, mask: string): SubnetInfo {
  const prefix = maskToPrefix(ipToInt(mask));
  return calculateSubnetCore(ipToInt(ip), prefix);
}

/**
 * Dado un bloque CIDR, retorna si una IP dada pertenece a él.
 */
export function ipInSubnet(ip: string, cidr: string): boolean {
  const ipInt = ipToInt(ip);
  const info = calculateSubnet(cidr);
  const networkInt = ipToInt(info.networkAddress);
  const broadcastInt = ipToInt(info.broadcastAddress);
  // All values are unsigned JS numbers (0–4294967295), so >= / <= is correct
  return ipInt >= networkInt && ipInt <= broadcastInt;
}

/**
 * Retorna true si dos bloques CIDR se solapan.
 */
export function subnetsOverlap(cidr1: string, cidr2: string): boolean {
  const a = calculateSubnet(cidr1);
  const b = calculateSubnet(cidr2);
  const aNet = ipToInt(a.networkAddress);
  const aBcast = ipToInt(a.broadcastAddress);
  const bNet = ipToInt(b.networkAddress);
  const bBcast = ipToInt(b.broadcastAddress);
  return aNet <= bBcast && bNet <= aBcast;
}

/**
 * Divide un bloque CIDR en N subredes iguales del siguiente prefijo disponible.
 * Ej: subnetDivide("192.168.0.0/24", 4) → 4 bloques /26
 */
export function subnetDivide(cidr: string, count: number): SubnetInfo[] {
  if (count < 1) throw new Error(`count must be >= 1, got ${count}`);

  const slashIdx = cidr.lastIndexOf('/');
  if (slashIdx === -1) throw new Error(`Invalid CIDR notation: "${cidr}"`);
  const ipPart = cidr.slice(0, slashIdx);
  const parentPrefix = parseInt(cidr.slice(slashIdx + 1), 10);
  const parentMask = prefixToMask(parentPrefix);
  const parentNetworkInt = (ipToInt(ipPart) & parentMask) >>> 0;

  // Minimum bits needed to accommodate `count` equal subnets
  const bitsNeeded = count <= 1 ? 0 : Math.ceil(Math.log2(count));
  const newPrefix = parentPrefix + bitsNeeded;
  if (newPrefix > 32) {
    throw new Error(
      `Cannot divide /${parentPrefix} into ${count} subnets: insufficient address space`
    );
  }

  const subnetSize = newPrefix === 32 ? 1 : Math.pow(2, 32 - newPrefix);
  const result: SubnetInfo[] = [];

  for (let i = 0; i < count; i++) {
    const networkInt = (parentNetworkInt + i * subnetSize) >>> 0;
    result.push(calculateSubnetCore(networkInt, newPrefix));
  }

  return result;
}
