/* global artifacts */
require('dotenv').config({ path: '../.env' })
const ETHHongbao = artifacts.require('ETHHongbao')
const CampaignManager = artifacts.require('CampaignManager')

module.exports = function (deployer) {
  return deployer.then(async () => {
    const hongbao = await ETHHongbao.deployed();
    await deployer.deploy(
        CampaignManager,
        [hongbao.address]
    )
  })
}
