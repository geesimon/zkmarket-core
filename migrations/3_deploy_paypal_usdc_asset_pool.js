/* global artifacts */
require('dotenv').config({ path: '../.env' })
const CommitmentVerifier = artifacts.require('CommitmentVerifier')
const WithdrawalVerifier = artifacts.require('WithdrawalVerifier')
const PaypalUSDCAssetPool = artifacts.require('PaypalUSDCAssetPool')

const Hasher = artifacts.require('Hasher')

module.exports = function (deployer) {
  return deployer.then(async () => {
    const { MERKLE_TREE_HEIGHT } = process.env
    const commitmentVerifier = await CommitmentVerifier.deployed()
    const withdrawalVerifier = await WithdrawalVerifier.deployed()

    const hasher = await Hasher.deployed()
    
    await deployer.deploy(
      PaypalUSDCAssetPool,
      commitmentVerifier.address,
      withdrawalVerifier.address,
      hasher.address,
      MERKLE_TREE_HEIGHT,
    )
  })
}
