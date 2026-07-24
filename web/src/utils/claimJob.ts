import type { Hash } from "viem";
import { toastTx } from "@/components/ui/Toast";
import { addresses, contracts } from "@/config/contracts";
import { formatUsdc } from "@/utils/format";
import { bondOf } from "@/utils/jobMath";

export async function claimJobWithBond(
  write: (args: any) => Promise<Hash>,
  jobId: bigint,
  budget: bigint,
) {
  const bond = bondOf(budget);
  if (bond > 0n) {
    await toastTx(
      { action: "Approve bond", success: "Bond approved", detail: `${formatUsdc(bond)} USDC` },
      () =>
        write({
          ...contracts.usdc,
          functionName: "approve",
          args: [addresses.providerBond, bond],
        }),
    );
  }
  await toastTx(
    {
      action: "Claiming job…",
      success: "Job claimed",
      detail: `Job #${jobId} · ${formatUsdc(bond)} USDC bond`,
    },
    () =>
      write({
        ...contracts.settleNet,
        functionName: "claimJob",
        args: [jobId],
      }),
  );
  return bond;
}
