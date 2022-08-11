/* global artifacts */
require('dotenv').config({ path: '../.env' })
const bigInt = require('big-integer')
const ETHHongbao = artifacts.require('ETHHongbao')
const Verifier = artifacts.require('Verifier')
const Hasher = artifacts.require('Hasher')

module.exports = function (deployer) {
  return deployer.then(async () => {
    const { MERKLE_TREE_HEIGHT, ETH_AMOUNT } = process.env
    const verifier = await Verifier.deployed()
    const hasher = await Hasher.deployed()
    //Deploy 4 Hongbao contracts: 1, 10, 100, 1000
    await deployer.deploy(
      ETHHongbao,
      verifier.address,
      hasher.address,
      ETH_AMOUNT,
      MERKLE_TREE_HEIGHT,
    )
    await deployer.deploy(
      ETHHongbao,
      verifier.address,
      hasher.address,
      bigInt(ETH_AMOUNT).multiply(10).toString(),
      MERKLE_TREE_HEIGHT,
    )
    await deployer.deploy(
      ETHHongbao,
      verifier.address,
      hasher.address,
      bigInt(ETH_AMOUNT).multiply(100).toString(),
      MERKLE_TREE_HEIGHT,
    )
    await deployer.deploy(
      ETHHongbao,
      verifier.address,
      hasher.address,
      bigInt(ETH_AMOUNT).multiply(1000).toString(),
      MERKLE_TREE_HEIGHT,
    )
  })
}
