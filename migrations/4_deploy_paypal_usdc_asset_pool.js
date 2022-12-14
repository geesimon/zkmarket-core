/* global artifacts */
require('dotenv').config({ path: '../.env' })
const CommitmentVerifier = artifacts.require('CommitmentVerifier')
const WithdrawalVerifier = artifacts.require('WithdrawalVerifier')
const PaypalUSDCAssetPool = artifacts.require('PaypalUSDCAssetPool')
const FakeUSDC = artifacts.require('FakeUSDC')
const Hasher = artifacts.require('Hasher')

const { MERKLE_TREE_HEIGHT,
      TESTNET_USDC_ADDRESS,
      MAINNET_USDC_ADDRESS } = process.env

module.exports = function (deployer, network) {
  return deployer.then(async () => {    
    const commitmentVerifier = await CommitmentVerifier.deployed()
    const withdrawalVerifier = await WithdrawalVerifier.deployed()    
    const hasher = await Hasher.deployed()
    let usdcTokenAddress
    
    switch (network) {
      case 'develop':
          const fakeUSDC = await FakeUSDC.deployed();
          usdcTokenAddress = fakeUSDC.address;
          break;
      case 'mumbai': usdcTokenAddress = TESTNET_USDC_ADDRESS; break;
      case 'mainnet': usdcTokenAddress = MAINNET_USDC_ADDRESS; break;
      default: break;
    }
    console.log("Using USDC:", usdcTokenAddress);
    
    await deployer.deploy(
      PaypalUSDCAssetPool,
      commitmentVerifier.address,
      withdrawalVerifier.address,
      hasher.address,
      MERKLE_TREE_HEIGHT,
      usdcTokenAddress
    )
  })
}
