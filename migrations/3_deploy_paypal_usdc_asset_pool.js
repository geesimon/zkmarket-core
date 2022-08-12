/* global artifacts */
const PaypalUSDCAssetPool = artifacts.require('PaypalUSDCAssetPool')

module.exports = function (deployer) {
  deployer.deploy(PaypalUSDCAssetPool)
}
