// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AssetPool.sol";

contract PaypalUSDCAssetPool is AssetPool {
    mapping(address => string) public sellersPaypalAccount;
    
    constructor(
        ICommitmentVerifier _commitmentVerifier,
        IWithdrawalVerifier _withdrawalVerifier,
        IHasher _hasher,
        uint32 _merkleTreeHeight
    ) AssetPool(_commitmentVerifier, 
                _withdrawalVerifier, 
                _hasher, 
                _merkleTreeHeight) {}

    function configSeller(
                            string memory _name,
                            string memory _paypalEmailAddress
                          ) external {
        sellers[msg.sender].name = _name;
        sellersPaypalAccount[msg.sender] = _paypalEmailAddress;
    }

    function _processCommitmentInsertion() internal override {
    }

    function _processWithdrawal(    
                                address payable _recipient,
                                address payable _relayer,
                                uint256 _amount,
                                uint256 _fee) 
                                internal override {
        // (bool success, ) = _recipient.call{ value: _amount - _fee }("");

        // require(success, "Payment to recipient failed");

        // if (_fee > 0) {
        //     (success, ) = _relayer.call{ value: _fee }("");
        //     require(success, "Payment to relayer failed");
        // }                                    
    }
}
