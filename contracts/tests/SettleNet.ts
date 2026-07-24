import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import type { Signer } from "ethers";

const USDC = (n: number) => BigInt(n) * 1_000_000n;
const DAY = 24 * 60 * 60;

enum Status {
  Posted,
  AgentPending,
  Open,
  Claimed,
  Submitted,
  Completed,
  Rejected,
  Expired,
  Cancelled,
}

async function deployProtocol() {
  const [deployer, client, agent, provider, other] = await ethers.getSigners();

  const usdc = await (await ethers.getContractFactory("MockERC20")).deploy();
  const identity = await (await ethers.getContractFactory("MockIdentity")).deploy();
  const reputation = await (await ethers.getContractFactory("MockReputation")).deploy();

  const bond = await (await ethers.getContractFactory("ProviderBond")).deploy(await usdc.getAddress(), 2000);
  const stake = await (
    await ethers.getContractFactory("EvaluatorStake")
  ).deploy(
    await usdc.getAddress(),
    await identity.getAddress(),
    await reputation.getAddress(),
    deployer.address,
    USDC(10),
    USDC(5000),
    15_000,
    4,
    5,
    7 * DAY,
  );
  const core = await (
    await ethers.getContractFactory("SettleNet")
  ).deploy(await usdc.getAddress(), await bond.getAddress(), await stake.getAddress(), 500);

  await bond.setCore(await core.getAddress());
  await stake.setCore(await core.getAddress());

  for (const s of [client, agent, provider, other]) {
    await usdc.mint(s.address, USDC(100_000));
    await usdc.connect(s).approve(await core.getAddress(), ethers.MaxUint256);
    await usdc.connect(s).approve(await bond.getAddress(), ethers.MaxUint256);
    await usdc.connect(s).approve(await stake.getAddress(), ethers.MaxUint256);
  }

  const agentId = 1n;
  await identity.mint(agentId, agent.address);
  await stake.connect(agent).stake(agentId, USDC(300));
  await stake.connect(agent).setMaxExpiryDuration(agentId, 30 * DAY);
  await stake.connect(agent).setMaxBudget(agentId, USDC(1000));

  return { deployer, client, agent, provider, other, usdc, identity, bond, stake, core, agentId };
}

async function expiryIn(seconds: number) {
  return BigInt((await time.latest()) + seconds);
}

async function openJob(core: any, client: Signer, agent: Signer, agentId: bigint, budget = USDC(100)) {
  const expiredAt = await expiryIn(2 * DAY);
  await core.connect(client).createJob(expiredAt, budget, "title", "desc");
  const jobId = await core.jobCount();
  await core.connect(agent).applyAsAgent(jobId, agentId);
  await core.connect(client).approveAgent(jobId, agentId);
  return jobId;
}

async function bondOf(core: any, jobId: bigint) {
  const bond = await ethers.getContractAt("ProviderBond", await core.providerBond());
  return bond.bondOf(jobId);
}

