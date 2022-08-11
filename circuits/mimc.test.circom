pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/mimcsponge.circom";

template HashLeftRightFeistel() {
    signal input left;
    signal input right;
    signal output hash;

    component hasher =  MiMCFeistel(220);
    hasher.xL_in <== left;
    hasher.xR_in <== right;
    hasher.k <== 0;
    hash <== hasher.xL_out;
}

template HashLeftRightSponge() {
    signal input left;
    signal input right;
    signal output hash;

    component hasher = MiMCSponge(2, 220, 1);
    hasher.ins[0] <== left;
    hasher.ins[1] <== right;
    hasher.k <== 0;
    hash <== hasher.outs[0];
}

template HashCompare() {
    signal input left;
    signal input right;
    signal output hashFeistel;
    signal output hashSponge;

    component hasherFeistel = HashLeftRightFeistel();
    component hasherSponge = HashLeftRightSponge();

    hasherFeistel.left <== left;
    hasherFeistel.right <== right;
    hashFeistel <== hasherFeistel.hash;

    hasherSponge.left <== left;
    hasherSponge.right <== right;
    hashSponge <== hasherSponge.hash;
}

component main = HashCompare();