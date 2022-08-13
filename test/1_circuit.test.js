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

    let commitmentHasherCircuit;

    before( async() => {
        let pedersenHash = await buildPedersenHash();
        let babyJub = pedersenHash.babyJub;
        let F = babyJub.F;

        pedersenHasher = (data) => F.toObject(babyJub.unpackPoint(pedersenHash.hash(data))[0]);
        commitmentHasherCircuit = await wasm_tester(path.join(__dirname, "../circuits", "commitmentHasher.test.circom"));
    });

    async function verifyCommitmentHasher(_nullifier, _secret, _amount) {
        let w;

        w = await commitmentHasherCircuit.calculateWitness({ nullifier: _nullifier, secret: _secret, amount: _amount}, true);

        const {nullifierHash, commitmentHash} = calcCommitmentNullifierHash(bigInt(_nullifier), bigInt(_secret), bigInt(_amount));

        // console.log("commitmentHash:", commitmentHash);
        // console.log("nullifierHash:", nullifierHash);

        await commitmentHasherCircuit.assertOut(w, {commitmentHash: commitmentHash, 
                                                    nullifierHash: nullifierHash});    
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

