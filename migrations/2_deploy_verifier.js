/* global artifacts */
const CommitmentVerifier = artifacts.require('CommitmentVerifier')
const WithdrawalVerifier = artifacts.require('WithdrawalVerifier')

module.exports = function (deployer) {
  deployer.deploy(CommitmentVerifier)
  deployer.deploy(WithdrawalVerifier)
}
