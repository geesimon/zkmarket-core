require('dotenv').config({ path: '../.env' })
const FakeUSDC = artifacts.require('FakeUSDC')

const { SELLER1_ADDRESS,
        SELLER2_ADDRESS,
        SELLER3_ADDRESS} = process.env

module.exports = function (deployer, network) {   
    return deployer.then(async () => {
        if (network !== 'develop') return;

        await deployer.deploy(
                                FakeUSDC,
                                1000000 * (10 ** 6)
                                // {overwrite: false}
                            )
        const fakeUSDC = await FakeUSDC.deployed();
        //deposit money to test seller accounts
        await fakeUSDC.transfer(SELLER1_ADDRESS, (1000 * 10**6).toString());
        await fakeUSDC.transfer(SELLER2_ADDRESS, (1000 * 10**6).toString());
        await fakeUSDC.transfer(SELLER3_ADDRESS, (1000 * 10**6).toString());
    })
}