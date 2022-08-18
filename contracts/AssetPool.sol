// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./MerkleTreeWithHistory.sol";

interface ICommitmentVerifier {
    function verifyProof( 
            uint[2] memory a,
            uint[2][2] memory b,
            uint[2] memory c,
            uint[2] memory input
        ) external view returns (bool r);
}

interface IWithdrawalVerifier {
    function verifyProof( 
            uint[2] memory a,
            uint[2][2] memory b,
            uint[2] memory c,
            uint[6] memory input
        ) external view returns (bool r);
}

abstract contract AssetPool is MerkleTreeWithHistory, ReentrancyGuard, Ownable {
    ICommitmentVerifier public immutable commitmentVerifier;
    IWithdrawalVerifier public immutable withdrawalVerifier;

    struct SellerAccount {
        uint256 balance;
        string  name;
    }

    struct CommitmentLogItem {
        uint256 amount;
        bool isProven;
    }

    mapping(address => SellerAccount) public sellers;    
    // Commitment log, the amount need to be proofed before the commitment inserting to Merkel tree
    mapping(bytes32 => CommitmentLogItem) public commitmentLog;
    mapping(bytes32 => bool) public nullifierHashes;

    event InsertCommitment(bytes32 indexed commitment, bytes32 root, uint32 leafIndex, 
                            bytes32[] pathElements, uint32 pathIndices, uint256 timestamp);
    event SellerDeposit(address indexed sellerAddress, uint256 amount);
    event Withdrawal(address indexed to, uint256 amount, bytes32 nullifierHash, 
                        address relayer, uint256 fee);

  /**
    @dev The constructor
    @param _commitmentVerifier the address of SNARK verifier for this contract
    @param _hasher the address of MiMC hash contract
    @param _merkleTreeHeight the height of deposits' Merkle Tree
  **/
  constructor(
    ICommitmentVerifier _commitmentVerifier,
    IWithdrawalVerifier _withdrawalVerifier,
    IHasher _hasher,
    uint32 _merkleTreeHeight
  ) MerkleTreeWithHistory(_merkleTreeHeight, _hasher) {
    commitmentVerifier = _commitmentVerifier;
    withdrawalVerifier = _withdrawalVerifier;
  }

/**
    @dev register transacation by transaction Oracle service (i.e., Paypal Oracle)
**/
    function registerCommitment(bytes32 _commitment, uint256 _amount) external onlyOwner {
        require(!commitmentExists(_commitment), "The commitment already exists");
        
        commitmentLog[_commitment] = CommitmentLogItem(_amount, false);
    }

    function commitmentExists(bytes32 _commitment) public view returns (bool) {
        return (commitmentLog[_commitment].amount > 0);
    }

/**
    @dev prove a `commitment` for a transaction has correct amount
    @param  _proofData: zkSNARK proof _pi_a, _pi_b, _pic
    @param  _publicInputs: [commitmentHash, amount]
**/
    function proveCommitment(
                            uint256[8] calldata _proofData,
                            uint256[2] calldata _publicInputs
                            ) external {
        require(commitmentExists(bytes32(_publicInputs[0])), "No commitment found");
        require(commitmentLog[bytes32(_publicInputs[0])].amount == _publicInputs[1], "Amount mismatch");
        require(commitmentLog[bytes32(_publicInputs[0])].isProven == false, "Commitment has already been verified");
        require(
            commitmentVerifier.verifyProof([_proofData[0], _proofData[1]],
                                            [[_proofData[2], _proofData[3]], [_proofData[4], _proofData[5]]],
                                            [_proofData[6], _proofData[7]], 
                                            _publicInputs), 
                                            "Invalid commitment proof");

        commitmentLog[bytes32(_publicInputs[0])].isProven = true;
        ( 
            bytes32 root,
            uint32 leafIndex,  
            bytes32[] memory pathElements,
            uint32 pathIndices
        ) = _insert(bytes32(_publicInputs[0]));
        
        _processCommitmentInsertion();

        emit InsertCommitment(bytes32(_publicInputs[0]), root, leafIndex, pathElements, pathIndices, block.timestamp);
    }

/**
    @dev Deposit funds from seller
**/
    function sellerDeposit() external payable {
        sellers[msg.sender].balance += msg.value;

        emit SellerDeposit(msg.sender, msg.value);
  }
  
/** 
    @dev whether the nullifier is already spent 
**/
  function isSpent(bytes32 _nullifierHash) public view returns (bool) {
    return nullifierHashes[_nullifierHash];
  }

/**
    @dev Withdraw from asset pool.
    @param  _proofData: zkSNARK proof (_pi_a, _pi_b, _pi_c)
    @param  _publicInputs:[root, nullifierHash, recipient, amount, relayer, fee]
                - merkle root of all deposits in the contract
                - hash of unique deposit nullifier to prevent double spends
                - the recipient of funds
                - amount to be withdrew
                - relayer that relay the withdrawal request
                - the fee that goes to the transaction sender (usually a relayer)    
  **/
  function withdraw(
    uint256[8] calldata _proofData,
    uint256[6] calldata _publicInputs
  ) external payable nonReentrant{
    
    require(!nullifierHashes[bytes32(_publicInputs[1])], "The note has already been spent");
    require(
            withdrawalVerifier.verifyProof([_proofData[0], _proofData[1]],
                                            [[_proofData[2], _proofData[3]], [_proofData[4], _proofData[5]]],
                                            [_proofData[6], _proofData[7]],
                                            _publicInputs), 
                                            "Invalid withdrawal proof"
            );

    nullifierHashes[bytes32(_publicInputs[1])] = true;

    _processWithdrawal(
                    payable(address(uint160(_publicInputs[2]))),
                    payable(address(uint160(_publicInputs[4]))),
                    _publicInputs[3],
                    _publicInputs[5]
                    );
    
    emit Withdrawal(
                    address(uint160(_publicInputs[2])),
                    _publicInputs[3], 
                    bytes32(_publicInputs[1]),
                    address(uint160(_publicInputs[4])),
                    _publicInputs[5]
                    );
  }

  /** @dev these functions are defined in a child contract */
  function _processCommitmentInsertion() internal virtual;

  function _processWithdrawal(
    address payable _recipient,
    address payable _relayer,
    uint256 _amount,
    uint256 _fee
  ) internal virtual;
}
