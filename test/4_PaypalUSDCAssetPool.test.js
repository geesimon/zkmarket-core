/* global artifacts, web3, contract */
require('chai').use(require('bn-chai')(web3.utils.BN)).use(require('chai-as-promised')).should()

const { toBN } = require('web3-utils');

const PaypalUSDCAssetPool = artifacts.require("PaypalUSDCAssetPool");

contract ('PaypalUSDCAssetPool Test', accounts =>{
    //Global variables
    let paypalUSDCAssetPool;

    before(async () => {
        paypalUSDCAssetPool = await PaypalUSDCAssetPool.new();
    });
  
    describe('#Seller Features', () => {
        const SELLER = accounts[3];
        const AMOUNT = 10000;

        it('Should take seller deposit', async () => {
            const balanceBefore = await web3.eth.getBalance(paypalUSDCAssetPool.address);
            await paypalUSDCAssetPool.deposit({from: SELLER, value:AMOUNT});
            const balanceAfter = await web3.eth.getBalance(paypalUSDCAssetPool.address);
  
            balanceAfter.should.be.eq.BN(toBN(balanceBefore).add(toBN(AMOUNT)));
        })

        it('Should allow paypal relayer record transactions', async () => {
            const txn_id = '1234xxxx7890';

            let isExists = await paypalUSDCAssetPool.existTransactions(txn_id);
            isExists.should.equal(false);

            await paypalUSDCAssetPool.recordTransaction(txn_id);
            isExists = await paypalUSDCAssetPool.existTransactions(txn_id);
            isExists.should.equal(true);
        })
    })
})