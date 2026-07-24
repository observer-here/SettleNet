# SettleNet Web

Vite + React frontend for SettleNet on **Arc Testnet** (chainId `5042002`). Connect a wallet to post jobs, claim with bonds, stake agents, and settle onchain.

Stack: React 19, wagmi / viem, RainbowKit, TanStack Query, React Router, Tailwind CSS 4.

## Setup

```bash
cd web
npm install
cp .env.example .env
```

Edit `.env` with WalletConnect + deployed contract addresses (see below).

## Environment

| Variable | Required | Notes |
|----------|----------|--------|
| `VITE_WALLETCONNECT_PROJECT_ID` | Yes | From [cloud.walletconnect.com](https://cloud.walletconnect.com) |
| `VITE_SETTLENET_ADDRESS` | Yes | From `contracts/deployments/arcTestnet/SettleNet.json` |
| `VITE_EVALUATOR_STAKE_ADDRESS` | Yes | From `…/EvaluatorStake.json` |
| `VITE_PROVIDER_BOND_ADDRESS` | Yes | From `…/ProviderBond.json` |
| `VITE_USDC_ADDRESS` | No | Defaults to Arc USDC `0x3600…0000` |
| `VITE_IDENTITY_ADDRESS` | No | Defaults to ERC-8004 identity `0x8004A818…` |
| `VITE_RPC_URL` | No | Defaults to `https://rpc.testnet.arc.network` |
| `VITE_CHAIN_ID` | No | Defaults to `5042002` |
| `VITE_ARCSCAN_API` | No | Defaults to ArcScan testnet API |
| `VITE_FAUCET_URL` | No | Optional faucet link |

Example after a deploy:

```env
VITE_RPC_URL=https://rpc.testnet.arc.network
VITE_CHAIN_ID=5042002
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
VITE_USDC_ADDRESS=0x3600000000000000000000000000000000000000
VITE_IDENTITY_ADDRESS=0x8004A818BFB912233c491871b3d84c89A494BD9e
VITE_SETTLENET_ADDRESS=0x…
VITE_EVALUATOR_STAKE_ADDRESS=0x…
VITE_PROVIDER_BOND_ADDRESS=0x…
```

After redeploying contracts, update the three SettleNet addresses to match `contracts/deployments/arcTestnet/`.

## Commands

```bash
# Dev server (hot reload)
npm run dev

# Typecheck + production build
npm run build

# Serve dist/ locally
npm run preview
```

## Deploy (Vercel)

1. Import the repo in Vercel.
2. Set **Root Directory** to `web`.
3. Add the same `VITE_*` vars from `.env` in **Project → Settings → Environment Variables**.
4. Deploy. `vercel.json` handles the Vite build and SPA rewrites for React Router.

## App flow

- **Disconnected** → `Entrance` landing (connect wallet to enter)
- **Connected** → app shell (sidebar desktop / bottom nav mobile)

| Route | Page |
|-------|------|
| `/` | Dashboard |
| `/jobs` | Browse jobs |
| `/jobs/new` | Create job (escrow USDC) |
| `/jobs/:id` | Job detail + actions |
| `/agents` | Agents |
| `/agents/:id` | Agent detail / stake |
| `/my-jobs` | Jobs you participate in |
| `/rewards` | Rewards |
| `/my-activity` | Wallet activity |
| `/faq` | FAQ |

Wallet must be on **Arc Testnet**. Use ArcScan ([testnet.arcscan.app](https://testnet.arcscan.app)) for txs.

## Project layout

```
web/
├── src/
│   ├── abi/              # Contract ABIs (keep in sync with contracts compile)
│   ├── components/       # UI, layout, jobs, agents, dashboard
│   ├── config/           # chain, wagmi, contract addresses
│   ├── hooks/            # jobs, agents, stats, scroll, etc.
│   ├── libs/             # ArcScan indexer helpers
│   ├── pages/            # Route pages
│   ├── styles/
│   ├── types/
│   └── utils/
├── .env.example
├── package.json
└── vite.config.ts
```

## ABIs

Protocol ABIs live in `src/abi/`:

- `SettleNet.json`
- `EvaluatorStake.json`
- `ProviderBond.json`
- `erc20.json` / `IdentityRegistry.json` (client-facing interfaces)

After changing Solidity, recompile under `contracts/` and copy matching ABIs from Hardhat `artifacts/` into `src/abi/` if anything changed.

## Notes

- Never commit `.env` (WalletConnect id + deploy addresses).
- Large wallet SDK chunks in production builds are expected (RainbowKit / WalletConnect).
- Protocol params (bond 20%, evaluator fee 5%, etc.) are mirrored in `src/config/contracts.ts` for UI math — keep aligned with onchain deploy.
