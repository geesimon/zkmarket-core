// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IHasher {
  function MiMCSponge(uint256 in_xL, uint256 in_xR, uint256 k) external pure returns (uint256 xL, uint256 xR);
}

contract MerkleTreeWithHistory {
  uint256 public constant FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
  uint256 public constant ZERO_VALUE = 8568824596295711272276493421173227402986947053170746004488571001319888434851; // = keccak256("hongbao") % FIELD_SIZE
  IHasher public immutable hasher;

  uint32 public levels;

  // event Hash(bytes32 left, bytes32 right, bytes32 indexed value);
  
  // the following variables are made public for easier testing and debugging and
  // are not supposed to be accessed in regular code

  // filledSubtrees and roots could be bytes32[size], but using mappings makes it cheaper because
  // it removes index range check on every interaction
  mapping(uint256 => bytes32) public filledSubtrees;
  mapping(uint256 => bytes32) public roots;
  uint32 public constant ROOT_HISTORY_SIZE = 30;
  uint32 public currentRootIndex = 0;
  uint32 public nextIndex = 0;

  constructor(uint32 _levels, IHasher _hasher) {
    require(_levels > 0, "_levels should be greater than zero");
    require(_levels < 32, "_levels should be less than 32");
    levels = _levels;
    hasher = _hasher;

    for (uint32 i = 0; i < _levels; i++) {
      filledSubtrees[i] = zeros(i);
    }

    roots[0] = zeros(_levels - 1);
  }

  /**
    @dev Hash 2 tree leaves, returns MiMC(_left, _right)
  */
  function hashLeftRight(
    IHasher _hasher,
    bytes32 _left,
    bytes32 _right
  ) public pure returns (bytes32) {
    require(uint256(_left) < FIELD_SIZE, "_left should be inside the field");
    require(uint256(_right) < FIELD_SIZE, "_right should be inside the field");

    (uint256 hashValue,) = _hasher.MiMCSponge(uint256(_left), uint256(_right), 0);
    
    // emit Hash(_left, _right, bytes32(hashValue));

    return bytes32(hashValue);
  }

  function _insert(bytes32 _leaf) internal returns (bytes32 root,
                                                    uint32 _index,
                                                    bytes32[] memory _pathElements,
                                                    uint32 _pathIndices) {
    uint32 _nextIndex = nextIndex;
    require(_nextIndex != uint32(2)**levels, "Merkle tree is full. No more leaves can be added");
    uint32 currentIndex = _nextIndex;
    bytes32 currentLevelHash = _leaf;
    bytes32 left;
    bytes32 right;
    bytes32[] memory pathElements = new bytes32[](levels);
    uint32 pathIndices = 0;

    for (uint32 i = 0; i < levels; i++) {
      if (currentIndex % 2 == 0) {
        left = currentLevelHash;
        right = zeros(i);
        filledSubtrees[i] = currentLevelHash;

        pathElements[i] =  right;
        pathIndices = pathIndices << 1;
      } else {
        left = filledSubtrees[i];
        right = currentLevelHash;

        pathElements[i] =  left;
        pathIndices = (pathIndices << 1) + 1;
      }

      currentLevelHash = hashLeftRight(hasher, left, right);
      currentIndex /= 2;
    }

    uint32 newRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
    currentRootIndex = newRootIndex;
    roots[newRootIndex] = currentLevelHash;
    nextIndex = _nextIndex + 1;

    return (currentLevelHash, _nextIndex, pathElements, pathIndices);
  }

  function mimcHash(uint256 left, uint256 right) external view returns (bytes32) {
    (uint256 hashValue,) = hasher.MiMCSponge(left, right, 0);
    
    return bytes32(hashValue);
  }


  /**
    @dev Whether the root is present in the root history
  */
  function isKnownRoot(bytes32 _root) public view returns (bool) {
    if (_root == 0) {
      return false;
    }
    uint32 _currentRootIndex = currentRootIndex;
    uint32 i = _currentRootIndex;
    do {
      if (_root == roots[i]) {
        return true;
      }
      if (i == 0) {
        i = ROOT_HISTORY_SIZE;
      }
      i--;
    } while (i != _currentRootIndex);
    return false;
  }

  /**
    @dev Returns the last root
  */
  function getLastRoot() public view returns (bytes32) {
    return roots[currentRootIndex];
  }

  /// @dev provides Zero (Empty) elements for a MiMC MerkleTree. Up to 20 levels
  function zeros(uint256 i) public pure returns (bytes32) {
    if (i == 0) return bytes32(uint256(0x12f1c868f7a8a61c1c0c699f7272f7089ca416432fcc978be7abb941e15ab6a3));
    else if (i == 1) return bytes32(uint256(0x2df788be786881da8a3314c0e6e84ad533e62c3609f818cde7cf0a9bb363d062));
    else if (i == 2) return bytes32(uint256(0x16425d57f21e06867dee8398d97d7beb7e0a1bf8ce701793266ee0ff6765025c));
    else if (i == 3) return bytes32(uint256(0x23abad249052d2923f26ed956fcd1c2bcd5eff324a3bd2ffae42f40514c9ab92));
    else if (i == 4) return bytes32(uint256(0xe449e754c50ebdd1934e2581c91b15883d9b3280da8472c8679193df754107d));
    else if (i == 5) return bytes32(uint256(0x28304fd49efd740bf703ed270284c09b616c23440016bf6ad5705372b684f10b));
    else if (i == 6) return bytes32(uint256(0x1287d83833dd726a6e3df227b2d9f032df9f10b9fc8b33a69d65fbca26e651d2));
    else if (i == 7) return bytes32(uint256(0x35bb0e30dc1fcfb93c39f842b20fc08a958a24a34c6d3fe3a65b186e5956b4d));
    else if (i == 8) return bytes32(uint256(0xb03891f4d509dccf716d9aedfc4bc1538eeb385aee95e1ff47a029aa950c607));
    else if (i == 9) return bytes32(uint256(0x2a63376839b1317433625ebaf6b4ab619e9c15661c0851839dd29c3d54bc1a56));
    else if (i == 10) return bytes32(uint256(0x198fcf42ce24d39eba2da516f93efcd7a2d414450ad482adc3b10fbb63082a04));
    else if (i == 11) return bytes32(uint256(0x1446610d8f1dae7a0a681329264fc9c463ab9e9347b8af404165689bb533380));
    else if (i == 12) return bytes32(uint256(0x1a97668a2fc2920c31bd17d57154427b84f3b3207a107a3f06beaa1fc56578f2));
    else if (i == 13) return bytes32(uint256(0x7c12f492251b255bc8b9eaf99819c32a62b4089a6ea659dd4a5f8fa57c1332a));
    else if (i == 14) return bytes32(uint256(0x1c07e9005be9b0a4af487e727473d5f52c72d3aee062ff06671d12909eac4d09));
    else if (i == 15) return bytes32(uint256(0xb82200a98a49e44c92d7c0835e3f29668953821074e91071b8500796d5e58dc));
    else if (i == 16) return bytes32(uint256(0x97821acb9fbcd6cdcd43b5895f38bdc108b1ff178942e726692e0cc92a2868c));
    else if (i == 17) return bytes32(uint256(0x2b1fe32c11a3344a25a024c038c5e00e0b2e16b7aa0ab4129c9fe6370420871d));
    else if (i == 18) return bytes32(uint256(0x83ceeacfbd85f703adec26cc99dd83724b7773fc999545ef63fad45b2cc28b0));
    else if (i == 19) return bytes32(uint256(0x23192b109e2809b0a6d38b5fbb52a3eafbafc1432b4545a486cb3011c59b7399));
    else if (i == 20) return bytes32(uint256(0x14948fc09d57389d97d4e78692506386efb6cdd56664f7623252b0ff74a180b9));
    else revert("Index out of bounds");
  }
}
