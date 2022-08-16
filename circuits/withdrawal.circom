pragma circom 2.0.0;

include "commitmentHasher.circom";
include "merkleTree.circom";

// Verifies that commitment that corresponds to given secret and nullifier is included in the merkle tree of deposits
template Withdrawal(levels) {
    signal input root;
    signal input nullifierHash;
    signal input recipient;
    signal input amount;
    signal input relayer;
    signal input fee;
    signal input nullifier;
    signal input secret;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    component hasher = CommitmentHasher();
    hasher.nullifier <== nullifier;
    hasher.secret <== secret;
    hasher.amount <== amount;
    hasher.nullifierHash === nullifierHash;
    
    component tree = MerkleTreeChecker(levels);
    tree.leaf <== hasher.commitmentHash;
    tree.root <== root;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    // Add hidden signals to make sure that tampering with recipient or fee will invalidate the snark proof
    // Most likely it is not required, but it's better to stay on the safe side and it only takes 2 constraints
    // Squares are used to prevent optimizer from removing those constraints
    signal recipientSquare;
    signal feeSquare;
    signal relayerSquare;
    signal refundSquare;
    recipientSquare <== recipient * recipient;
    feeSquare <== fee * fee;
    relayerSquare <== relayer * relayer;
}

component main {public [root, nullifierHash, recipient, amount, relayer, fee]} = Withdrawal(20);