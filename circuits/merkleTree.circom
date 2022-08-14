pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/mimcsponge.circom";

template HashLeftRight() {
    signal input left;
    signal input right;
    signal output hash;

    component hasher =  MiMCFeistel(220);
    hasher.xL_in <== left;
    hasher.xR_in <== right;
    hasher.k <== 0;
    hash <== hasher.xL_out;
}

template DualMux() {
    signal input in[2];
    signal input s;
    signal output out[2];

    s * (1 - s) === 0;
    out[0] <== (in[1] - in[0])*s + in[0];
    out[1] <== (in[0] - in[1])*s + in[1];
}

template MerkleTreeRoot(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal output root;

    component selectors[levels];
    component hashers[levels];

    for (var i = 0; i < levels; i++) {
        selectors[i] = DualMux();
        selectors[i].in[0] <== i == 0 ? leaf : hashers[i - 1].hash;
        selectors[i].in[1] <== pathElements[i];
        selectors[i].s <== pathIndices[i];

        hashers[i] = HashLeftRight();
        hashers[i].left <== selectors[i].out[0];
        hashers[i].right <== selectors[i].out[1];
    }

    hashers[levels - 1].hash ==> root;
}

// Verifies that merkle proof is correct for given merkle root and a leaf
// pathIndices input is an array of 0/1 selectors telling whether given pathElement 
// is on the left or right side of merkle path
template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    component merkleTreeRoot = MerkleTreeRoot(levels);
    merkleTreeRoot.leaf <== leaf;
    for (var i = 0; i < levels; i++) {
        merkleTreeRoot.pathElements[i] <== pathElements[i];
        merkleTreeRoot.pathIndices[i] <== pathIndices[i];
    }

    root === merkleTreeRoot.root;
}