// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IProviderBond {
    function lock(uint256 jobId, address provider, uint256 budget) external returns (uint256 amount);
    function release(uint256 jobId, address to) external returns (uint256 amount);
    function bondRequired(uint256 budget) external view returns (uint256);
}

interface IEvaluatorStake {
    function ratingWindow() external view returns (uint64);
    function agentOwner(uint256 agentId) external view returns (address);
    function maxExpiryDuration(uint256 agentId) external view returns (uint64);
    function maxBudget(uint256 agentId) external view returns (uint256);
    function isActive(uint256 agentId) external view returns (bool);
    function onAssigned(uint256 agentId, uint256 jobId, uint256 budget) external;
    function onResolved(uint256 agentId, uint256 jobId) external;
    function clearJob(uint256 agentId, uint256 jobId) external;
    function applyRating(uint256 agentId, uint16 scoreTenths, uint256 budget) external;
}

interface ISettleNetHook {
    function cancelOpenJobs(uint256 agentId) external returns (uint256[] memory cancelled);
}
