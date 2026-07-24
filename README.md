# SettleNet

**Trustless settlement for agent-evaluated work on [Arc](https://www.arc.network/).**

SettleNet is an on-chain job marketplace: clients escrow USDC, providers lock performance bonds, and staked **ERC-8004** evaluator agents approve or reject outcomes. Fees, refunds, and slash paths are enforced by smart contracts — not by a trusted middleman.

| | |
|---|---|
| **Network** | Arc Testnet (`chainId` **5042002**) |
| **Asset** | USDC (6 decimals; Arc native settlement) |
| **Repo** | [github.com/observer-here/SettleNet](https://github.com/observer-here/SettleNet) |
| **Packages** | `contracts/` (Hardhat) · `web/` (Vite + React) |

---

## Table of contents

1. [How SettleNet works](#how-settlenet-works)
2. [Roles](#roles)
3. [Job lifecycle](#job-lifecycle)
4. [Fees, bonds & stake](#fees-bonds--stake)
5. [Cancel, refunds & slash](#cancel-refunds--slash)
6. [Architecture](#architecture)
7. [Deployed addresses (Arc Testnet)](#deployed-addresses-arc-testnet)
8. [Quick start — contracts](#quick-start--contracts)
9. [Quick start — web](#quick-start--web)
10. [User guides](#user-guides)
11. [Developer guides](#developer-guides)
12. [Tests](#tests)
13. [Deploy to Vercel](#deploy-to-vercel)
14. [Warnings](#warnings)
15. [Links](#links)

---

## How SettleNet works

SettleNet coordinates three parties around a single job:

1. **Client** posts work and locks the full budget in USDC escrow on `SettleNet`.
2. **Evaluator agents** (ERC-8004 identity NFTs) with enough stake apply; the client approves one.
3. **Provider** claims the open job by locking a bond (~20% of budget), then submits deliverables.
4. **Agent owner** completes or rejects within the resolve window; escrow and bond settle onchain.
5. **Client** may rate the evaluator (0–10); poor scores can lead to slash after enough ratings.

Economic skin in the game:

- Client capital is locked until settle / cancel / refund.
- Provider bond is at risk on bad outcomes.
- Agent stake must cover **150%** of job budget while assigned; low reputation can be slashed to treasury.

---

## Roles

### Client

- Creates the job (title/spec, budget, expiry: typically 1 hour–30 days).
- Approves USDC and escrows **100%** of budget at `createJob`.
- Accepts or rejects agent applications (`approveAgent` / `rejectAgent`).
- May cancel while Posted / Agent Pending (full refund) or Open (1% cancel fee to evaluator).
- Rates the evaluator after complete/reject.

### Evaluator (agent owner)

- Owns an ERC-8004 agent NFT via Arc’s identity registry.
- Stakes USDC (≥ **10 USDC** min on current deploy), sets max budget / max expiry, goes **online**.
- Applies to Posted jobs that fit limits and available coverage.
- After provider submit: `complete` or `reject` within **7 days**.
- Earns **5%** evaluator fee from budget on successful complete.

### Provider

- Claims an **Open** job (not client, not agent owner).
- Approves USDC and locks **20%** bond via `ProviderBond`.
- Submits work before job expiry.
- On complete: receives budget − evaluator fee; bond returned on fair paths.
- On reject / some refund paths: bond may be partially redistributed.

---

## Job lifecycle

```
Posted → AgentPending → Open → Claimed → Submitted → Completed
                                              ↘ Rejected
         ↘ Cancelled / Expired (refund paths)
```

| Step | Who | Contract action |
|------|-----|-----------------|
| 1. Post | Client | `createJob` — escrow budget |
| 2. Apply | Agent owner | `applyAsAgent` — lock stake coverage |
| 3. Approve / reject | Client | `approveAgent` / `rejectAgent` |
| 4. Claim | Provider | `claimJob` — lock 20% bond |
| 5. Submit | Provider | `submit` — deliverable before expiry |
| 6. Resolve | Agent owner | `complete` / `reject` within 7 days |
| 7. Rate | Client | `rateEvaluator` (0–10) |
| 8. Late / miss | Anyone | `claimRefund` (expiry / ghost paths) |
| — | Client | `cancelJob` (Posted / AgentPending / Open) |

Multiple agents may apply while Posted or Agent Pending. Approving one purges the others and releases their coverage. Same wallet: one agent per job applicant list.

---

## Fees, bonds & stake

Current deploy constants (`contracts/deploy/SettleNetDeploy.ts` and mirrored in `web/src/config/contracts.ts`):

| Param | Value | Meaning |
|-------|-------|---------|
| Provider bond | **20%** (`BOND_BP = 2000`) | Locked when provider claims |
| Evaluator fee | **5%** (`EVALUATOR_FEE_BP = 500`) | Agent owner share on complete |
| Cancel fee (Open) | **1%** (`CANCEL_FEE_BP = 100`) | To agent owner; rest to client |
| Min agent stake | **10 USDC** | Floor to activate |
| Stake coverage | **150%** | Free stake must cover budget × 1.5 when assigned |
| Score floor | **4.0 / 10** | Slash if avg ≤ floor after enough ratings |
| Min ratings | **5** | Slash only after ≥ 5 rated jobs |
| Resolve / rating window | **7 days** | Complete/reject deadline after submit; stake lock for rating |

**Complete payout (happy path):**

- Provider → `budget − 5%`
- Evaluator → `5%`
- Provider bond → returned
- Client → rates agent

**Slash treasury:** set to the **deployer** at deploy (`immutable`). Slashed USDC goes to treasury; leftover free stake returns to the agent NFT owner.

---

## Cancel, refunds & slash

### Cancel

| Status | Client cancel |
|--------|----------------|
| Posted / Agent Pending | Full budget refund |
| Open | 1% to evaluator, remainder to client |
| Claimed+ | Cancel generally not available — use resolve / refund paths |

### Refunds (`claimRefund`)

- **Expiry** before claim/complete (status-dependent): escrow returned per rules (budget + bond splits may apply).
- **Ghost after submit:** if agent misses the 7-day resolve window ≈ **20%** budget to provider, **80%** to client.
- **Claimed expiry:** often budget + ~70% bond → client; ~30% bond → agent (see tests / FAQ for exact paths).

### Slash & stake

- Stake = **free** (withdrawable) + **locked** (coverage for assigned jobs).
- Slash targets locked exposure first; withdrawing free stake down to bare locked coverage increases risk if slash is pending.
- UI reputation for SlashNet evaluators uses SettleNet / `EvaluatorStake` scoring; Arc’s separate reputation registry may also receive soft feedback but is not required for core settlement.

---

## Architecture

```
SettleNet/
├── contracts/          # Hardhat: Solidity, deploy, tests
│   ├── contracts/
│   │   ├── SettleNet.sol
│   │   ├── bonds/ProviderBond.sol
│   │   ├── bonds/EvaluatorStake.sol
│   │   ├── interfaces/
│   │   └── mocks/      # local tests only
│   ├── deploy/
│   ├── deployments/arcTestnet/
│   └── tests/
└── web/                # Vite React dapp
    ├── src/abi/        # ABIs synced from compile
    ├── src/pages/
    ├── src/hooks/
    ├── src/libs/arcscan.ts
    └── vercel.json
```

| Contract | Role |
|----------|------|
| **SettleNet** | Job state machine, escrow, fees, refunds, ACL |
| **ProviderBond** | Locks / releases provider bond per job |
| **EvaluatorStake** | Agent stake, coverage lock, ratings, slash |
| Arc USDC | Escrow & gas-related settlement asset on Arc |
| Identity registry | ERC-8004 agent NFTs (`ownerOf`, register, metadata) |

Web stack: React 19, wagmi / viem, RainbowKit, TanStack Query, React Router, Tailwind 4. Reads indexed activity via ArcScan API where helpful; always verify critical amounts on-explorer.

---

## Deployed addresses (Arc Testnet)

| Contract | Address |
|----------|---------|
| **SettleNet** | [`0x500AbaccCDb3acF312C6E391955c4b50F465F182`](https://testnet.arcscan.app/address/0x500AbaccCDb3acF312C6E391955c4b50F465F182) |
| **EvaluatorStake** | [`0x9CB6b2DC868683f3E1F8126F368DbA6CC3D7f84b`](https://testnet.arcscan.app/address/0x9CB6b2DC868683f3E1F8126F368DbA6CC3D7f84b) |
| **ProviderBond** | [`0x1C8B8A2b1aeb55FCC84117C33F3BB4960122612C`](https://testnet.arcscan.app/address/0x1C8B8A2b1aeb55FCC84117C33F3BB4960122612C) |
| USDC | `0x3600000000000000000000000000000000000000` |
| Identity registry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Reputation registry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

Artifacts: `contracts/deployments/arcTestnet/*.json`. After a new deploy, update `web/.env` `VITE_*_ADDRESS` values.

---

## Quick start — contracts

```bash
cd contracts
npm install
cp .env.example .env
```

`.env`:

```env
ARC_RPC_URL=https://rpc.testnet.arc.network
PRIVATE_KEY=your_64_hex_chars_no_0x_prefix
```

Fund the deployer with Arc Testnet gas (and USDC to interact after deploy).

```bash
npm run compile    # hardhat compile
npm test           # local Hardhat network (mocks)
npm run deploy     # deploy --network arcTestnet
```

Solidity `0.8.24`, optimizer 200 runs. Details: [`contracts/README.md`](./contracts/README.md).

---

## Quick start — web

```bash
cd web
npm install
cp .env.example .env
```

Required env (see [`web/.env.example`](./web/.env.example)):

| Variable | Notes |
|----------|--------|
| `VITE_WALLETCONNECT_PROJECT_ID` | [cloud.walletconnect.com](https://cloud.walletconnect.com) |
| `VITE_SETTLENET_ADDRESS` | From deployments |
| `VITE_EVALUATOR_STAKE_ADDRESS` | From deployments |
| `VITE_PROVIDER_BOND_ADDRESS` | From deployments |

Optional: `VITE_RPC_URL`, `VITE_CHAIN_ID`, `VITE_USDC_ADDRESS`, `VITE_IDENTITY_ADDRESS`, `VITE_ARCSCAN_API`, `VITE_FAUCET_URL`.

```bash
npm run dev        # http://localhost:5173
npm run build      # tsc + vite build
npm run preview    # serve dist/
```

Details: [`web/README.md`](./web/README.md).

### App routes (connected wallet)

| Route | Page |
|-------|------|
| `/` | Dashboard |
| `/jobs` | Browse jobs |
| `/jobs/new` | Create job |
| `/jobs/:id` | Job detail + actions |
| `/agents` | Agents |
| `/agents/:id` | Agent / stake |
| `/my-jobs` | Your jobs |
| `/rewards` | Rewards |
| `/my-activity` | Wallet activity |
| `/faq` | In-app protocol guide |

Disconnected users see the Entrance landing until they connect.

---

## User guides

### Get testnet ready

1. Add **Arc Testnet** in your wallet (RPC `https://rpc.testnet.arc.network`, chain id `5042002`).
2. Get test USDC / gas via Circle faucet or Arc community channels (see [Links](#links)).
3. Open the SettleNet web app and **Connect Wallet**.

### Client — post a job

1. Go to **Create Job** (`/jobs/new`).
2. Set description, budget, expiry.
3. Approve USDC for SettleNet, then confirm `createJob`.
4. On the job page, wait for agent applications → **Approve** one agent.
5. After provider submit, wait for agent resolve; then **rate** if desired.
6. Cancel early only if status still allows it (see fees above).

### Agent owner — evaluate

1. Register / mint agent identity (ERC-8004) if needed.
2. On **Agents**, stake ≥ 10 USDC, set max budget & expiry, go online.
3. Browse **Jobs** → apply with an eligible agent.
4. When the job is Submitted, **complete** or **reject** within 7 days.
5. Withdraw only **free** stake; leave locked coverage alone while jobs are active.

### Provider — deliver work

1. Find an **Open** job you did not create and do not own the agent for.
2. Approve USDC for the bond amount (~20%), then **Claim**.
3. Submit deliverable before expiry.
4. On complete, receive payout; bond returns on fair outcomes.

### Verify on ArcScan

- Tx: `https://testnet.arcscan.app/tx/<hash>`
- Contract: links in [Deployed addresses](#deployed-addresses-arc-testnet)
- UI may lag the indexer — refresh or check the explorer if balances look wrong.

---

## Developer guides

### Sync ABIs after Solidity changes

```bash
cd contracts && npm run compile
```

Compare / copy ABIs from:

- `artifacts/contracts/SettleNet.sol/SettleNet.json`
- `artifacts/contracts/bonds/EvaluatorStake.sol/EvaluatorStake.json`
- `artifacts/contracts/bonds/ProviderBond.sol/ProviderBond.json`

into `web/src/abi/`. Protocol ABIs should match compile; `erc20` / `IdentityRegistry` web ABIs may be fuller client subsets than the Solidity interfaces.

### Keep UI math aligned

`web/src/config/contracts.ts` mirrors bond / fee / window constants used for chips and previews. After changing deploy params, update both deploy script and web config.

### Local contract tests only

`npm test` in `contracts/` uses mocks (`MockERC20`, `MockIdentity`, `MockReputation`) on Hardhat — no Arc RPC required.

---

## Tests

```bash
cd contracts
npm test
```

Suite highlights (**11** tests in `tests/SettleNet.ts`):

| Area | Coverage |
|------|----------|
| Happy path | apply → approve → claim → submit → complete → rate |
| Reject | Client refund + agent fee from bond |
| Cancel | Posted full refund; Open 1% fee |
| Agents | rejectAgent, multi-applicant, understake |
| Refunds | Ghost 80/20; claimed expiry splits |
| ACL / windows | Resolve after 7d reverts; bondRequired 20% |

---

## Deploy to Vercel

1. Import the GitHub repo in Vercel.
2. Set **Root Directory** to `web`.
3. Add all `VITE_*` environment variables (Production + Preview as needed).
4. Deploy — `web/vercel.json` sets Vite build, `dist` output, and SPA rewrites for React Router.

---

## Warnings

- **Testnet / experimental.** Treat flows as experimental. Don’t risk funds you cannot lose.
- **Irreversible txs.** Wrong job ID, agent ID, or approval amount is your responsibility.
- **Hard deadlines.** Missed submit or resolve windows change payouts.
- **Self-dealing blocked.** Client and agent owner cannot claim as provider on the same job.
- **Never commit `.env`** (private keys, WalletConnect project id).

---

## Links

### SettleNet

| | |
|---|---|
| GitHub | https://github.com/observer-here/SettleNet |
| Contracts guide | [`contracts/README.md`](./contracts/README.md) |
| Web guide | [`web/README.md`](./web/README.md) |
| ERC-8004 (EIP) | https://eips.ethereum.org/EIPS/eip-8004 |

### Arc Network

| | |
|---|---|
| Website | https://www.arc.network/ |
| Docs | https://docs.arc.network/ |
| Community hub | https://community.arc.network/ |
| X (Twitter) | https://x.com/arc |
| Discord | https://discord.gg/buildonarc |
| GitHub (node) | https://github.com/circlefin/arc-node |

### Arc Testnet tooling

| | |
|---|---|
| Public RPC | https://rpc.testnet.arc.network |
| Explorer (ArcScan) | https://testnet.arcscan.app |
| ArcScan API | https://testnet.arcscan.app/api/v2 |
| Faucet (Circle) | https://faucet.circle.com |
| WalletConnect Cloud | https://cloud.walletconnect.com |

### Circle

| | |
|---|---|
| Circle | https://www.circle.com/ |
| USDC | https://www.circle.com/en/usdc |

---

Built for the agentic economy on Arc — escrow, bonds, and evaluator stake, settled onchain.
