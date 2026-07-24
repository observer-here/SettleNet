// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {IProviderBond, IEvaluatorStake} from "./interfaces/IBonds.sol";

contract SettleNet {
    enum Status { Posted, AgentPending, Open, Claimed, Submitted, Completed, Rejected, Expired, Cancelled }

    struct Job {
        address client;
        address provider;
        uint256 agentId;
        uint256 budget;
        uint64 expiredAt;
        uint64 submittedAt;
        uint64 resolvedAt;
        Status status;
        string title;
        string description;
        string submission;
    }

    uint16 internal constant CANCEL_FEE_BP = 100;
    uint64 internal constant RESOLVE_WINDOW = 7 days;
    uint64 internal constant MIN_JOB_EXPIRY = 1 hours;
    uint64 internal constant MAX_JOB_EXPIRY = 30 days;
    uint16 internal constant GHOST_SCORE_TENTHS = 35;

    IERC20 public immutable usdc;
    IProviderBond public immutable providerBond;
    IEvaluatorStake public immutable evaluatorStake;
    uint16 public immutable evaluatorFeeBP;

    mapping(uint256 => Job) public jobs;
    uint256 public jobCount;
    mapping(uint256 => bool) public rated;
    mapping(uint256 => uint256[]) private _applicants;
    mapping(uint256 => uint256[]) private _agentJobs;
    mapping(uint256 => mapping(uint256 => uint256)) private _agentJobIdx;
    uint256 private _lock = 1;

    event JobCreated(uint256 indexed jobId, address indexed client, uint256 budget, uint64 expiredAt, string title);
    event AgentApplied(uint256 indexed jobId, uint256 indexed agentId, address indexed owner_);
    event AgentApproved(uint256 indexed jobId, uint256 indexed agentId);
    event AgentRejected(uint256 indexed jobId, uint256 indexed agentId);
    event JobClaimed(uint256 indexed jobId, address indexed provider, uint256 bond);
    event JobSubmitted(uint256 indexed jobId, string submission);
    event JobCompleted(uint256 indexed jobId, uint256 paid, uint256 evaluatorFee);
    event JobRejected(uint256 indexed jobId, uint256 refund);
    event JobExpired(uint256 indexed jobId);
    event JobCancelled(uint256 indexed jobId, uint256 evaluatorFee);
    event EvaluatorRated(uint256 indexed jobId, uint256 indexed agentId, uint16 scoreTenths);

    error Reentrant();
    error EvaluatorInactive();
    error BadExpiry();
    error ExpiryTooLong();
    error BudgetTooHigh();
    error ZeroBudget();
    error WrongStatus();
    error NotAuthorized();
    error EmptyTitle();
    error EmptySubmission();
    error NotExpired();
    error ResolveWindowClosed();
    error AlreadyRated();
    error RatingWindowClosed();
    error TransferFailed();
    error ZeroAddress();
    error InvalidFeeBP();
    error BadScore();
    error OwnerApplied();

    modifier lock() {
        if (_lock == 2) revert Reentrant();
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor(address usdc_, address providerBond_, address evaluatorStake_, uint16 evaluatorFeeBP_) {
        if (usdc_ == address(0) || providerBond_ == address(0) || evaluatorStake_ == address(0)) revert ZeroAddress();
        if (evaluatorFeeBP_ > 10_000) revert InvalidFeeBP();
        usdc = IERC20(usdc_);
        providerBond = IProviderBond(providerBond_);
        evaluatorStake = IEvaluatorStake(evaluatorStake_);
        evaluatorFeeBP = evaluatorFeeBP_;
    }

    function createJob(uint64 expiredAt, uint256 budget, string calldata title, string calldata description)
        external
        lock
        returns (uint256 jobId)
    {
        if (expiredAt <= block.timestamp + MIN_JOB_EXPIRY) revert BadExpiry();
        if (expiredAt > block.timestamp + MAX_JOB_EXPIRY) revert ExpiryTooLong();
        if (budget == 0) revert ZeroBudget();
        if (bytes(title).length == 0) revert EmptyTitle();
        jobId = ++jobCount;
        Job storage job = jobs[jobId];
        job.client = msg.sender;
        job.budget = budget;
        job.expiredAt = expiredAt;
        job.title = title;
        job.description = description;
        job.status = Status.Posted;
        _pull(msg.sender, budget);
        emit JobCreated(jobId, msg.sender, budget, expiredAt, title);
    }

    function applicants(uint256 jobId) external view returns (uint256[] memory) {
        return _applicants[jobId];
    }

    function applyAsAgent(uint256 jobId, uint256 agentId) external lock {
        Job storage job = jobs[jobId];
        if (job.status != Status.Posted && job.status != Status.AgentPending) revert WrongStatus();
        _live(job);
        if (msg.sender == job.client || evaluatorStake.agentOwner(agentId) != msg.sender) revert NotAuthorized();
        uint256[] storage apps = _applicants[jobId];
        for (uint256 i; i < apps.length; ++i) if (_owner(apps[i]) == msg.sender) revert OwnerApplied();
        if (!evaluatorStake.isActive(agentId)) revert EvaluatorInactive();
        if (job.budget > evaluatorStake.maxBudget(agentId)) revert BudgetTooHigh();
        if (job.expiredAt > uint64(block.timestamp) + evaluatorStake.maxExpiryDuration(agentId)) revert ExpiryTooLong();
        evaluatorStake.onAssigned(agentId, jobId, job.budget);
        apps.push(agentId);
        job.status = Status.AgentPending;
        _track(agentId, jobId);
        emit AgentApplied(jobId, agentId, msg.sender);
    }

    function approveAgent(uint256 jobId, uint256 agentId) external lock {
        Job storage job = jobs[jobId];
        if (msg.sender != job.client) revert NotAuthorized();
        if (job.status != Status.AgentPending) revert WrongStatus();
        _live(job);
        if (!_has(jobId, agentId)) revert NotAuthorized();
        if (!evaluatorStake.isActive(agentId)) revert EvaluatorInactive();
        _purge(jobId, agentId);
        job.agentId = agentId;
        job.status = Status.Open;
        emit AgentApproved(jobId, agentId);
    }

    function rejectAgent(uint256 jobId, uint256 agentId) external lock {
        Job storage job = jobs[jobId];
        if (msg.sender != job.client) revert NotAuthorized();
        if (job.status != Status.AgentPending) revert WrongStatus();
        if (!_remove(jobId, agentId)) revert NotAuthorized();
        _release(agentId, jobId);
        emit AgentRejected(jobId, agentId);
        if (_applicants[jobId].length == 0) job.status = Status.Posted;
    }

    function cancelJob(uint256 jobId) external lock {
        Job storage job = jobs[jobId];
        if (msg.sender != job.client) revert NotAuthorized();
        Status s = job.status;
        if (s != Status.Posted && s != Status.AgentPending && s != Status.Open) revert WrongStatus();
        job.status = Status.Cancelled;
        uint256 fee;
        if (s == Status.AgentPending) {
            _purge(jobId, 0);
        } else if (s == Status.Open) {
            _release(job.agentId, jobId);
            fee = (job.budget * CANCEL_FEE_BP) / 10_000;
            _pay(_owner(job.agentId), fee);
        }
        _pay(job.client, job.budget - fee);
        emit JobCancelled(jobId, fee);
    }

    function cancelOpenJobs(uint256 agentId) external returns (uint256[] memory cancelled) {
        if (msg.sender != address(evaluatorStake)) revert NotAuthorized();
        bool acquired = _lock == 1;
        if (acquired) _lock = 2;
        else if (_lock != 2) revert Reentrant();

        uint256[] storage list = _agentJobs[agentId];
        cancelled = new uint256[](list.length);
        uint256 n;
        while (list.length != 0) {
            uint256 jobId = list[list.length - 1];
            Job storage job = jobs[jobId];
            _untrack(agentId, jobId);
            Status s = job.status;
            if (s == Status.AgentPending) {
                if (_remove(jobId, agentId)) {
                    evaluatorStake.clearJob(agentId, jobId);
                    emit AgentRejected(jobId, agentId);
                    if (_applicants[jobId].length == 0) job.status = Status.Posted;
                }
                continue;
            }
            if ((s != Status.Open && s != Status.Claimed) || job.agentId != agentId) continue;
            job.status = Status.Cancelled;
            cancelled[n++] = jobId;
            _pay(job.client, job.budget);
            if (job.provider != address(0)) providerBond.release(jobId, job.provider);
            emit JobCancelled(jobId, 0);
        }
        assembly { mstore(cancelled, n) }
        if (acquired) _lock = 1;
    }

    function claimJob(uint256 jobId) external lock {
        Job storage job = jobs[jobId];
        if (job.status != Status.Open) revert WrongStatus();
        _live(job);
        if (!evaluatorStake.isActive(job.agentId)) revert EvaluatorInactive();
        if (msg.sender == job.client || msg.sender == _owner(job.agentId)) revert NotAuthorized();
        uint256 bond = providerBond.lock(jobId, msg.sender, job.budget);
        job.provider = msg.sender;
        job.status = Status.Claimed;
        emit JobClaimed(jobId, msg.sender, bond);
    }

    function submit(uint256 jobId, string calldata submission) external lock {
        Job storage job = jobs[jobId];
        if (job.status != Status.Claimed) revert WrongStatus();
        _live(job);
        if (!evaluatorStake.isActive(job.agentId)) revert EvaluatorInactive();
        if (msg.sender != job.provider) revert NotAuthorized();
        if (bytes(submission).length == 0) revert EmptySubmission();
        job.submission = submission;
        job.submittedAt = uint64(block.timestamp);
        job.status = Status.Submitted;
        _untrack(job.agentId, jobId);
        emit JobSubmitted(jobId, submission);
    }

    function complete(uint256 jobId) external lock {
        Job storage job = _beginResolve(jobId);
        job.status = Status.Completed;
        uint256 fee = _fee(job.budget);
        _pay(job.provider, job.budget - fee);
        _pay(_owner(job.agentId), fee);
        providerBond.release(jobId, job.provider);
        emit JobCompleted(jobId, job.budget - fee, fee);
    }

    function reject(uint256 jobId) external lock {
        Job storage job = _beginResolve(jobId);
        job.status = Status.Rejected;
        _pay(job.client, job.budget);
        _bondAbs(jobId, _owner(job.agentId), _fee(job.budget), job.client);
        emit JobRejected(jobId, job.budget);
    }

    function claimRefund(uint256 jobId) external lock {
        Job storage job = jobs[jobId];
        Status prior = job.status;
        if (
            prior != Status.Posted && prior != Status.AgentPending && prior != Status.Open
                && prior != Status.Claimed && prior != Status.Submitted
        ) revert WrongStatus();
        if (prior == Status.Submitted) {
            if (block.timestamp < job.submittedAt + RESOLVE_WINDOW) revert NotExpired();
        } else if (block.timestamp < job.expiredAt) {
            revert NotExpired();
        }
        job.status = Status.Expired;

        if (prior == Status.Submitted) {
            rated[jobId] = true;
            evaluatorStake.clearJob(job.agentId, jobId);
            evaluatorStake.applyRating(job.agentId, GHOST_SCORE_TENTHS, job.budget);
            emit EvaluatorRated(jobId, job.agentId, GHOST_SCORE_TENTHS);
            uint256 toProvider = (job.budget * 2000) / 10_000;
            _pay(job.provider, toProvider);
            _pay(job.client, job.budget - toProvider);
            providerBond.release(jobId, job.provider);
        } else {
            if (prior == Status.AgentPending) _purge(jobId, 0);
            else if (prior != Status.Posted) _release(job.agentId, jobId);
            _pay(job.client, job.budget);
            if (prior == Status.Claimed) _bondBp(jobId, job.client, 7000, _owner(job.agentId));
        }
        emit JobExpired(jobId);
    }

    function rateEvaluator(uint256 jobId, uint8 score) external lock {
        Job storage job = jobs[jobId];
        if (msg.sender != job.client) revert NotAuthorized();
        if (job.status != Status.Completed && job.status != Status.Rejected) revert WrongStatus();
        if (block.timestamp > job.resolvedAt + evaluatorStake.ratingWindow()) revert RatingWindowClosed();
        if (rated[jobId]) revert AlreadyRated();
        if (score > 10) revert BadScore();
        rated[jobId] = true;
        uint16 tenths = uint16(score) * 10;
        evaluatorStake.applyRating(job.agentId, tenths, job.budget);
        emit EvaluatorRated(jobId, job.agentId, tenths);
    }

    function _beginResolve(uint256 jobId) internal returns (Job storage job) {
        job = jobs[jobId];
        if (job.status != Status.Submitted) revert WrongStatus();
        if (msg.sender != _owner(job.agentId)) revert NotAuthorized();
        if (!evaluatorStake.isActive(job.agentId)) revert EvaluatorInactive();
        if (block.timestamp > job.submittedAt + RESOLVE_WINDOW) revert ResolveWindowClosed();
        job.resolvedAt = uint64(block.timestamp);
        evaluatorStake.onResolved(job.agentId, jobId);
    }

    function _bondAbs(uint256 jobId, address a, uint256 aAmt, address b) internal {
        uint256 bond = providerBond.release(jobId, address(this));
        if (bond == 0) return;
        if (aAmt > bond) aAmt = bond;
        _pay(a, aAmt);
        _pay(b, bond - aAmt);
    }

    function _bondBp(uint256 jobId, address a, uint16 aBp, address b) internal {
        uint256 bond = providerBond.release(jobId, address(this));
        if (bond == 0) return;
        uint256 aAmt = (bond * aBp) / 10_000;
        _pay(a, aAmt);
        _pay(b, bond - aAmt);
    }

    function _owner(uint256 agentId) internal view returns (address) {
        return evaluatorStake.agentOwner(agentId);
    }

    function _live(Job storage job) internal view {
        if (block.timestamp >= job.expiredAt) revert BadExpiry();
    }

    function _fee(uint256 budget) internal view returns (uint256) {
        return (budget * evaluatorFeeBP) / 10_000;
    }

    function _release(uint256 agentId, uint256 jobId) internal {
        _untrack(agentId, jobId);
        evaluatorStake.clearJob(agentId, jobId);
    }

    function _purge(uint256 jobId, uint256 keep) internal {
        uint256[] storage list = _applicants[jobId];
        while (list.length != 0) {
            uint256 id = list[list.length - 1];
            list.pop();
            if (id == keep) continue;
            _release(id, jobId);
            emit AgentRejected(jobId, id);
        }
    }

    function _has(uint256 jobId, uint256 agentId) internal view returns (bool) {
        uint256[] storage list = _applicants[jobId];
        for (uint256 i; i < list.length; ++i) if (list[i] == agentId) return true;
        return false;
    }

    function _remove(uint256 jobId, uint256 agentId) internal returns (bool) {
        uint256[] storage list = _applicants[jobId];
        for (uint256 i; i < list.length; ++i) {
            if (list[i] == agentId) {
                list[i] = list[list.length - 1];
                list.pop();
                return true;
            }
        }
        return false;
    }

    function _track(uint256 agentId, uint256 jobId) internal {
        _agentJobs[agentId].push(jobId);
        _agentJobIdx[agentId][jobId] = _agentJobs[agentId].length;
    }

    function _untrack(uint256 agentId, uint256 jobId) internal {
        uint256 idx = _agentJobIdx[agentId][jobId];
        if (idx == 0) return;
        uint256[] storage list = _agentJobs[agentId];
        uint256 last = list.length - 1;
        uint256 i = idx - 1;
        if (i != last) {
            uint256 moved = list[last];
            list[i] = moved;
            _agentJobIdx[agentId][moved] = idx;
        }
        list.pop();
        delete _agentJobIdx[agentId][jobId];
    }

    function _pull(address from, uint256 amount) internal {
        if (!usdc.transferFrom(from, address(this), amount)) revert TransferFailed();
    }

    function _push(address to, uint256 amount) internal {
        if (!usdc.transfer(to, amount)) revert TransferFailed();
    }

    function _pay(address to, uint256 amount) internal {
        if (amount != 0) _push(to, amount);
    }
}
