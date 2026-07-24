import type { Abi } from "viem";
import settleNetJson from "./SettleNet.json";
import evaluatorStakeJson from "./EvaluatorStake.json";
import providerBondJson from "./ProviderBond.json";
import erc20Json from "./erc20.json";
import identityRegistryJson from "./IdentityRegistry.json";

export const settleNetAbi = settleNetJson as Abi;
export const evaluatorStakeAbi = evaluatorStakeJson as Abi;
export const providerBondAbi = providerBondJson as Abi;
export const erc20Abi = erc20Json as Abi;
export const identityRegistryAbi = identityRegistryJson as Abi;
