// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "../interfaces/IERC20.sol";
import {IProviderBond} from "../interfaces/IBonds.sol";

contract ProviderBond is IProviderBond {
    IERC20 public immutable usdc;
    uint16 public immutable bondBP;
    address public immutable owner;
    address public core;

    mapping(uint256 => uint256) public bondOf;
    mapping(uint256 => bool) public locked;

    event CoreSet(address indexed core);
    event BondLocked(uint256 indexed jobId, address indexed provider, uint256 amount);
    event BondReleased(uint256 indexed jobId, address indexed to, uint256 amount);

    error NotCore();
    error NotOwner();
    error CoreAlreadySet();
    error AlreadyLocked();
    error NotLocked();
    error TransferFailed();
    error ZeroAddress();
    error InvalidBondBP();

    modifier onlyCore() {
        if (msg.sender != core) revert NotCore();
        _;
    }

    constructor(address usdc_, uint16 bondBP_) {
        if (usdc_ == address(0)) revert ZeroAddress();
        if (bondBP_ > 10_000) revert InvalidBondBP();
        usdc = IERC20(usdc_);
        bondBP = bondBP_;
        owner = msg.sender;
    }

    function setCore(address core_) external {
        if (msg.sender != owner) revert NotOwner();
        if (core != address(0)) revert CoreAlreadySet();
        if (core_ == address(0)) revert ZeroAddress();
        core = core_;
        emit CoreSet(core_);
    }

    function bondRequired(uint256 budget) public view returns (uint256) {
        return (budget * bondBP) / 10_000;
    }

    function lock(uint256 jobId, address provider, uint256 budget) external onlyCore returns (uint256 amount) {
        if (locked[jobId]) revert AlreadyLocked();
        amount = bondRequired(budget);
        locked[jobId] = true;
        if (amount != 0) {
            if (!usdc.transferFrom(provider, address(this), amount)) revert TransferFailed();
            bondOf[jobId] = amount;
        }
        emit BondLocked(jobId, provider, amount);
    }

    function release(uint256 jobId, address to) external onlyCore returns (uint256 amount) {
        if (!locked[jobId]) revert NotLocked();
        amount = bondOf[jobId];
        delete bondOf[jobId];
        delete locked[jobId];
        if (amount != 0 && !usdc.transfer(to, amount)) revert TransferFailed();
        emit BondReleased(jobId, to, amount);
    }
}
