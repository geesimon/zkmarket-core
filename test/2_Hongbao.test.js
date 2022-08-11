/* global artifacts, web3, contract */
require('chai').use(require('bn-chai')(web3.utils.BN)).use(require('chai-as-promised')).should()

const fs = require('fs');
const { toBN } = require('web3-utils');
// const { takeSnapshot, revertSnapshot } = require('../scripts/ganacheHelper')

const Hasher = artifacts.require("Hasher");
const Verifier = artifacts.require('Verifier');
const ETHHongbao = artifacts.require("ETHHongbao");
const CampaignManager = artifacts.require("CampaignManager");
const { ETH_AMOUNT, MERKLE_TREE_HEIGHT } = process.env;

const snarkjs = require('snarkjs');
const bigInt = require("big-integer");
const circomlibjs = require('circomlibjs');
// const stringifyBigInts = require('wasmsnark/tools/stringifybigint').stringifyBigInts;
// const unstringifyBigInts = require('wasmsnark/tools/stringifybigint').unstringifyBigInts;
const bigInt2BytesLE = require('wasmsnark/src/utils.js').bigInt2BytesLE

const MerkleTree = require('fixed-merkle-tree').MerkleTree;
const wasm_tester = require("circom_tester").wasm;

const CircuitWASMFile = "./support/withdraw.wasm";
const CircuitKey = "./support/circuit_withdraw_final.zkey";
const CircuitVerificationKey = "./support/withdraw_verification_key.json"

const bits2PathIndices = (_bitmap, _length) => {
  const bits = Number(_bitmap).toString(2).split('').map(b => b - '0');
  
  return Array(_length - bits.length).fill(0).concat(bits)
}



