export enum JobStatus {
  Posted = 0,
  AgentPending = 1,
  Open = 2,
  Claimed = 3,
  Submitted = 4,
  Completed = 5,
  Rejected = 6,
  Expired = 7,
  Cancelled = 8,
}

export type Job = {
  id: bigint;
  client: `0x${string}`;
  provider: `0x${string}`;
  agentId: bigint;
  budget: bigint;
  expiredAt: bigint;
  submittedAt: bigint;
  resolvedAt: bigint;
  status: JobStatus;
  title: string;
  description: string;
  submission: string;
};

export const STATUS_LABEL: Record<JobStatus, string> = {
  [JobStatus.Posted]: "Posted",
  [JobStatus.AgentPending]: "Agent Pending",
  [JobStatus.Open]: "Open",
  [JobStatus.Claimed]: "Claimed",
  [JobStatus.Submitted]: "Submitted",
  [JobStatus.Completed]: "Completed",
  [JobStatus.Rejected]: "Rejected",
  [JobStatus.Expired]: "Expired",
  [JobStatus.Cancelled]: "Cancelled",
};

export const EMPTY_STATUS_COUNTS: Record<JobStatus, number> = {
  [JobStatus.Posted]: 0,
  [JobStatus.AgentPending]: 0,
  [JobStatus.Open]: 0,
  [JobStatus.Claimed]: 0,
  [JobStatus.Submitted]: 0,
  [JobStatus.Completed]: 0,
  [JobStatus.Rejected]: 0,
  [JobStatus.Expired]: 0,
  [JobStatus.Cancelled]: 0,
};
