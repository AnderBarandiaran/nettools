# NetTools — Network Engineering Toolkit

[![CI](https://github.com/AnderBarandiaran/nettools/actions/workflows/ci.yml/badge.svg)](https://github.com/AnderBarandiaran/nettools/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

Professional-grade network tools for network engineers. Free, no login required, runs entirely in the browser.

```
┌─────────────────────────────────────────────────────────┐
│  NetTools — Network Engineering Toolkit                  │
│                                                          │
│  🔧 Subnet Calculator     📐 VLSM Planner               │
│  💻 Cisco IOS Generator   🗺  Topology Simulator         │
│  🔢 IP Converter          🎭 Wildcard Mask Calc          │
│  📊 Bandwidth Calculator  🌐 CIDR Summarizer             │
└─────────────────────────────────────────────────────────┘
```

## Live Demo

**[https://nettools.engineer](https://nettools.engineer)**

## Tools Included

| Tool | Description |
|------|-------------|
| **Subnet Calculator** | IPv4 CIDR calculator with wildcard masks, broadcast address, host range, and binary representation |
| **VLSM Planner** | Variable Length Subnet Masking allocator — plan multi-subnet networks optimally |
| **Cisco IOS Script Generator** | Generate interface configs, OSPF, ACLs, VLANs, DHCP, and NAT configurations |
| **Network Topology Simulator** | Drag-and-drop network designer with automatic IP assignment |
| **IP Address Converter** | Convert between decimal, binary, hexadecimal, and 32-bit integer representations |
| **Wildcard Mask Calculator** | Compute wildcard masks for ACLs and OSPF network statements |
| **Bandwidth Calculator** | Calculate throughput, transfer times, and bandwidth requirements |
| **CIDR Route Summarizer** | Aggregate multiple prefixes into a supernet summary route |

## Tech Stack

- **[Astro 4](https://astro.build)** — Static Site Generation with zero-JS-by-default
- **React** — Interactive islands for tool components
- **TypeScript** — End-to-end type safety
- **Tailwind CSS** — Utility-first styling
- **[Cloudflare Pages](https://pages.cloudflare.com)** — Global CDN hosting
- **GitHub Actions** — CI/CD pipeline (build + test on every push)

## Getting Started

```bash
git clone https://github.com/AnderBarandiaran/nettools.git
cd nettools
pnpm install
pnpm dev
```

The dev server starts at `http://localhost:4321`.

## Running Tests

```bash
pnpm test          # Unit tests (127 tests via Vitest)
pnpm test:e2e      # End-to-end tests with Playwright
pnpm build         # Production build
```

## Project Structure

```
nettools/
├── src/
│   ├── lib/network/          # Pure network logic (no UI dependencies)
│   │   ├── ipv4.ts           # IPv4 address manipulation, CIDR math
│   │   ├── vlsm.ts           # VLSM allocation algorithm
│   │   └── cisco.ts          # Cisco IOS config generation
│   ├── components/
│   │   ├── islands/          # React interactive components (client-side)
│   │   ├── layout/           # Astro layout components
│   │   └── ads/              # Ad slot components
│   ├── content/articles/     # MDX articles for SEO
│   └── pages/                # Astro file-based routes
│       ├── subnetting/       # Subnet calculator & VLSM planner
│       ├── cisco-scripts/    # IOS script generator
│       └── topology/         # Network topology simulator
├── tests/
│   ├── unit/                 # Vitest unit tests for network logic
│   └── e2e/                  # Playwright end-to-end tests
└── public/                   # Static assets
```

The network logic in `src/lib/network/` is framework-agnostic and thoroughly tested — it can be used independently of the UI.

## Contributing

Pull requests are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-tool`)
3. Run tests before submitting (`pnpm test && pnpm build`)
4. Open a pull request describing what you added

For major changes, please open an issue first to discuss the direction.

## License

GPL v3 — see [LICENSE](LICENSE) file.

Copyright (C) 2024 Ander Barandiaran
