/* global artifacts */
require('dotenv').config({ path: '../.env' })
const bigInt = require('big-integer')
const PaypalUSDCAssetPool = artifacts.require('PaypalUSDCAssetPool')
const CommitmentVerifier = artifacts.require('CommitmentVerifier')
const Hasher = artifacts.require('Hasher')

module.exports = function (deployer) {
  return deployer.then(async () => {
    const { MERKLE_TREE_HEIGHT } = process.env
    const commitmentVerifier = await CommitmentVerifier.deployed()
    const hasher = await Hasher.deployed()
    
    await deployer.deploy(
      PaypalUSDCAssetPool,
      commitmentVerifier.address,
      hasher.address,
      MERKLE_TREE_HEIGHT,
    )
  })
}
