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
        const preimage = Buffer.concat([
                                        Buffer.from(bigInt2BytesLE(transaction.nullifier, 31)),
                                        Buffer.from(bigInt2BytesLE(transaction.secret, 31)),
                                        Buffer.from(bigInt2BytesLE(transaction.amount, 31))
                                    ])

        transaction.commitmentHash = hasherFunc(preimage);

        return transaction;
    };

    const packProofData = (_proof) => {
            return [
                _proof.pi_a[0], _proof.pi_a[1],
                _proof.pi_b[0][1], _proof.pi_b[0][0], _proof.pi_b[1][1], _proof.pi_b[1][0],
                _proof.pi_c[0], _proof.pi_c[1],
            ]
        };

    const verifyMerklePath = (_merkleTree, _treeLevel, _commitment, _callLog) => {
        _callLog.event.should.be.equal('InsertCommitment');
        _callLog.args.commitment.should.be.equal(toFixedHex(_commitment));
        _callLog.args.root.should.be.equal(toFixedHex(_merkleTree.root));

        const {pathElements, pathIndices} = _merkleTree.proof(_commitment);
        const contractPathIndices = bits2PathIndices(Number(_callLog.args.pathIndices), _treeLevel);
        // console.log(contractPathIndices, pathIndices)
        pathIndices.join().should.be.equal(contractPathIndices.join());

        _callLog.args.pathElements.forEach((n, k) => {
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
            globalTree = new MerkleTree(TREE_LEVELS, [], { hashFunction: mimcHasher, zeroElement: ZERO_VALUE});
            commitment_verification_key = JSON.parse(fs.readFileSync(CommitmentCircuitVerificationKey));
    })

    describe('#Commitment Verification', () => {
        it('Should allow operator register comment if not exists', async () => {
            let commitment = bigInt(42);
            let amount = bigInt(100);
            
            let isExists = await paypalUSDCAssetPool.commitmentExists(toFixedHex(commitment));
            isExists.should.equal(false);

            await paypalUSDCAssetPool.registerCommitment(toFixedHex(commitment), amount.toString(), {from: OPERATOR });
            isExists = await paypalUSDCAssetPool.commitmentExists(toFixedHex(commitment));
            isExists.should.equal(true);

            await paypalUSDCAssetPool.registerCommitment(toFixedHex(commitment), amount.toString())
                    .should.be.rejectedWith('The commitment already exists');
        })

        it('Should only allow contract owner to register commitment', async () => {
            const commitment = bigInt(33);
            let amount = bigInt(100);
    
            await paypalUSDCAssetPool.registerCommitment(toFixedHex(commitment), amount.toString(), {from: SENDER })
                .should.be.rejectedWith('Ownable: caller is not the owner');
        })

        it('Should generte correct proof and detect tampering by SnarkJS', async () => {
            const transaction = generateTransaction(pedersenHasher);
        
            const input = { 
                            commitmentHash: transaction.commitmentHash.toString(),
                            amount: transaction.amount.toString(),
                            nullifier: transaction.nullifier.toString(),
                            secret: transaction.secret.toString()
                        };
            // console.log(input)
    
            const {proof, publicSignals} = await snarkjs.groth16.fullProve(
                                                                            input,
                                                                            CommitmentCircuitWASMFile,
                                                                            CommitmentCircuitKey
                                                                            );
            
    
            let result = await snarkjs.groth16.verify(commitment_verification_key, publicSignals, proof);
            result.should.be.equal(true);

            // Try to cheat with wrong amount
            let publicSignalsCopy = JSON.parse(JSON.stringify(publicSignals));
            publicSignalsCopy[1] = '100'
            result  = await snarkjs.groth16.verify(commitment_verification_key, publicSignalsCopy, proof);
            result.should.be.equal(false);
        })

        it('Should insert commitment if proof is valid', async () => {
            const transaction = generateTransaction(pedersenHasher);
        
            const input = { 
                            commitmentHash: transaction.commitmentHash.toString(),
                            amount: transaction.amount.toString(),
                            nullifier: transaction.nullifier.toString(),
                            secret: transaction.secret.toString()
                        };
            
            const {proof, publicSignals} = await snarkjs.groth16.fullProve(
                                                                            input,
                                                                            CommitmentCircuitWASMFile,
                                                                            CommitmentCircuitKey
                                                                            );
            
            const proofData = packProofData(proof);
            
            await paypalUSDCAssetPool.registerCommitment(toFixedHex(input.commitmentHash), input.amount, {from: OPERATOR });
            const { logs } = await paypalUSDCAssetPool.proveCommitment(proofData, publicSignals, { from: RELAYER});
            logs[0].event.should.be.equal('InsertCommitment');
            logs[0].args.commitment.should.be.equal(toFixedHex(input.commitmentHash));
        })
    })

    describe('#Withdral', () =>{

    })
})
