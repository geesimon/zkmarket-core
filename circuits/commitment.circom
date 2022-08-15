pragma circom 2.0.0;

include "commitmentHasher.circom";

template Main () {
    signal input commitmentHash;
    signal input amount;
    signal input nullifier;
    signal input secret;

    component hasher = CommitmentHasher();
    hasher.nullifier <== nullifier;
    hasher.secret <== secret;
    hasher.amount <== amount;
    hasher.commitmentHash === commitmentHash;
}

component main {public [commitmentHash, amount]} = Main();