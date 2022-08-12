// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./AssetPool.sol";

contract PaypalUSDCAssetPool is AssetPool, Ownable {
    mapping(address => string) public sellersPaypalAccount;
    
    // Paypal txn_id table
    mapping(string => bool) public transactions;

    function configSeller(
                            string memory _name, 
                            string memory _paypalEmailAddress
                          ) external {
        sellers[msg.sender].name = _name;
        sellersPaypalAccount[msg.sender] = _paypalEmailAddress;
    }

    function existTransactions(string memory _txn_id) external view returns (bool) {
        return transactions[_txn_id];
    }

    function recordTransaction(string memory _txn_id) external onlyOwner {
        transactions[_txn_id] = true;
    }

    function proveCommitmentAmount() external {
        // _insert(_commitment);
    }
}
