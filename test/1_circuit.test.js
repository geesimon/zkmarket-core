const path = require("path");
// const Scalar = require("ffjavascript").Scalar;
const buildPedersenHash = require("circomlibjs").buildPedersenHash;
const buildMimcSponge = require("circomlibjs").buildMimcSponge;
// const buildBabyJub = require("circomlibjs").buildBabyjub;
const wasm_tester = require("circom_tester").wasm;
const MerkleTree = require('fixed-merkle-tree').MerkleTree;
const bigInt = require("big-integer");
const bigInt2BytesLE = require('wasmsnark/src/utils.js').bigInt2BytesLE


const FIELD_SIZE = bigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
// const ZERO_VALUE = bigInt('8568824596295711272276493421173227402986947053170746004488571001319888434851').value; // = keccak256("hongbao") % FIELD_SIZE
const ZERO_VALUE = bigInt('890052662763911307850778159620885184910760398780342638619984914703804053834').value; // = keccak256("zkMarket.Finance") % FIELD_SIZE

let pedersenHasher;
let mimcHasher;
let tree;

const calcCommitmentNullifierHash = (_nullifier, _secret, _amount) => {
    let nullifier_buff = Buffer.from(bigInt2BytesLE(_nullifier, 31));
    let secret_buff = Buffer.from(bigInt2BytesLE(_secret, 31));
    let amount_buff = Buffer.from(bigInt2BytesLE(_amount, 31));

    const preimage = Buffer.concat([nullifier_buff, secret_buff, amount_buff])

    // console.log("nullifier_buff:", nullifier_buff);
    // console.log("secret_buff:", secret_buff);
    // console.log("commitment_buff:", preimage.length);
    return {
        nullifierHash: pedersenHasher(nullifier_buff),
        commitmentHash: pedersenHasher(preimage)
    }
};

describe("Circuit Commitment Hasher Test", function() {
    this.timeout(100000);

    let commitmentCircuit;

    before( async() => {
        let pedersenHash = await buildPedersenHash();
        let babyJub = pedersenHash.babyJub;
        let F = babyJub.F;

        pedersenHasher = (data) => F.toObject(babyJub.unpackPoint(pedersenHash.hash(data))[0]);
        commitmentCircuit = await wasm_tester(path.join(__dirname, "../circuits", "commitment.circom"));
    });

    async function verifyCommitmentHasher(_amount, _nullifier, _secret) {
        let w;

        const {commitmentHash} = calcCommitmentNullifierHash(bigInt(_nullifier), bigInt(_secret), bigInt(_amount));

        w = await commitmentCircuit.calculateWitness({  commitmentHash: commitmentHash,
                                                        amount: _amount,
                                                        nullifier: _nullifier, 
                                                        secret: _secret}, true);

        await commitmentCircuit.checkConstraints(w);
    }

    it("Should Compute big value", async () => {
        let nullifier = "293145113002080864354859942535675522368952502950992663588348970337735067419";
        let secret = "189639915884766668134012755055612952971296867817286197960766047128712251041";
        let amount = "1000000000000000000"
        
        await verifyCommitmentHasher(nullifier, secret, amount);
    });

    it("Should calculate small value", async () => {
        let nullifier = "123";
        let secret = "456";
        let amount = "100"
        
        await verifyCommitmentHasher(nullifier, secret, amount);
    });
});

describe("Circuit Merkle Tree Test", function() {
    this.timeout(300000);
    
    let merkleTreeCircuit;
    
    before( async() => {
        let mimcSponge = await buildMimcSponge();
        let F = mimcSponge.F;

        //Set global Mimc hash function
        mimcHasher = (left, right) => F.toObject(mimcSponge.hash(left, right, 0).xL);

        tree = new MerkleTree(20, [], { hashFunction: mimcHasher, zeroElement: ZERO_VALUE});
        
        merkleTreeCircuit = await wasm_tester(path.join(__dirname, "../circuits", "merkleTree.test.circom"));
    });

    it("Should insert 1000 leaves and verify any 10", async () => {
        let leaves = Array(1000);
        let checkCandidates = Array(10);

        for (var i = 0; i < leaves.length; i++){
            leaves[i] = bigInt.randBetween(0, FIELD_SIZE);
            tree.insert(leaves[i]);
        }
        for (var i = 0; i < checkCandidates.length; i++) {
            checkCandidates[i] = Math.floor(Math.random() * leaves.length);
        }

        for (var i = 0; i < checkCandidates.length; i++){
            // console.log("check ", checkCandidates[i], ":", leaves[checkCandidates[i]].toString(), "->", tree.root);
            console.log("check ", checkCandidates[i]);
            let w;

            const { pathElements, pathIndices } = tree.proof(leaves[checkCandidates[i]]);
            // console.log(pathElements, pathIndices);
            w = await merkleTreeCircuit.calculateWitness({ leaf: leaves[checkCandidates[i]],
                                                            pathElements: pathElements,
                                                            pathIndices: pathIndices}, 
                                                            true);
            // console.log(w);
            await merkleTreeCircuit.assertOut(w, {root: tree.root});
            await merkleTreeCircuit.checkConstraints(w);
        }
    });
});

describe("Circuit Withdrawal Test", function () {
    this.timeout(600000);

    let withdrawCircuit;

    const rbigint = (nbytes) => bigInt.randBetween(0, bigInt(2).pow(nbytes * 8));

    before( async() => {           
        withdrawCircuit = await wasm_tester(path.join(__dirname, "../circuits", "withdraw.circom"));
    });

    it("Should insert and verify 10 commitments in merkle tree", async () => {
        for (var i = 0; i < 10; i++) {
            let w;
            let nullifier = rbigint(31);
            let secret = rbigint(31);
            let amount = rbigint(31);

            const {nullifierHash, commitmentHash} = calcCommitmentNullifierHash(nullifier, secret, amount);
            tree.insert(commitmentHash);
            const {pathElements, pathIndices} = tree.proof(commitmentHash);

            console.log("check ", i, " => Root:", tree.root);

            w = await withdrawCircuit.calculateWitness({ root: tree.root.toString(),
                                                        nullifier: nullifier.toString(),
                                                        nullifierHash: nullifierHash.toString(),
                                                        secret: secret.toString(),
                                                        pathElements: pathElements,
                                                        pathIndices: pathIndices,
                                                        recipient: "247339843768101550699144957037481732776977273098",
                                                        amount: amount.toString(),
                                                        relayer: "1431779679606208237886699149837667504955655623894",
                                                        fee: "200000000000000000"
                                                        },
                                                        true);
            await withdrawCircuit.checkConstraints(w);
        }
    })
});