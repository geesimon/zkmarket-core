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

abstract contract Hongbao is MerkleTreeWithHistory, ReentrancyGuard {
  IVerifier public immutable verifier;
  uint256 public immutable denomination;

  mapping(bytes32 => bool) public nullifierHashes;
  // we store all commitments just to prevent accidental deposits with the same commitment
  mapping(bytes32 => bool) public commitments;

  event Deposit(bytes32 indexed commitment, bytes32 root, uint32 leafIndex, 
                bytes32[] pathElements, uint32 pathIndices,uint256 timestamp);
  event Withdrawal(address to, bytes32 nullifierHash, address indexed relayer, uint256 fee);

  /**
    @dev The constructor
    @param _verifier the address of SNARK verifier for this contract
    @param _hasher the address of MiMC hash contract
    @param _denomination transfer amount for each deposit
    @param _merkleTreeHeight the height of deposits' Merkle Tree
  */
  constructor(
    IVerifier _verifier,
    IHasher _hasher,
    uint256 _denomination,
    uint32 _merkleTreeHeight
  ) MerkleTreeWithHistory(_merkleTreeHeight, _hasher) {
    require(_denomination > 0, "denomination should be greater than 0");
    verifier = _verifier;
    denomination = _denomination;
  }

  /**
    @dev Deposit funds into the contract. The caller must send (for ETH) or approve (for ERC20) value equal to or `denomination` of this instance.
    @param _commitment the note commitment, which is PedersenHash(nullifier + secret)
  */
  function deposit(bytes32 _commitment) external payable nonReentrant {
    require(!commitments[_commitment], "The commitment has been submitted");

    ( 
      bytes32 root,
      uint32 leafIndex,  
      bytes32[] memory pathElements,
      uint32 pathIndices
    ) = _insert(_commitment);

    commitments[_commitment] = true;
    _processDeposit();

    emit Deposit(_commitment, root, leafIndex, pathElements, pathIndices, block.timestamp);
  }

  /** @dev this function is defined in a child contract */
  function _processDeposit() internal virtual;

  /**
    @dev Withdraw a deposit from the contract. `proof` is a zkSNARK proof data, and input is an array of circuit public inputs
    `input` array consists of:
      - merkle root of all deposits in the contract
      - hash of unique deposit nullifier to prevent double spends
      - the recipient of funds
      - optional fee that goes to the transaction sender (usually a relay)
    @param  _proofData: zkSNARK proof _pi_a, _pi_b, _pic
    @param  _publicInputs: [root, nullifierHash, recipient, relayer, fee, refund]
  **/
  function withdraw(
    uint256[8] calldata _proofData,
    uint256[6] calldata _publicInputs
  ) external payable nonReentrant{
    
    require(_publicInputs[4] <= denomination, "Fee exceeds transfer value");
    require(!nullifierHashes[bytes32(_publicInputs[1])], "The note has been already spent");
    require(isKnownRoot(bytes32(_publicInputs[0])), "Cannot find your merkle root"); // Make sure to use a recent one
    require(
      verifier.verifyProof([_proofData[0], _proofData[1]],
                            [[_proofData[2], _proofData[3]], [_proofData[4], _proofData[5]]],
                            [_proofData[6], _proofData[7]],
                          _publicInputs),
      "Invalid withdraw proof"
    );

    nullifierHashes[bytes32(_publicInputs[1])] = true;
    _processWithdraw(
                    payable(address(uint160(_publicInputs[2]))),
                    payable(address(uint160(_publicInputs[3]))),
                    _publicInputs[4], 
                    _publicInputs[5]
                    );
    emit Withdrawal(
                    payable(address(uint160(_publicInputs[2]))), 
                    bytes32(_publicInputs[1]), 
                    payable(address(uint160(_publicInputs[3]))), 
                    _publicInputs[4]
                    );
  }

  /** @dev this function is defined in a child contract */
  function _processWithdraw(
    address payable _recipient,
    address payable _relayer,
    uint256 _fee,
    uint256 _refund
  ) internal virtual;

  /** @dev whether a note is already spent */
  function isSpent(bytes32 _nullifierHash) public view returns (bool) {
    return nullifierHashes[_nullifierHash];
  }

  /** @dev whether an array of notes is already spent */
  function isSpentArray(bytes32[] calldata _nullifierHashes) external view returns (bool[] memory spent) {
    spent = new bool[](_nullifierHashes.length);
    for (uint256 i = 0; i < _nullifierHashes.length; i++) {
      if (isSpent(_nullifierHashes[i])) {
        spent[i] = true;
      }
    }
  }
}
