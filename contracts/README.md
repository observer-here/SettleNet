# SettleNet Contracts

Hardhat project for SettleNet on **Arc Testnet** (chainId `5042002`): USDC job escrow, provider bonds, and ERC-8004 agent stake/ratings.

## Contracts

| Contract | Path | Role |
|----------|------|------|
| **SettleNet** | `contracts/SettleNet.sol` | Job lifecycle, escrow, fees, refunds |
| **ProviderBond** | `contracts/bonds/ProviderBond.sol` | Locks ~20% provider bond per claimed job |
| **EvaluatorStake** | `contracts/bonds/EvaluatorStake.sol` | Agent stake, coverage, ratings, slash |
| Interfaces | `contracts/interfaces/` | IERC20, IERC8004, IBonds |
| Mocks | `contracts/mocks/` | Local test doubles only |

### Arc Testnet singletons (used in deploy)

- USDC: `0x3600000000000000000000000000000000000000`
- Identity registry: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- Reputation registry: `0x8004B663056A597Dffe9eCcC1965A193B7388713`

Deployed addresses are written under `deployments/arcTestnet/`.

## Setup

```bash
cd contracts
npm install
cp .env.example .env
```

Edit `.env`:

```env
ARC_RPC_URL=https://rpc.testnet.arc.network
PRIVATE_KEY=your_private_key_here
```

- `PRIVATE_KEY` — deployer key, **64 hex chars, no `0x`**
- `ARC_RPC_URL` — optional; defaults to the public Arc Testnet RPC

Fund the deployer with Arc Testnet gas (and USDC if you interact on-chain after deploy).

## Commands

```bash
# Compile Solidity
npm run compile

# Run tests (local Hardhat network)
npm test

# Deploy to Arc Testnet
npm run deploy
```

Equivalent:

```bash
npx hardhat compile
npx hardhat test
npx hardhat deploy --network arcTestnet
```

## Protocol parameters (deploy)

From `deploy/SettleNetDeploy.ts`:

| Param | Value | Meaning |
|-------|-------|---------|
| Provider bond | 20% (`BOND_BP = 2000`) | Locked when provider claims |
| Evaluator fee | 5% (`EVALUATOR_FEE_BP = 500`) | Agent owner share on complete |
| Cancel fee (Open) | 1% | Paid to agent owner on client cancel |
| Min stake | 10 USDC | Minimum agent stake |
| Stake coverage | 150% | Free stake must cover job budget × 1.5 |
| Score floor | 4.0 / 10 | Slash if avg ≤ floor after enough ratings |
| Min ratings | 5 | Slash only after ≥ 5 rated jobs |
| Rating / resolve window | 7 days | Stake lock after resolve; ghost refund after submit |

**Slash treasury:** set to the **deployer** address at deploy (`immutable`). Slashed USDC goes to treasury; leftover free stake returns to the agent NFT owner.

## Job lifecycle

```
Posted → AgentPending → Open → Claimed → Submitted → Completed | Rejected
                ↘ Cancelled / Expired (refund paths)
```

Main entrypoints on `SettleNet`:

1. `createJob` — client escrows budget  
2. `applyAsAgent` / `approveAgent` / `rejectAgent`  
3. `claimJob` — provider locks bond  
4. `submit` — provider delivers work  
5. `complete` / `reject` — agent owner resolves (within 7 days)  
6. `claimRefund` — expiry / ghost path after resolve window  
7. `rateEvaluator` — client rates agent (0–10)  
8. `cancelJob` — client cancel (Posted / AgentPending / Open)

## Tests

File: `tests/SettleNet.ts`

```bash
npm test
```

Current suite (**11 tests**):

| Test | What it checks |
|------|----------------|
| Happy path | apply → approve → claim → submit → complete → rate |
| Reject | Client refund + agent fee from bond |
| Cancel Posted | Full budget back to client |
| Cancel Open | 1% to agent, rest to client |
| rejectAgent | Unlocks stake, job back to Posted |
| Multi-applicant approve | Correct agent selected; other unlocked |
| Understake | Second apply reverts when coverage insufficient |
| Ghost refund | After 7d resolve window: 80% client / 20% provider |
| Claimed expiry refund | Budget + 70% bond → client; 30% bond → agent |
| Resolve window + ACL | `complete` after 7d reverts; client/agent cannot claim |
| bondRequired | Provider bond = 20% of budget |

Tests use mocks (`MockERC20`, `MockIdentity`, `MockReputation`) on the Hardhat network — no Arc RPC required.

## Project layout

```
contracts/
├── contracts/           # Solidity sources
│   ├── SettleNet.sol
│   ├── bonds/
│   ├── interfaces/
│   └── mocks/
├── deploy/              # hardhat-deploy scripts
├── deployments/         # network deployment artifacts
├── tests/               # Mocha + Chai + ethers tests
├── hardhat.config.ts
├── .env.example
└── package.json
```

## Notes

- Solidity `0.8.24`, optimizer enabled (200 runs).
- `SettleNet` / stake use a simple reentrancy `lock` modifier.
- After deploy, wire web app addresses from `deployments/arcTestnet/*.json` into `web` config if needed.
- Never commit `.env` or real private keys; keep secrets in `.env` only.
