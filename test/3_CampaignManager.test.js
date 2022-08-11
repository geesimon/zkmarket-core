/* global artifacts, web3, contract */
require('chai').use(require('bn-chai')(web3.utils.BN)).use(require('chai-as-promised')).should()

const fs = require('fs');
const path = require("path");
const { toBN } = require('web3-utils');
// const { takeSnapshot, revertSnapshot } = require('../scripts/ganacheHelper')

const Hasher = artifacts.require("Hasher");
const Verifier = artifacts.require('Verifier');
const ETHHongbao = artifacts.require("ETHHongbao");
const CampaignManager = artifacts.require("CampaignManager");
const Campaign = artifacts.require("Campaign");
const { ETH_AMOUNT, MERKLE_TREE_HEIGHT } = process.env;

const snarkjs = require('snarkjs');
const bigInt = require("big-integer");
const circomlibjs = require('circomlibjs');
const bigInt2BytesLE = require('wasmsnark/src/utils.js').bigInt2BytesLE;

const CircuitWASMFile = "./support/withdraw.wasm";
const CircuitKey = "./support/circuit_withdraw_final.zkey";

// const MerkleTree = require('fixed-merkle-tree').MerkleTree;

const bits2PathIndices = (_bitmap, _length) => {
  const bits = Number(_bitmap).toString(2).split('').map(b => b - '0');
  
  return Array(_length - bits.length).fill(0).concat(bits)
}

contract ('CampainManager Test', accounts =>{
    const ZERO_VALUE = bigInt('8568824596295711272276493421173227402986947053170746004488571001319888434851').value; // = keccak256("hongbao") % FIELD_SIZE
    const FEE = bigInt(ETH_AMOUNT).shiftRight(2) || bigInt(1e18);
    const REFUND = bigInt(0);
    const RELAYER = accounts[1];
    const SENDER = accounts[1];
    const OPERATOR = accounts[0];
    const TREE_LEVELS = MERKLE_TREE_HEIGHT || 16;
    const SEND_VALUE = ETH_AMOUNT || '1000000000000000000'; // ETH_AMOUNT or 1 ether
    const OWNER = accounts[3];

    //Global variables
    let campaignManager;    
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
        return [
          proof.pi_a[0], proof.pi_a[1],
          proof.pi_b[0][1], proof.pi_b[0][0], proof.pi_b[1][1], proof.pi_b[1][0],
          proof.pi_c[0], proof.pi_c[1],
        ]
    };

    before(async () => { 
      let pedersenHash = await circomlibjs.buildPedersenHash();
      let babyJub = await circomlibjs.buildBabyjub();
      let mimcSponge = await circomlibjs.buildMimcSponge();
  
      pedersenHasher = (data) => babyJub.F.toObject(babyJub.unpackPoint(pedersenHash.hash(data))[0]);
      mimcHasher = (left, right) => mimcSponge.F.toObject(mimcSponge.hash(left, right, 0).xL);

      // campaignManager = await CampaignManager.deployed();
      globalHongbao = await ETHHongbao.new(
                                Verifier.address,
                                Hasher.address,
                                SEND_VALUE,
                                TREE_LEVELS,
                                {from: OPERATOR}
                                );
      campaignManager = await CampaignManager.new([globalHongbao.address]);

      // globalTree = new MerkleTree(TREE_LEVELS, [], { hashFunction: mimcHasher, zeroElement: ZERO_VALUE});      
    });
  
    describe('#constructor', () => {
      it('Should create compaign', async () => {
        let idsBefore = await campaignManager.getMyCampaignIDs({from: OWNER});
        await campaignManager.createCampaign("Hello",
                                            "World",
                                            {from: OWNER}
                                            ).should.be.fulfilled;
  
        let idsAfter = await campaignManager.getMyCampaignIDs({from: OWNER});
        
        idsAfter.length.should.be.eq.BN(idsBefore.length + 1);
      })
    })
  
    describe('#give', () =>{
      it('Should give money to a campaign anonymously', async () => {
        let ids = await campaignManager.getMyCampaignIDs({from: OWNER});
        let compaign = await campaignManager.getCampaignInfo(ids[0]);
        let recipient = compaign.campaignContract;

        const deposit = generateDeposit(pedersenHasher);
        const balanceSenderBefore = await web3.eth.getBalance(SENDER);

        // globalTree.insert(deposit.commitment);
        let { logs } = await globalHongbao.deposit(toFixedHex(deposit.commitment), { value: SEND_VALUE, from: SENDER });
        
        const balanceSenderAfter = await web3.eth.getBalance(SENDER);
        balanceSenderAfter.should.be.lt.BN(balanceSenderBefore.sub(SEND_VALUE));

        // const { pathElements, pathIndices } = globalTree.proof(deposit.commitment);
        const { root, pathElements, pathIndices } = logs[0].args;        

        const input = {
          root: root, //globalTree.root.toString(),
          nullifier: deposit.nullifier.toString(),
          nullifierHash: pedersenHasher(bigInt2BytesLE(deposit.nullifier, 31)).toString(),
          secret: deposit.secret.toString(),
          pathElements: pathElements,
          pathIndices: bits2PathIndices(pathIndices, TREE_LEVELS),
          recipient: recipient,
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

        let balanceRecipientBefore = await web3.eth.getBalance(recipient);
        await globalHongbao.withdraw(proofData, publicSignals, {from: RELAYER});

        const feeBN = toBN(FEE.toString());
        let balanceRecipientAfter = await web3.eth.getBalance(recipient);        
        balanceRecipientAfter.should.be.eq.BN(toBN(balanceRecipientBefore).add(toBN(SEND_VALUE)).sub(feeBN));
      });
  
      it('Should withdraw money by campaign owner', async () => {
        let ids = await campaignManager.getMyCampaignIDs({from: OWNER});
        let campaignInfo = await campaignManager.getCampaignInfo(ids[0]);
        let campaign = await Campaign.at(campaignInfo.campaignContract);

        // Only owner can withdraw
        await campaign.withdraw({from: OPERATOR}).should.be.rejected;
        
        let balanceBefore = await web3.eth.getBalance(OWNER);
        await campaign.withdraw({from: OWNER});
        
        let balanceAfter = await web3.eth.getBalance(OWNER);

        balanceAfter.should.be.gt.BN(balanceBefore);
      });
    })
  })