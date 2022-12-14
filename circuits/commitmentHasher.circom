pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/pedersen.circom";

// computes Pedersen(nullifier + secret)
template CommitmentHasher() {
    signal input nullifier;
    signal input secret;
    signal input amount;
    signal output commitmentHash;
    signal output nullifierHash;

    component commitmentHasher = Pedersen(248 * 3);
    component nullifierHasher = Pedersen(248);
    component nullifierBits = Num2Bits(248);
    component secretBits = Num2Bits(248);
    component amountBits = Num2Bits(248);

    nullifierBits.in <== nullifier;
    secretBits.in <== secret;
    amountBits.in <== amount;
    
    for (var i = 0; i < 248; i++) {
        nullifierHasher.in[i] <== nullifierBits.out[i];
        commitmentHasher.in[i] <== nullifierBits.out[i];
        commitmentHasher.in[i + 248] <== secretBits.out[i];
        commitmentHasher.in[i + 248 * 2] <== amountBits.out[i];
    }

    commitmentHash <== commitmentHasher.out[0];
    nullifierHash <== nullifierHasher.out[0];
}