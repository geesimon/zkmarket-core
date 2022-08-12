// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MerkleTreeWithHistory.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IVerifier {
    function verifyProof( 
            uint[2] memory a,
            uint[2][2] memory b,
            uint[2] memory c,
            uint[6] memory input
        ) external view returns (bool r);
}

contract AssetPool {
    // IVerifier public immutable verifier;

    struct SellerAccount {
        uint256  balance;
        string name;
    }

    mapping(address => SellerAccount) public sellers;

    event Deposit(address indexed sellerAddress, uint256 amount);

  /**
    @dev The constructor
    @param _verifier the address of SNARK verifier for this contract
    @param _hasher the address of MiMC hash contract
    @param _merkleTreeHeight the height of deposits' Merkle Tree
  */
//   constructor(
//     IVerifier _verifier,
//     IHasher _hasher,
//     uint32 _merkleTreeHeight
//   ) MerkleTreeWithHistory(_merkleTreeHeight, _hasher) {
//     verifier = _verifier;
//   }

  /**
    @dev Deposit funds from seller
  **/
    function deposit() external payable {
        sellers[msg.sender].balance += msg.value;

        emit Deposit(msg.sender, msg.value);
  }
}
