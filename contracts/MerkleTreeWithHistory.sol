// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IHasher {
  function MiMCSponge(uint256 in_xL, uint256 in_xR, uint256 k) external pure returns (uint256 xL, uint256 xR);
}

contract MerkleTreeWithHistory {
  uint256 public constant FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
  uint256 public constant ZERO_VALUE = 890052662763911307850778159620885184910760398780342638619984914703804053834; // keccak256("zkMarket.Finance") % FIELD_SIZE
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
    if (i == 0) return bytes32(uint256(0x1f7c0801c91910ee966819dcbce0c940c0618cd33b2dea878b1e80275d8b94a));
    else if (i == 1) return bytes32(uint256(0x24816049a618fb575d582e49f278b6d6ed8df070dd4c6f42b5a2591bf258a5c7));
    else if (i == 2) return bytes32(uint256(0xaa6ec0a6dbb444786866edc923652ed38fd4c331460f9cc17664dfb08a60c41));
    else if (i == 3) return bytes32(uint256(0x21578f17ca98798034d7f43200df613efbbe03b2e73a71f1bbfe27719d63ec63));
    else if (i == 4) return bytes32(uint256(0x1ac20c1e1bc1ecb8fe2a8c35811b34129efd72ef5c28ec52a73feeb11d5eeb23));
    else if (i == 5) return bytes32(uint256(0x2680ec4ecaeebf96035b6ce23cdb5fc0367199ebb14f8b10109c87f3a8e9d7cf));
    else if (i == 6) return bytes32(uint256(0xfcde95bf0d8f94ba1d4d717cbfa919332d9021cf4d7671a3922ee8040c27c4a));
    else if (i == 7) return bytes32(uint256(0x14cf909d59ba36343fd30566ef5b4056991288c120b14bd37e816813fdc0992a));
    else if (i == 8) return bytes32(uint256(0x76bfc8a3e7b37e24befe23b0f698d07027f467d649ba5dc81216cd555ca4e27));
    else if (i == 9) return bytes32(uint256(0xf57eb010e999daeebb197d21bcf54cbf5687422b044d58ba73189b82cf61346));
    else if (i == 10) return bytes32(uint256(0x285daa59cd5edaf5aad2ad16c350c779026c3018ed4245b9294b7b4085f9d9a2));
    else if (i == 11) return bytes32(uint256(0x2fe3af955ad2b062d63538714fca18418c39b7c5a748c103d00b519c5be6f853));
    else if (i == 12) return bytes32(uint256(0x2cb004612cebb6be147a95f69014ba4aea41c32dc771851f696e30a166367c69));
    else if (i == 13) return bytes32(uint256(0x16b679b03ed416ac3bf10078162542fa646fec43486e9c731deccf3e58492bfb));
    else if (i == 14) return bytes32(uint256(0x251aabe71c1e8989634b906c9a2f85a8025b4da4aa22f414a56051327c4d0e2));
    else if (i == 15) return bytes32(uint256(0x18178e3528883bb3587730a962e93f91df48fdc0752cfe562d7f51a3bc828864));
    else if (i == 16) return bytes32(uint256(0xfc36a09626e32928aee5780008d1aff581c8052566b7e5abed902f95cbe0f40));
    else if (i == 17) return bytes32(uint256(0xca4b5f7171b55787f86e054df192604506aee630f389adb4d075ed8104c70df));
    else if (i == 18) return bytes32(uint256(0x27c144cc7447fd24714893307f9f30debc0481d61c175e3179c2045e9159a483));
    else if (i == 19) return bytes32(uint256(0x5fcb5998a7d9ad77b15d510c5d17008582ea07273a8c974d1544602a619ff8b));
    else if (i == 20) return bytes32(uint256(0x23f27b4fa98be0dc2584d0f2b0cb352c4756880958026505da65b79bcd14d1b5));
    else revert("Index out of bounds");
  }
}
