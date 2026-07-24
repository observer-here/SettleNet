import type { Address } from "viem";
import {
  settleNetAbi,
  evaluatorStakeAbi,
  providerBondAbi,
  erc20Abi,
  identityRegistryAbi,
} from "@/abi";

function addr(key: string): Address {
  const v = import.meta.env[key] as string | undefined;
  if (!v) throw new Error(`Missing ${key}`);
  return v as Address;
}

export const USDC_DECIMALS = 6;
export const BOND_BP = 2000;
export const EVALUATOR_FEE_BP = 500;
export const CANCEL_FEE_BP = 100;
export const RESOLVE_WINDOW_SEC = 7 * 86400;

export const addresses = {
  usdc: (import.meta.env.VITE_USDC_ADDRESS ||
    "0x3600000000000000000000000000000000000000") as Address,
  identity: (import.meta.env.VITE_IDENTITY_ADDRESS ||
    "0x8004A818BFB912233c491871b3d84c89A494BD9e") as Address,
  settleNet: addr("VITE_SETTLENET_ADDRESS"),
  evaluatorStake: addr("VITE_EVALUATOR_STAKE_ADDRESS"),
  providerBond: addr("VITE_PROVIDER_BOND_ADDRESS"),
};

export const contracts = {
  settleNet: { address: addresses.settleNet, abi: settleNetAbi },
  evaluatorStake: { address: addresses.evaluatorStake, abi: evaluatorStakeAbi },
  providerBond: { address: addresses.providerBond, abi: providerBondAbi },
  usdc: { address: addresses.usdc, abi: erc20Abi },
  identity: { address: addresses.identity, abi: identityRegistryAbi },
} as const;
