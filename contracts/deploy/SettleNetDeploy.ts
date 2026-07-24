import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

// Arc Testnet native singletons
const USDC = "0x3600000000000000000000000000000000000000";
const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713";

const BOND_BP = 2000; // provider bond = 20% of budget
const EVALUATOR_FEE_BP = 500; // evaluator earns 5% on completion
const MIN_STAKE = 10_000_000n; // 10 USDC (6 decimals)
const MAX_JOB_WEIGHT = 5_000_000_000n; // 5_000 USDC — max weight any single rating can add
const STAKE_COVERAGE_BP = 15_000; // evaluator stake must be >= 150% of job budget
const SCORE_FLOOR = 4; // slash when average score <= 4.0 / 10 (stored as tenths on-chain)
const MIN_RATINGS = 5; // slash only after ≥ 5 rated jobs (complete/reject/ghost)
const RATING_WINDOW = 7 * 24 * 60 * 60; // stake stays locked 7 days past resolve for rating/slashing

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute } = deployments;
  const { deployer } = await getNamedAccounts();

  const bond = await deploy("ProviderBond", {
    from: deployer,
    args: [USDC, BOND_BP],
    log: true,
  });

  const stake = await deploy("EvaluatorStake", {
    from: deployer,
    args: [
      USDC,
      IDENTITY_REGISTRY,
      REPUTATION_REGISTRY,
      deployer,
      MIN_STAKE,
      MAX_JOB_WEIGHT,
      STAKE_COVERAGE_BP,
      SCORE_FLOOR,
      MIN_RATINGS,
      RATING_WINDOW,
    ],
    log: true,
  });

  const core = await deploy("SettleNet", {
    from: deployer,
    args: [USDC, bond.address, stake.address, EVALUATOR_FEE_BP],
    log: true,
  });

  await execute("ProviderBond", { from: deployer, log: true }, "setCore", core.address);
  await execute("EvaluatorStake", { from: deployer, log: true }, "setCore", core.address);
};

func.tags = ["SettleNet"];
export default func;
