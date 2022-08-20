require('chai').use(require('bn-chai')(web3.utils.BN)).use(require('chai-as-promised')).should()

const fs = require('fs');
const { toBN } = require('web3-utils');

const Hasher = artifacts.require("Hasher");
const CommitmentVerifier = artifacts.require('CommitmentVerifier');
const WithdrawalVerifier = artifacts.require('WithdrawalVerifier');
const FakeUSDC = artifacts.require('FakeUSDC');
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
const WithdrawalCircuitWASMFile = "./support/withdrawal.wasm";
const WithdrawalCircuitKey = "./support/circuit_withdrawal_final.zkey";
const WithdrawalCircuitVerificationKey = "./support/withdrawal_verification_key.json";

const bits2PathIndices = (_bitmap, _length) => {
    const bits = Number(_bitmap).toString(2).split('').map(b => b - '0');
    
    return Array(_length - bits.length).fill(0).concat(bits)
}

const getFee = (_amount) => {
    return toBN(_amount).mul(toBN(4)).div(toBN(100));
}

contract('AssetPool Test', accounts => {
    const ZERO_VALUE = bigInt('890052662763911307850778159620885184910760398780342638619984914703804053834').value; // = keccak256("zkMarket.Finance") % FIELD_SIZE
    const RELAYER = accounts[1];
    const SELLER = accounts[2];
    const OPERATOR = accounts[0];
    const RECIPIENT = accounts[2];
    const TREE_LEVELS = MERKLE_TREE_HEIGHT || 16;
    const SELL_VALUE = COIN_AMOUNT || '100000000'; // 1 ether

    //Global variables
    let mimcHasher;
    let pedersenHasher;

    //Global functions
    const rbigint = (nbytes) => bigInt.randBetween(0, bigInt(2).pow(nbytes * 8));
    const toFixedHex = (number, length = 32) => '0x' + bigInt(number).toString(16).padStart(length * 2, '0');

    const generateCommitment = (hasherFunc, 
                                _amount = rbigint(31),
                                _secret = rbigint(31), 
                                _nullifier = rbigint(31)
                                ) => {
        const preimage = Buffer.concat([
                                        Buffer.from(bigInt2BytesLE(_nullifier, 31)),
                                        Buffer.from(bigInt2BytesLE(_secret, 31)),
                                        Buffer.from(bigInt2BytesLE(_amount, 31))
                                    ])

        let commitmentHash = hasherFunc(preimage);

        return {
            commitmentHash: commitmentHash.toString(),
            amount: _amount.toString(),
            nullifier: _nullifier.toString(),
            secret: _secret.toString()
        };
    };

    const packProofData = (_proof) => {
            return [
                _proof.pi_a[0], _proof.pi_a[1],
                _proof.pi_b[0][1], _proof.pi_b[0][0], _proof.pi_b[1][1], _proof.pi_b[1][0],
                _proof.pi_c[0], _proof.pi_c[1],
            ]
    };

    const verifyMerklePath = (_merkleTree, _treeLevel, _commitmentHash, _callLog) => {
        _callLog.event.should.be.equal('InsertCommitment');
        _callLog.args.commitment.should.be.equal(toFixedHex(_commitmentHash));
        _callLog.args.root.should.be.equal(toFixedHex(_merkleTree.root));

        const {pathElements, pathIndices} = _merkleTree.proof(_commitmentHash);
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

            commitment_verification_key = JSON.parse(fs.readFileSync(CommitmentCircuitVerificationKey));
            withdrawal_verification_key = JSON.parse(fs.readFileSync(WithdrawalCircuitVerificationKey));
    })

    describe('#Commitment Verification', () => {
        let paypalUSDCAssetPool;

        before(async () => {   
            paypalUSDCAssetPool = await PaypalUSDCAssetPool.new(
                CommitmentVerifier.address,
                WithdrawalVerifier.address,
                Hasher.address,
                TREE_LEVELS,
                FakeUSDC.address,
                {from: OPERATOR}
            );
        });      

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
    
            await paypalUSDCAssetPool.registerCommitment(toFixedHex(commitment), amount.toString(), {from: SELLER })
                .should.be.rejectedWith('Ownable: caller is not the owner');
        })

        it('Should generte correct proof and detect tampering by SnarkJS', async () => {
            const commitment = generateCommitment(pedersenHasher);
           
            const {proof, publicSignals} = await snarkjs.groth16.fullProve(
                                                                            commitment,
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
            const commitment = generateCommitment(pedersenHasher);
        
            const {proof, publicSignals} = await snarkjs.groth16.fullProve(
                commitment,
                                                                            CommitmentCircuitWASMFile,
                                                                            CommitmentCircuitKey
                                                                            );
            
            const proofData = packProofData(proof);
            
            await paypalUSDCAssetPool.registerCommitment(toFixedHex(commitment.commitmentHash), commitment.amount, {from: OPERATOR });
            const { logs } = await paypalUSDCAssetPool.proveCommitment(proofData, publicSignals, { from: RELAYER});
            logs[0].event.should.be.equal('InsertCommitment');
            logs[0].args.commitment.should.be.equal(toFixedHex(commitment.commitmentHash));
        })

        it('Should only allow commitment that match correct amount to be inserted', async () => {
            const commitment = generateCommitment(pedersenHasher);
            
            await paypalUSDCAssetPool.registerCommitment(toFixedHex(commitment.commitmentHash), commitment.amount, {from: OPERATOR });

            const fake_commitment = generateCommitment(pedersenHasher, commitment.secret, commitment.nullifier, bigInt(commitment.amount).add(1));
            const {proof, publicSignals} = await snarkjs.groth16.fullProve(
                                                                            fake_commitment,
                                                                            CommitmentCircuitWASMFile,
                                                                            CommitmentCircuitKey
                                                                            );
            
            const proofData = packProofData(proof);
            publicSignals[0] = commitment.commitmentHash;
            
            await paypalUSDCAssetPool.proveCommitment(proofData, publicSignals, {from: RELAYER})
                .should.be.rejectedWith('Amount mismatch');
        })
    })

    describe('#Withdral', () =>{
        let paypalUSDCAssetPool;
        let usdcToken;
        let merkleTree;

        before(async () => {
            usdcToken = await FakeUSDC.new(1000000 * (10 ** 6));  
            paypalUSDCAssetPool = await PaypalUSDCAssetPool.new(
                CommitmentVerifier.address,
                WithdrawalVerifier.address,
                Hasher.address,
                TREE_LEVELS,
                usdcToken.address,
                {from: OPERATOR}
            );
            merkleTree = new MerkleTree(TREE_LEVELS, [], { hashFunction: mimcHasher, zeroElement: ZERO_VALUE});
            
            //Make deposit to the asset pool
            const sellerDepositAmount = toBN(SELL_VALUE).mul(toBN(10));
            await usdcToken.transfer(SELLER, sellerDepositAmount)
            await usdcToken.approve(paypalUSDCAssetPool.address, sellerDepositAmount, {from: SELLER});
            await paypalUSDCAssetPool.sellerDeposit("test@test.com", sellerDepositAmount, {from: SELLER});
        });

        it('Should withdraw only once by presenting valid proof', async () => {
            commitment = generateCommitment(
                                            pedersenHasher, 
                                            SELL_VALUE
                                            );

            merkleTree.insert(commitment.commitmentHash);

            // Prove and insert commitment
            let {proof, publicSignals} = await snarkjs.groth16.fullProve(
                                                                            commitment,
                                                                            CommitmentCircuitWASMFile,
                                                                            CommitmentCircuitKey
                                                                            );

            let proofData = packProofData(proof);
            const fee = getFee(commitment.amount);

            await paypalUSDCAssetPool.registerCommitment(toFixedHex(commitment.commitmentHash), commitment.amount, {from: OPERATOR });
            let { logs } = await paypalUSDCAssetPool.proveCommitment(proofData, publicSignals, { from: RELAYER});
   
            //Verify commitment has been inserted correctly
            verifyMerklePath(merkleTree, TREE_LEVELS, commitment.commitmentHash, logs[0]);
          
            // Prepare proof
            const { pathElements, pathIndices } =  merkleTree.proof(commitment.commitmentHash);
            // Circuit input
            const withdrawalInput = {
                root: merkleTree.root.toString(),
                nullifierHash: pedersenHasher(bigInt2BytesLE(commitment.nullifier, 31)).toString(),
                recipient: bigInt(RECIPIENT.slice(2), 16).toString(),
                amount: commitment.amount,
                relayer: bigInt(RELAYER.slice(2), 16).toString(),
                fee: fee.toString(),
                nullifier: commitment.nullifier,
                secret: commitment.secret,
                pathElements: pathElements,
                pathIndices: pathIndices,
            };

            let isSpent = await paypalUSDCAssetPool.isSpent(toFixedHex(withdrawalInput.nullifierHash));
            isSpent.should.be.equal(false);

            ;({proof, publicSignals} = await snarkjs.groth16.fullProve(
                                                                        withdrawalInput,
                                                                        WithdrawalCircuitWASMFile,
                                                                        WithdrawalCircuitKey
                                                                        ));
            

            proofData = packProofData(proof);    
           
            const balanceAssetPoolBefore = await paypalUSDCAssetPool.getBalance(paypalUSDCAssetPool.address);
            const balanceRelayerBefore = await paypalUSDCAssetPool.getBalance(RELAYER);
            const balanceRecipientBefore = await paypalUSDCAssetPool.getBalance(RECIPIENT);
    
            ;({ logs } = await paypalUSDCAssetPool.withdraw(proofData, publicSignals, {from: RELAYER}));
           
            const balanceAssetPoolAfter = await paypalUSDCAssetPool.getBalance(paypalUSDCAssetPool.address);
            const balanceRelayerAfter = await paypalUSDCAssetPool.getBalance(RELAYER);
            const balanceRecipientAfter = await paypalUSDCAssetPool.getBalance(RECIPIENT);

            // console.log("Fee:", fee.toString());
            // console.log("AssetPool:", balanceAssetPoolBefore.toString(), "->", balanceAssetPoolAfter.toString());
            // console.log("Recipient:", balanceRecipientBefore.toString(), "->", balanceRecipientAfter.toString());
            // console.log("Relayer:", balanceRelayerBefore.toString(), "->", balanceRelayerAfter.toString());

            const withdrawalAmount = toBN(SELL_VALUE).sub(fee);            
            const relayerPay = toBN(balanceRelayerAfter).sub(balanceRelayerBefore);
            relayerPay.should.be.gt.BN(toBN(0));            
            balanceRecipientAfter.should.be.eq.BN(toBN(balanceRecipientBefore).add(withdrawalAmount));
            balanceAssetPoolAfter.should.be.eq.BN(toBN(balanceAssetPoolBefore).sub(withdrawalAmount).sub(relayerPay));            
           
            logs.length.should.be.equal(2);
            logs[0].event.should.be.equal('SellerPayouts');
            logs[0].args.amount.should.be.eq.BN(withdrawalAmount);
            logs[1].event.should.be.equal('Withdrawal');
            logs[1].args.to.should.be.equal(RECIPIENT);
            logs[1].args.amount.should.be.eq.BN(toBN(withdrawalInput.amount));
            logs[1].args.nullifierHash.should.be.equal(toFixedHex(withdrawalInput.nullifierHash))
            logs[1].args.relayer.should.be.equal(RELAYER)
            logs[1].args.fee.should.be.eq.BN(fee)
    
            //Check the nullifierHash is spent
            isSpent = await paypalUSDCAssetPool.isSpent(toFixedHex(withdrawalInput.nullifierHash))
            isSpent.should.be.equal(true)

            //Check same proof can't be used multiple times
            await paypalUSDCAssetPool.withdraw(proofData, publicSignals, { from: RELAYER})
                    .should.be.rejectedWith('The note has already been spent');
        })
    })
})