contract('ETHHongbao Test', accounts => {    
  const FIELD_SIZE = bigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
  const ZERO_VALUE = bigInt('8568824596295711272276493421173227402986947053170746004488571001319888434851').value; // = keccak256("hongbao") % FIELD_SIZE
  const FEE = bigInt(ETH_AMOUNT).shiftRight(2) || bigInt(1e18);
  const REFUND = bigInt(0);
  const RELAYER = accounts[1];
  const SENDER = accounts[1];
  const OPERATOR = accounts[0];
  const TREE_LEVELS = MERKLE_TREE_HEIGHT || 16;
  const SEND_VALUE = ETH_AMOUNT || '1000000000000000000'; // 1 ether

  //Global variables
  let globalHongbao;
  let globalTree;
  let verification_key;
  let snapshotId;
  const recipient = bigInt('487172757523314974230380602342170278865169124390').value;
  let mimcHasher;
  let pedersenHasher;

  //Global functions
  const rbigint = (nbytes) => bigInt.randBetween(0, bigInt(2).pow(nbytes * 8));
  const toFixedHex = (number, length = 32) => '0x' + bigInt(number).toString(16).padStart(length * 2, '0');

  const generateDeposit = (hasherFunc) => {
    let deposit = {
      secret: rbigint(31),
      nullifier: rbigint(31),
    }
    // const preimage = Buffer.concat([deposit.nullifier.leInt2Buff(31), deposit.secret.leInt2Buff(31)])
    const preimage = Buffer.concat([
                                    Buffer.from(bigInt2BytesLE(deposit.nullifier, 31)),
                                    Buffer.from(bigInt2BytesLE(deposit.secret, 31)),
                                  ])

    deposit.commitment = hasherFunc(preimage)  
    return deposit
  };

  const packProofData = (proof) => {
    // return [
    //     toFixedHex(proof.pi_a[0]), toFixedHex(proof.pi_a[1]),
    //     toFixedHex(proof.pi_b[0][1]), toFixedHex(proof.pi_b[0][0]), 
    //     toFixedHex(proof.pi_b[1][1]), toFixedHex(proof.pi_b[1][0]),
    //     toFixedHex(proof.pi_c[0]), toFixedHex(proof.pi_c[1]),
    //   ]
    return [
      proof.pi_a[0], proof.pi_a[1],
      proof.pi_b[0][1], proof.pi_b[0][0], proof.pi_b[1][1], proof.pi_b[1][0],
      proof.pi_c[0], proof.pi_c[1],
    ]
  };

  const verifyMerklePath = (merkleTree, treeLevel, commitment, callLog) => {
    callLog.event.should.be.equal('Deposit');
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

    globalHongbao = await ETHHongbao.new(
                                  Verifier.address,
                                  Hasher.address,
                                  SEND_VALUE,
                                  TREE_LEVELS,
                                  {from: OPERATOR}
                                );
    globalTree = new MerkleTree(TREE_LEVELS, [], { hashFunction: mimcHasher, zeroElement: ZERO_VALUE});
    verification_key = JSON.parse(fs.readFileSync(CircuitVerificationKey));
  })

  describe('#constructor', () => {
    it('should initialize', async () => {
      const etherDenomination = await globalHongbao.denomination();
      etherDenomination.should.be.eq.BN(SEND_VALUE);
    })
  })
  describe('#deposit', () => {
    it('should emit event', async () => {
      let commitment = bigInt(42);
      let { logs } = await globalHongbao.deposit(toFixedHex(commitment), { value: SEND_VALUE, from: SENDER });
      globalTree.insert(commitment);
      verifyMerklePath(globalTree, TREE_LEVELS, commitment, logs[0]);
      // logs[0].event.should.be.equal('Deposit');
      // logs[0].args.commitment.should.be.equal(commitment);
      // logs[0].args.leafIndex.should.be.eq.BN(0);

      commitment = bigInt(12);
      ;({ logs } = await globalHongbao.deposit(toFixedHex(commitment), {value: SEND_VALUE, from: accounts[2] }))
      globalTree.insert(commitment);
      verifyMerklePath(globalTree, TREE_LEVELS, commitment, logs[0]);

      // logs[0].event.should.be.equal('Deposit');
      // logs[0].args.commitment.should.be.equal(commitment);
      // logs[0].args.leafIndex.should.be.eq.BN(1);
    })

    it('should throw if there is a such commitment', async () => {
      const commitment = bigInt(33);
      let { logs } = await globalHongbao.deposit(toFixedHex(commitment), { value: SEND_VALUE, from: SENDER });
      globalTree.insert(commitment);
      verifyMerklePath(globalTree, TREE_LEVELS, commitment, logs[0]);

      await globalHongbao.deposit(toFixedHex(commitment), { value: SEND_VALUE, from: SENDER })
            .should.be.rejectedWith('The commitment has been submitted');
    })
  })

  describe('snark proof verification on js side', () => {
    let local_tree;

    before(async () => {    
      local_tree = new MerkleTree(TREE_LEVELS, [], { hashFunction: mimcHasher, zeroElement: ZERO_VALUE});
    });

    it('should detect tampering', async () => {
      const deposit = generateDeposit(pedersenHasher);
      local_tree.insert(deposit.commitment);
      const {pathElements, pathIndices} = local_tree.proof(deposit.commitment);
    
      const input = { 
                      root: local_tree.root.toString(),
                      nullifier: deposit.nullifier.toString(),
                      nullifierHash: pedersenHasher(bigInt2BytesLE(deposit.nullifier, 31)).toString(),
                      secret: deposit.secret.toString(),
                      pathElements: pathElements,
                      pathIndices: pathIndices,
                      recipient: recipient.toString(),
                      relayer: bigInt(OPERATOR.slice(2), 16).toString(),
                      fee: FEE.toString(),
                      refund: REFUND.toString(),
                    };
      // console.log(input)

      const {proof, publicSignals} = await snarkjs.groth16.fullProve(
                                                    input,
                                                    CircuitWASMFile,
                                                    CircuitKey
                                                    );
      

      let result = await snarkjs.groth16.verify(verification_key, publicSignals, proof);
      result.should.be.equal(true);

      // Try to cheat with wrong nullifierhash
      let publicSignalsCopy = JSON.parse(JSON.stringify(publicSignals));
      publicSignalsCopy[1] =
        '133792158246920651341275668520530514036799294649489851421007411546007850802'
      result  = await snarkjs.groth16.verify(verification_key, publicSignalsCopy, proof);
      result.should.be.equal(false);


      // try to cheat with recipient
      publicSignalsCopy = JSON.parse(JSON.stringify(publicSignals));
      publicSignalsCopy[2] = '133738360804642228759657445999390850076318544422';
      result  = await snarkjs.groth16.verify(verification_key, publicSignalsCopy, proof);
      result.should.be.equal(false);


      // Try to cheat with fee
      publicSignalsCopy = JSON.parse(JSON.stringify(publicSignals));
      publicSignalsCopy[4] = '1337100000000000000000';
      result  = await snarkjs.groth16.verify(verification_key, publicSignalsCopy, proof);
      result.should.be.equal(false);
    })
  })

  describe('#withdraw', () => {    
    it('should work', async () => {
        const deposit = generateDeposit(pedersenHasher);
        globalTree.insert(deposit.commitment);
          
        // const gasPrice = await web3.eth.getGasPrice();
        // let gas = await globalHongbao.deposit.estimateGas(toFixedHex(deposit.commitment), {SEND_VALUE, from: SENDER});
        // let gasCost = bigInt(gas).multiply(gasPrice);
        // console.log('gasCost:', gasCost);

        // Deposit and check balance
        let balanceHongbaoBefore = await web3.eth.getBalance(globalHongbao.address);
        let balanceSenderBefore = await web3.eth.getBalance(SENDER.toString());
        
        let res = await globalHongbao.deposit(toFixedHex(deposit.commitment), { value:SEND_VALUE, from: SENDER});

        verifyMerklePath(globalTree, TREE_LEVELS, deposit.commitment, res.logs[0]);

        let balanceHongbaoAfter = await web3.eth.getBalance(globalHongbao.address);
        let balanceSenderAfter = await web3.eth.getBalance(SENDER.toString());
        
        balanceHongbaoAfter.should.be.eq.BN(toBN(balanceHongbaoBefore).add(toBN(SEND_VALUE)));
        balanceSenderAfter.should.be.lt.BN(toBN(balanceSenderBefore).sub(toBN(SEND_VALUE))); // new_balance = previous_balance - send_amount - gas
  
        // Prepare proof
        const { pathElements, pathIndices } =  globalTree.proof(deposit.commitment);
        // Circuit input
        const input = { 
          root: globalTree.root.toString(),
          nullifier: deposit.nullifier.toString(),
          nullifierHash: pedersenHasher(bigInt2BytesLE(deposit.nullifier, 31)).toString(),
          secret: deposit.secret.toString(),
          pathElements: pathElements,
          pathIndices: pathIndices,
          recipient: recipient.toString(),
          relayer: bigInt(RELAYER.slice(2), 16).toString(),
          fee: FEE.toString(),
          refund: REFUND.toString(),
        };

        const {proof, publicSignals} = await snarkjs.groth16.fullProve(
                                                                        input,
                                                                        CircuitWASMFile,
                                                                        CircuitKey
                                                                      );
        // let result = await snarkjs.groth16.verify(verification_key, publicSignals, proof);
        // result.should.be.equal(true);
        // console.log(publicSignals);
        
        let isSpent = await globalHongbao.isSpent(toFixedHex(input.nullifierHash));
        isSpent.should.be.equal(false);

        // const pubString = unstringifyBigInts(publicSignals);
        // const proofString = unstringifyBigInts(proof);
        // const callData = await snarkjs.groth16.exportSolidityCallData(proofString, pubString);
        // console.log("exportSolidityCallData:", callData);        

        const proofData = packProofData(proof);
        // const publicInputs = [
        //   toFixedHex(input.root),
        //   toFixedHex(input.nullifierHash),
        //   toFixedHex(input.recipient),
        //   toFixedHex(input.relayer),
        //   toFixedHex(input.fee),
        //   toFixedHex(input.refund),
        // ];
        // console.log("proof data:", proofData);
        // console.log("public inputs:", publicSignals)          

        balanceHongbaoBefore = await web3.eth.getBalance(globalHongbao.address);
        const balanceRelayerBefore = await web3.eth.getBalance(RELAYER.toString());
        const balanceReceiverBefore = await web3.eth.getBalance(toFixedHex(recipient, 20));

        const { logs } = await globalHongbao.withdraw(proofData, publicSignals, { from: RELAYER});
       
        balanceHongbaoAfter = await web3.eth.getBalance(globalHongbao.address);
        const balanceRelayerAfter = await web3.eth.getBalance(RELAYER.toString());
        const balanceReceiverAfter = await web3.eth.getBalance(toFixedHex(recipient, 20));
        const feeBN = toBN(FEE.toString());
        balanceHongbaoAfter.should.be.eq.BN(toBN(balanceHongbaoBefore).sub(toBN(SEND_VALUE)));
        balanceRelayerAfter.should.be.gt.BN(toBN(balanceRelayerBefore));  
        balanceReceiverAfter.should.be.gt.BN(toBN(balanceReceiverBefore));
  
        logs[0].event.should.be.equal('Withdrawal')
        logs[0].args.nullifierHash.should.be.equal(toFixedHex(input.nullifierHash))
        logs[0].args.relayer.should.be.eq.BN(RELAYER)
        logs[0].args.fee.should.be.eq.BN(feeBN)

        //Check the commitment is spent
        isSpent = await globalHongbao.isSpent(toFixedHex(input.nullifierHash))
        isSpent.should.be.equal(true)
    })
    it('should prevent double spend', async () => {
      const deposit = generateDeposit(pedersenHasher);

      globalTree.insert(deposit.commitment);
      let res = await globalHongbao.deposit(toFixedHex(deposit.commitment), { value: SEND_VALUE, from: SENDER });
      
      verifyMerklePath(globalTree, TREE_LEVELS, deposit.commitment, res.logs[0]);      

      const { pathElements, pathIndices } = globalTree.proof(deposit.commitment);

      const input = { 
        root: globalTree.root.toString(),
        nullifier: deposit.nullifier.toString(),
        nullifierHash: pedersenHasher(bigInt2BytesLE(deposit.nullifier, 31)).toString(),
        secret: deposit.secret.toString(),
        pathElements: pathElements,
        pathIndices: pathIndices,
        recipient: recipient.toString(),
        relayer: bigInt(RELAYER.slice(2), 16).toString(),
        fee: FEE.toString(),
        refund: REFUND.toString(),
      };
      const {proof, publicSignals} = await snarkjs.groth16.fullProve(
                                                                      input,
                                                                      CircuitWASMFile,
                                                                      CircuitKey
                                                                    );
      const proofData = packProofData(proof);
      await globalHongbao.withdraw(proofData, publicSignals, { from: RELAYER}).should.be.fulfilled;

      await globalHongbao.withdraw(proofData, publicSignals, { from: RELAYER }).
                    should.be.rejectedWith('The note has been already spent');
    })
  })
})