describe("SettleNet", () => {
  it("happy path: apply → approve → claim → submit → complete → rate", async () => {
    const { client, agent, provider, usdc, core, agentId, stake } = await deployProtocol();
    const budget = USDC(100);
    const jobId = await openJob(core, client, agent, agentId, budget);

    const providerBefore = await usdc.balanceOf(provider.address);
    const agentBefore = await usdc.balanceOf(agent.address);

    await core.connect(provider).claimJob(jobId);
    expect((await core.jobs(jobId)).status).to.equal(Status.Claimed);
    expect(await bondOf(core, jobId)).to.equal(USDC(20));

    await core.connect(provider).submit(jobId, "work");
    await core.connect(agent).complete(jobId);

    expect((await core.jobs(jobId)).status).to.equal(Status.Completed);
    expect(await usdc.balanceOf(provider.address)).to.equal(providerBefore + USDC(95));
    expect(await usdc.balanceOf(agent.address)).to.equal(agentBefore + USDC(5));

    await core.connect(client).rateEvaluator(jobId, 8);
    expect(await stake.scoreOf(agentId)).to.equal(80n);
  });

  it("reject refunds client and pays agent fee from bond", async () => {
    const { client, agent, provider, usdc, core, agentId } = await deployProtocol();
    const jobId = await openJob(core, client, agent, agentId);
    const clientBefore = await usdc.balanceOf(client.address);
    const agentBefore = await usdc.balanceOf(agent.address);

    await core.connect(provider).claimJob(jobId);
    await core.connect(provider).submit(jobId, "bad");
    await core.connect(agent).reject(jobId);

    expect((await core.jobs(jobId)).status).to.equal(Status.Rejected);
    expect(await usdc.balanceOf(client.address)).to.equal(clientBefore + USDC(100) + USDC(15));
    expect(await usdc.balanceOf(agent.address)).to.equal(agentBefore + USDC(5));
  });

  it("cancel Posted returns full budget", async () => {
    const { client, usdc, core } = await deployProtocol();
    const before = await usdc.balanceOf(client.address);
    await core.connect(client).createJob(await expiryIn(2 * DAY), USDC(50), "x", "desc");
    const jobId = await core.jobCount();
    await core.connect(client).cancelJob(jobId);
    expect((await core.jobs(jobId)).status).to.equal(Status.Cancelled);
    expect(await usdc.balanceOf(client.address)).to.equal(before);
  });

  it("cancel Open pays 1% to agent", async () => {
    const { client, agent, usdc, core, agentId } = await deployProtocol();
    const jobId = await openJob(core, client, agent, agentId, USDC(100));
    const clientBefore = await usdc.balanceOf(client.address);
    const agentBefore = await usdc.balanceOf(agent.address);
    await core.connect(client).cancelJob(jobId);
    expect(await usdc.balanceOf(client.address)).to.equal(clientBefore + USDC(99));
    expect(await usdc.balanceOf(agent.address)).to.equal(agentBefore + USDC(1));
  });

  it("rejectAgent unlocks and returns job to Posted", async () => {
    const { client, agent, core, agentId, stake } = await deployProtocol();
    await core.connect(client).createJob(await expiryIn(2 * DAY), USDC(100), "x", "desc");
    const jobId = await core.jobCount();
    await core.connect(agent).applyAsAgent(jobId, agentId);
    expect((await core.jobs(jobId)).status).to.equal(Status.AgentPending);
    await core.connect(client).rejectAgent(jobId, agentId);
    expect((await core.jobs(jobId)).status).to.equal(Status.Posted);
    expect((await core.jobs(jobId)).agentId).to.equal(0n);
    expect(await stake.snapshotOf(agentId, jobId)).to.equal(0n);
  });

  it("approveAgent picks one applicant among many", async () => {
    const { client, agent, other, identity, stake, core, agentId } = await deployProtocol();
    const agentId2 = 2n;
    await identity.mint(agentId2, other.address);
    await stake.connect(other).stake(agentId2, USDC(300));
    await stake.connect(other).setMaxExpiryDuration(agentId2, 30 * DAY);
    await stake.connect(other).setMaxBudget(agentId2, USDC(1000));

    await core.connect(client).createJob(await expiryIn(2 * DAY), USDC(100), "x", "desc");
    const jobId = await core.jobCount();
    await core.connect(agent).applyAsAgent(jobId, agentId);
    await core.connect(other).applyAsAgent(jobId, agentId2);
    await core.connect(client).approveAgent(jobId, agentId2);

    expect((await core.jobs(jobId)).status).to.equal(Status.Open);
    expect((await core.jobs(jobId)).agentId).to.equal(agentId2);
    expect(await stake.snapshotOf(agentId, jobId)).to.equal(0n);
    expect(await stake.snapshotOf(agentId2, jobId)).to.equal(USDC(150));
  });

  it("blocks apply when free stake < 150% coverage", async () => {
    const { client, agent, core, agentId, stake } = await deployProtocol();
    const expiredAt = await expiryIn(2 * DAY);
    await core.connect(client).createJob(expiredAt, USDC(200), "a", "desc");
    const a = await core.jobCount();
    await core.connect(agent).applyAsAgent(a, agentId);
    await core.connect(client).createJob(expiredAt, USDC(200), "b", "desc");
    const b = await core.jobCount();
    await expect(core.connect(agent).applyAsAgent(b, agentId)).to.be.revertedWithCustomError(stake, "Understaked");
  });

  it("ghost path after resolve window", async () => {
    const { client, agent, provider, usdc, core, agentId } = await deployProtocol();
    const jobId = await openJob(core, client, agent, agentId);
    const clientBefore = await usdc.balanceOf(client.address);
    const providerBefore = await usdc.balanceOf(provider.address);

    await core.connect(provider).claimJob(jobId);
    await core.connect(provider).submit(jobId, "work");
    await time.increase(7 * DAY + 1);
    await core.claimRefund(jobId);

    expect((await core.jobs(jobId)).status).to.equal(Status.Expired);
    expect(await usdc.balanceOf(client.address)).to.equal(clientBefore + USDC(80));
    expect(await usdc.balanceOf(provider.address)).to.equal(providerBefore + USDC(20));
  });

  it("claimRefund on Claimed: client budget + 70% bond, agent 30% bond", async () => {
    const { client, agent, provider, usdc, core, agentId } = await deployProtocol();
    const jobId = await openJob(core, client, agent, agentId);
    await core.connect(provider).claimJob(jobId);

    const clientBefore = await usdc.balanceOf(client.address);
    const agentBefore = await usdc.balanceOf(agent.address);
    await time.increase(2 * DAY + 1);
    await core.claimRefund(jobId);

    expect((await core.jobs(jobId)).status).to.equal(Status.Expired);
    expect(await usdc.balanceOf(client.address)).to.equal(clientBefore + USDC(100) + USDC(14));
    expect(await usdc.balanceOf(agent.address)).to.equal(agentBefore + USDC(6));
  });

  it("complete after resolve window reverts; client/agent cannot claim", async () => {
    const { client, agent, provider, core, agentId } = await deployProtocol();
    const jobId = await openJob(core, client, agent, agentId);

    await expect(core.connect(client).claimJob(jobId)).to.be.revertedWithCustomError(core, "NotAuthorized");
    await expect(core.connect(agent).claimJob(jobId)).to.be.revertedWithCustomError(core, "NotAuthorized");

    await core.connect(provider).claimJob(jobId);
    await core.connect(provider).submit(jobId, "work");
    await time.increase(7 * DAY + 1);
    await expect(core.connect(agent).complete(jobId)).to.be.revertedWithCustomError(core, "ResolveWindowClosed");
  });

  it("ProviderBond bondRequired is 20%", async () => {
    const { bond } = await deployProtocol();
    expect(await bond.bondRequired(USDC(100))).to.equal(USDC(20));
  });
});
