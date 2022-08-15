// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AssetPool.sol";

contract PaypalUSDCAssetPool is AssetPool {
    mapping(address => string) public sellersPaypalAccount;
    
    constructor(
        ICommitmentVerifier _commitmentVerifier,
        IHasher _hasher,
        uint32 _merkleTreeHeight
    ) AssetPool(_commitmentVerifier, _hasher, _merkleTreeHeight) {}

    function configSeller(
                            string memory _name,
                            string memory _paypalEmailAddress
                          ) external {
        sellers[msg.sender].name = _name;
        sellersPaypalAccount[msg.sender] = _paypalEmailAddress;
    }

    function _processCommitmentInsertion() internal override {
    }
}
