// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockIdentity {
    mapping(uint256 => address) public ownerOf;

    function mint(uint256 agentId, address to) external {
        ownerOf[agentId] = to;
    }

    function transfer(uint256 agentId, address to) external {
        require(ownerOf[agentId] == msg.sender, "not owner");
        ownerOf[agentId] = to;
    }
}
