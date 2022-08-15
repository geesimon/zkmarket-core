require('chai').use(require('bn-chai')(web3.utils.BN)).use(require('chai-as-promised')).should()

const fs = require('fs');
const { toBN } = require('web3-utils');

const Hasher = artifacts.require("Hasher");
const CommitmentVerifier = artifacts.require('CommitmentVerifier');
const PaypalUSDCAssetPool = artifacts.require("PaypalUSDCAssetPool");
const { COIN_AMOUNT, MERKLE_TREE_HEIGHT } = process.env;

const snarkjs = require('snarkjs');
const bigInt = require("big-integer");
const circomlibjs = require('circomlibjs');
const bigInt2BytesLE = require('wasmsnark/src/utils.js').bigInt2BytesLE
const MerkleTree = require('fixed-merkle-tree').MerkleTree;

const CommitmentCircuitWASMFile = "./support/commitment.wasm";
const CommitmentCircuitKey = "./support/circuit_commitment_final.zkey";
const CommitmentCircuitVerificationKey = "./support/commitment_verification_key.json"

const bits2PathIndices = (_bitmap, _length) => {
    const bits = Number(_bitmap).toString(2).split('').map(b => b - '0');
    
    return Array(_length - bits.length).fill(0).concat(bits)
}

contract('AssetPool Test', accounts => {
    const ZERO_VALUE = bigInt('890052662763911307850778159620885184910760398780342638619984914703804053834').value; // = keccak256("zkMarket.Finance") % FIELD_SIZE
    const FEE = bigInt(COIN_AMOUNT).shiftRight(2) || bigInt(1e18);
    const REFUND = bigInt(0);
    const RELAYER = accounts[1];
    const SENDER = accounts[1];
    const OPERATOR = accounts[0];
    const TREE_LEVELS = MERKLE_TREE_HEIGHT || 16;
    const SEND_VALUE = COIN_AMOUNT || '1000000000000000000'; // 1 ether

    //Global variables
    let paypalUSDCAssetPool;
    let globalTree;
    let commitment_verification_key;
    const recipient = bigInt('487172757523314974230380602342170278865169124390').value;
    let mimcHasher;
    let pedersenHasher;

    //Global functions
    const rbigint = (nbytes) => bigInt.randBetween(0, bigInt(2).pow(nbytes * 8));
    const toFixedHex = (number, length = 32) => '0x' + bigInt(number).toString(16).padStart(length * 2, '0');

    const generateTransaction = (hasherFunc) => {
        let transaction = {
            secret: rbigint(31),
            nullifier: rbigint(31),
            amount: rbigint(31),
        };
        // const preimage = Buffer.concat([deposit.nullifier.leInt2Buff(31), deposit.secret.leInt2Buff(31)])
        const preimage = Buffer.concat([
                                        Buffer.from(bigInt2BytesLE(deposit.nullifier, 31)),
                                        Buffer.from(bigInt2BytesLE(deposit.secret, 31)),
                                        Buffer.from(bigInt2BytesLE(deposit.amount, 31))
                                    ])

        transaction.commitment = hasherFunc(preimage);

        return transaction;
    };

    const packProofData = (proof) => {
            return [
                proof.pi_a[0], proof.pi_a[1],
                proof.pi_b[0][1], proof.pi_b[0][0], proof.pi_b[1][1], proof.pi_b[1][0],
                proof.pi_c[0], proof.pi_c[1],
            ]
        };

    const verifyMerklePath = (merkleTree, treeLevel, commitment, callLog) => {
        callLog.event.should.be.equal('InsertCommitment');
        callLog.args.commitment.should.be.equal(toFixedHex(commitment));
        callLog.args.root.should.be.equal(toFixedHex(merkleTree.root));

        const {pathElements, pathIndices} = merkleTree.proof(commitment);
        const contractPathIndices = bits2PathIndices(Number(callLog.args.pathIndices), treeLevel);
        // console.log(contractPathIndices, pathIndices)
        pathIndices.join().should.be.equal(contractPathIndices.join());

        callLog.args.pathElements.forEach((n, k) => {
            let n1 = bigInt(n.slice(2), 16).toString()
            let n2 = bigInt(pathElements[k]).toString();
            // console.log("tree:", n1, "contract:", n2);
            n1.should.be.equal(n2);
        })
    }

    before(async () => {
            let pedersenHash = await circomlibjs.buildPedersenHash();
            let babyJub = await circomlibjs.buildBabyjub();
            let mimcSponge = await circomlibjs.buildMimcSponge();

            pedersenHasher = (data) => babyJub.F.toObject(babyJub.unpackPoint(pedersenHash.hash(data))[0]);
            mimcHasher = (left, right) => mimcSponge.F.toObject(mimcSponge.hash(left, right, 0).xL);

            paypalUSDCAssetPool = await PaypalUSDCAssetPool.new(
                                        CommitmentVerifier.address,
                                        Hasher.address,
                                        TREE_LEVELS,
                                        {from: OPERATOR}
                                        );
            merkleTree = new MerkleTree(TREE_LEVELS, [], { hashFunction: mimcHasher, zeroElement: ZERO_VALUE});
            commitment_verification_key = JSON.parse(fs.readFileSync(CommitmentCircuitVerificationKey));
    })

  describe('#Commitment Verification', () => {
    it('Should allow paypal relayer register comment', async () => {
        let commitment = bigInt(42);
        let amount = bigInt(100);
        
        let isExists = await paypalUSDCAssetPool.commitmentExists(toFixedHex(commitment));
        isExists.should.equal(false);

        await paypalUSDCAssetPool.registerCommitment(toFixedHex(commitment), amount.toString());
        isExists = await paypalUSDCAssetPool.commitmentExists(toFixedHex(commitment));
        isExists.should.equal(true);
    })

    // it('should throw if the commitment already exists', async () => {
    //     const commitment = bigInt(33);
    //     let { logs } = await globalHongbao.deposit(toFixedHex(commitment), { value: SEND_VALUE, from: SENDER });
    //     globalTree.insert(commitment);
    //     verifyMerklePath(globalTree, TREE_LEVELS, commitment, logs[0]);
  
    //     await globalAssetPool.deposit(toFixedHex(commitment), { value: SEND_VALUE, from: SENDER })
    //           .should.be.rejectedWith('The commitment has been submitted');
    // })

    // it('Should emit event once a commitment is proven', async () => {
    //     let commitment = bigInt(42);
    //     let { logs } = await globalAssetPool.deposit(toFixedHex(commitment), { value: SEND_VALUE, from: SENDER });
    //     globalTree.insert(commitment);
    //     verifyMerklePath(globalTree, TREE_LEVELS, commitment, logs[0]);
    //     // logs[0].event.should.be.equal('Deposit');
    //     // logs[0].args.commitment.should.be.equal(commitment);
    //     // logs[0].args.leafIndex.should.be.eq.BN(0);

    //     commitment = bigInt(12);
    //     ;({ logs } = await globalAssetPool.deposit(toFixedHex(commitment), {value: SEND_VALUE, from: accounts[2] }))
    //     globalTree.insert(commitment);
    //     verifyMerklePath(globalTree, TREE_LEVELS, commitment, logs[0]);

    //     // logs[0].event.should.be.equal('Deposit');
    //     // logs[0].args.commitment.should.be.equal(commitment);
    //     // logs[0].args.leafIndex.should.be.eq.BN(1);
    // })
  })
})
