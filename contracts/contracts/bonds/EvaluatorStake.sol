// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "../interfaces/IERC20.sol";
import {IIdentityRegistry, IReputationRegistry} from "../interfaces/IERC8004.sol";
import {IEvaluatorStake, ISettleNetHook} from "../interfaces/IBonds.sol";

contract EvaluatorStake is IEvaluatorStake {
    uint64 internal constant IN_FLIGHT = type(uint64).max;
    uint64 internal constant MIN_EXPIRY = 1 hours;
    uint64 internal constant MAX_EXPIRY = 30 days;
    uint8 internal constant BASE_SCORE_TENTHS = 60;
    string internal constant TAG = "settlenet";

    struct Agent {
        uint256 stake;
        uint256 ratingWeight;
        uint256 ratingScore;
        uint32 ratingCount;
        uint64 maxExpiry;
        uint256 maxBudget;
        uint256 pendingSlashAmount;
        bool offline;
        bool pendingSlash;
        bool retired;
    }

    IERC20 public immutable usdc;
    IIdentityRegistry public immutable identity;
    IReputationRegistry public immutable reputation;
    address public immutable treasury;
    address public immutable owner;
    uint256 public immutable minStake;
    uint256 public immutable maxJobWeight;
    uint16 public immutable stakeCoverageBP;
    uint8 public immutable scoreFloor;
    uint32 public immutable minRatings;
    uint64 public immutable ratingWindow;
    address public core;

    mapping(uint256 => Agent) public agents;
    mapping(uint256 => mapping(uint256 => uint256)) public snapshotOf;
    mapping(uint256 => mapping(uint256 => uint64)) public unlockAt;
    mapping(uint256 => uint256[]) private _lockJobs;
    mapping(uint256 => mapping(uint256 => uint256)) private _lockIndex;
    uint256 private _lock = 1;

    event CoreSet(address indexed core);
    event AgentStaked(uint256 indexed agentId, address indexed owner_, uint256 total);
    event Withdrawn(uint256 indexed agentId, address indexed owner_, uint256 amount);
    event OfflineSet(uint256 indexed agentId, bool offline);
    event MaxExpirySet(uint256 indexed agentId, uint64 duration);
    event MaxBudgetSet(uint256 indexed agentId, uint256 budget);
    event PendingSlash(uint256 indexed agentId, uint256 amount);
    event Rated(uint256 indexed agentId, uint16 scoreTenths);
    event Slashed(uint256 indexed agentId, address indexed owner_, uint256 amount);

    error Reentrant();
    error NotCore();
    error NotOwner();
    error CoreAlreadySet();
    error NotOwnerOfAgent();
    error AgentRetired();
    error AlreadyAssigned();
    error BelowMinStake();
    error Understaked();
    error Slashable();
    error StakeLocked();
    error BadScore();
    error BadExpiryDuration();
    error BadMaxBudget();
    error ActiveJobsExist();
    error TransferFailed();
    error ZeroAddress();
    error BadScoreFloor();
    error ZeroMinStake();
    error ZeroRatingWindow();
    error BadAgentId();

    modifier lock() {
        if (_lock == 2) revert Reentrant();
        _lock = 2;
        _;
        _lock = 1;
    }

    modifier onlyCore() {
        if (msg.sender != core) revert NotCore();
        _;
    }

    modifier onlyAgentOwner(uint256 agentId) {
        if (identity.ownerOf(agentId) != msg.sender) revert NotOwnerOfAgent();
        _;
    }

    constructor(
        address usdc_,
        address identity_,
        address reputation_,
        address treasury_,
        uint256 minStake_,
        uint256 maxJobWeight_,
        uint16 stakeCoverageBP_,
        uint8 scoreFloor_,
        uint32 minRatings_,
        uint64 ratingWindow_
    ) {
        if (usdc_ == address(0) || identity_ == address(0) || reputation_ == address(0) || treasury_ == address(0)) {
            revert ZeroAddress();
        }
        if (minStake_ == 0) revert ZeroMinStake();
        if (scoreFloor_ > 10) revert BadScoreFloor();
        if (ratingWindow_ == 0) revert ZeroRatingWindow();
        usdc = IERC20(usdc_);
        identity = IIdentityRegistry(identity_);
        reputation = IReputationRegistry(reputation_);
        treasury = treasury_;
        minStake = minStake_;
        maxJobWeight = maxJobWeight_;
        stakeCoverageBP = stakeCoverageBP_;
        scoreFloor = scoreFloor_;
        minRatings = minRatings_;
        ratingWindow = ratingWindow_;
        owner = msg.sender;
    }

    function setCore(address core_) external {
        if (msg.sender != owner) revert NotOwner();
        if (core != address(0)) revert CoreAlreadySet();
        if (core_ == address(0)) revert ZeroAddress();
        core = core_;
        emit CoreSet(core_);
    }

    function agentOwner(uint256 agentId) public view returns (address) {
        return identity.ownerOf(agentId);
    }

    function maxExpiryDuration(uint256 agentId) external view returns (uint64) {
        return agents[agentId].maxExpiry;
    }

    function maxBudget(uint256 agentId) external view returns (uint256) {
        return agents[agentId].maxBudget;
    }

    function stake(uint256 agentId, uint256 amount) external lock onlyAgentOwner(agentId) {
        if (agentId == 0) revert BadAgentId();
        Agent storage a = agents[agentId];
        if (a.retired) revert AgentRetired();
        uint256 total = a.stake + amount;
        if (total < minStake) revert BelowMinStake();
        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        a.stake = total;
        emit AgentStaked(agentId, msg.sender, total);
    }

    function setOffline(uint256 agentId, bool offline_) external onlyAgentOwner(agentId) {
        agents[agentId].offline = offline_;
        emit OfflineSet(agentId, offline_);
    }

    function setMaxExpiryDuration(uint256 agentId, uint64 duration) external onlyAgentOwner(agentId) {
        if (duration < MIN_EXPIRY || duration > MAX_EXPIRY) revert BadExpiryDuration();
        _requireIdle(agentId);
        agents[agentId].maxExpiry = duration;
        emit MaxExpirySet(agentId, duration);
    }

    function setMaxBudget(uint256 agentId, uint256 budget) external onlyAgentOwner(agentId) {
        if (budget == 0) revert BadMaxBudget();
        _requireIdle(agentId);
        agents[agentId].maxBudget = budget;
        emit MaxBudgetSet(agentId, budget);
    }

    function onAssigned(uint256 agentId, uint256 jobId, uint256 budget) external onlyCore {
        if (_lockIndex[agentId][jobId] != 0) revert AlreadyAssigned();
        uint256 need = (budget * stakeCoverageBP) / 10_000;
        if (need == 0 || agents[agentId].stake < _locked(agentId) + need) revert Understaked();
        snapshotOf[agentId][jobId] = need;
        unlockAt[agentId][jobId] = IN_FLIGHT;
        _lockIndex[agentId][jobId] = _lockJobs[agentId].length + 1;
        _lockJobs[agentId].push(jobId);
    }

    function onResolved(uint256 agentId, uint256 jobId) external onlyCore {
        if (unlockAt[agentId][jobId] == IN_FLIGHT) unlockAt[agentId][jobId] = uint64(block.timestamp) + ratingWindow;
    }

    function clearJob(uint256 agentId, uint256 jobId) external onlyCore lock {
        uint256 idx = _lockIndex[agentId][jobId];
        if (idx != 0) _removeAt(agentId, idx - 1);
        _checkPendingSlash(agentId);
    }

    function withdraw(uint256 agentId, uint256 amount) external lock onlyAgentOwner(agentId) {
        _prune(agentId);
        _checkPendingSlash(agentId);
        Agent storage a = agents[agentId];
        if (_slashable(a)) revert Slashable();
        uint256 locked = _locked(agentId);
        if (a.pendingSlash && a.pendingSlashAmount > locked) locked = a.pendingSlashAmount;
        if (amount > a.stake - locked) revert StakeLocked();
        uint256 remaining = a.stake - amount;
        if (remaining != 0 && remaining < minStake) revert BelowMinStake();
        a.stake = remaining;
        if (!usdc.transfer(msg.sender, amount)) revert TransferFailed();
        emit Withdrawn(agentId, msg.sender, amount);
    }

    function applyRating(uint256 agentId, uint16 scoreTenths, uint256 budget) external onlyCore lock {
        if (scoreTenths > 100) revert BadScore();
        Agent storage a = agents[agentId];
        uint256 effective = budget == 0 ? 1 : budget;
        if (effective > maxJobWeight) effective = maxJobWeight;
        a.ratingWeight += effective;
        a.ratingScore += uint256(scoreTenths) * effective;
        unchecked {
            ++a.ratingCount;
        }
        try reputation.giveFeedback(agentId, int128(uint128(scoreTenths)), 1, TAG, "", "", "", bytes32(0)) {} catch {}
        emit Rated(agentId, scoreTenths);
        if (_slashable(a)) {
            _cancelOpenJobs(agentId);
            _prune(agentId);
            uint256 locked = _locked(agentId);
            if (_lockJobs[agentId].length != 0) {
                if (locked > a.pendingSlashAmount) a.pendingSlashAmount = locked;
                a.pendingSlash = true;
                emit PendingSlash(agentId, a.pendingSlashAmount);
            } else {
                _slash(agentId);
            }
        } else if (a.pendingSlash) {
            a.pendingSlash = false;
            a.pendingSlashAmount = 0;
        }
    }

    function finalizePendingSlash(uint256 agentId) external lock {
        _prune(agentId);
        if (agents[agentId].pendingSlash) _cancelOpenJobs(agentId);
        _checkPendingSlash(agentId);
    }

    function isActive(uint256 agentId) public view returns (bool) {
        Agent storage a = agents[agentId];
        return !a.retired && a.stake >= minStake && !a.offline && !a.pendingSlash && a.maxExpiry != 0
            && a.maxBudget != 0;
    }

    function scoreOf(uint256 agentId) external view returns (uint256) {
        Agent storage a = agents[agentId];
        return a.ratingWeight == 0 ? BASE_SCORE_TENTHS : a.ratingScore / a.ratingWeight;
    }

    function _requireIdle(uint256 agentId) internal {
        _prune(agentId);
        if (_lockJobs[agentId].length != 0) revert ActiveJobsExist();
    }

    function _slashable(Agent storage a) internal view returns (bool) {
        return a.ratingCount >= minRatings && a.ratingWeight != 0
            && a.ratingScore <= uint256(scoreFloor) * 10 * a.ratingWeight;
    }

    function _live(uint64 until) internal view returns (bool) {
        return until == IN_FLIGHT || block.timestamp < until;
    }

    function _locked(uint256 agentId) internal view returns (uint256 locked) {
        uint256[] storage jobs = _lockJobs[agentId];
        for (uint256 i; i < jobs.length;) {
            uint256 jobId = jobs[i];
            if (_live(unlockAt[agentId][jobId])) locked += snapshotOf[agentId][jobId];
            unchecked {
                ++i;
            }
        }
    }

    function _prune(uint256 agentId) internal {
        uint256[] storage jobs = _lockJobs[agentId];
        uint256 i;
        while (i < jobs.length) {
            if (!_live(unlockAt[agentId][jobs[i]])) _removeAt(agentId, i);
            else {
                unchecked {
                    ++i;
                }
            }
        }
    }

    function _removeAt(uint256 agentId, uint256 index) internal {
        uint256[] storage jobs = _lockJobs[agentId];
        uint256 jobId = jobs[index];
        uint256 last = jobs.length - 1;
        if (index != last) {
            uint256 moved = jobs[last];
            jobs[index] = moved;
            _lockIndex[agentId][moved] = index + 1;
        }
        jobs.pop();
        delete _lockIndex[agentId][jobId];
        delete snapshotOf[agentId][jobId];
        delete unlockAt[agentId][jobId];
    }

    function _checkPendingSlash(uint256 agentId) internal {
        Agent storage a = agents[agentId];
        if (!a.pendingSlash) return;
        _prune(agentId);
        if (_lockJobs[agentId].length != 0) return;
        if (_slashable(a)) _slash(agentId);
        else {
            a.pendingSlash = false;
            a.pendingSlashAmount = 0;
        }
    }

    function _cancelOpenJobs(uint256 agentId) internal {
        uint256[] memory cancelled = ISettleNetHook(core).cancelOpenJobs(agentId);
        for (uint256 i; i < cancelled.length; ++i) {
            uint256 jobId = cancelled[i];
            if (_lockIndex[agentId][jobId] != 0) _removeAt(agentId, _lockIndex[agentId][jobId] - 1);
        }
    }

    function _slash(uint256 agentId) internal {
        _prune(agentId);
        Agent storage a = agents[agentId];
        address payee = identity.ownerOf(agentId);
        uint256 balance = a.stake;
        uint256 amount = a.pendingSlashAmount;
        uint256 lockedNow = _locked(agentId);
        if (lockedNow > amount) amount = lockedNow;
        if (amount > balance) amount = balance;
        uint256 free = balance - amount;

        delete agents[agentId];
        a.retired = true;

        uint256[] storage jobs = _lockJobs[agentId];
        while (jobs.length != 0) _removeAt(agentId, jobs.length - 1);

        if (amount != 0 && !usdc.transfer(treasury, amount)) revert TransferFailed();
        if (free != 0 && !usdc.transfer(payee, free)) revert TransferFailed();
        emit Slashed(agentId, payee, amount);
    }
}
