require('chai').use(require('bn-chai')(web3.utils.BN)).use(require('chai-as-promised')).should()

const { toBN } = require('web3-utils');
const Hasher = artifacts.require("Hasher");
const CommitmentVerifier = artifacts.require('CommitmentVerifier');
const WithdrawalVerifier = artifacts.require('WithdrawalVerifier');
const FakeUSDC = artifacts.require('FakeUSDC');
const PaypalUSDCAssetPool = artifacts.require("PaypalUSDCAssetPool");
const { COIN_AMOUNT, MERKLE_TREE_HEIGHT } = process.env;

contract('Seller Specific Test', accounts => {
    const TREE_LEVELS = MERKLE_TREE_HEIGHT || 16;
    const SELLER1 = accounts[2];
    const SELLER2 = accounts[3];
    const SELLER3 = accounts[4];
    const SELLER4 = accounts[5];
    const OPERATOR = accounts[0];
    const SELL_VALUE = COIN_AMOUNT || '100000000'; // 1 ether

    describe('#Transaction Features', () => {
        it('Should take seller deposit and increase asset pool', async () => {
            const usdcToken = await FakeUSDC.new(1000000 * (10 ** 6));
            const paypalUSDCAssetPool = await PaypalUSDCAssetPool.new(
                CommitmentVerifier.address,
                WithdrawalVerifier.address,
                Hasher.address,                
                TREE_LEVELS,
                usdcToken.address,
                {from: OPERATOR}
            );

            let balanceBefore = await paypalUSDCAssetPool.getBalance(SELLER1);
            await usdcToken.transfer(SELLER1, SELL_VALUE);
            let balanceAfter = await paypalUSDCAssetPool.getBalance(SELLER1);
            balanceAfter.should.be.eq.BN(toBN(balanceBefore).add(toBN(SELL_VALUE)));

            balanceBefore = await paypalUSDCAssetPool.getBalance(paypalUSDCAssetPool.address);
            await usdcToken.approve(paypalUSDCAssetPool.address, SELL_VALUE, {from: SELLER1});
            const {logs} = await paypalUSDCAssetPool.sellerDeposit("test1@test.com", SELL_VALUE, {from: SELLER1});
            
            logs[0].event.should.be.equal('SellerDeposit');
            balanceAfter = await paypalUSDCAssetPool.getBalance(paypalUSDCAssetPool.address);
            balanceAfter.should.be.eq.BN(toBN(balanceBefore).add(toBN(SELL_VALUE)));

            balanceAfter = await paypalUSDCAssetPool.getBalance(SELLER1);
            balanceAfter.should.be.eq.BN(toBN(0));

            const sellerInfo = await paypalUSDCAssetPool.getSellerInfo({from: SELLER1});
            sellerInfo.balance.should.be.eq.BN(toBN(SELL_VALUE));
        })

        it('Should emit correct event after buyer withdraw', async () => {
            const usdcToken = await FakeUSDC.new(1000000 * (10 ** 6));
            const paypalUSDCAssetPool = await PaypalUSDCAssetPool.new(
                CommitmentVerifier.address,
                WithdrawalVerifier.address,
                Hasher.address,                
                TREE_LEVELS,
                usdcToken.address,
                {from: OPERATOR}
            );
            
            await usdcToken.transfer(SELLER1, SELL_VALUE);
            await usdcToken.approve(paypalUSDCAssetPool.address, SELL_VALUE, {from: SELLER1});
            await paypalUSDCAssetPool.sellerDeposit("test1@test.com", SELL_VALUE, {from: SELLER1});

            await usdcToken.transfer(SELLER2, SELL_VALUE);
            await usdcToken.approve(paypalUSDCAssetPool.address, SELL_VALUE, {from: SELLER2});
            await paypalUSDCAssetPool.sellerDeposit("test2@test.com", SELL_VALUE, {from: SELLER2});

            await usdcToken.transfer(SELLER3, toBN(SELL_VALUE).mul(toBN(2)));
            await usdcToken.approve(paypalUSDCAssetPool.address, toBN(SELL_VALUE).mul(toBN(2)), {from: SELLER3});
            await paypalUSDCAssetPool.sellerDeposit("test3@test.com", toBN(SELL_VALUE).mul(toBN(2)), {from: SELLER3});

            let balance = await paypalUSDCAssetPool.getBalance(paypalUSDCAssetPool.address);
            balance.should.be.eq.BN(toBN(SELL_VALUE).mul(toBN(4)))

            let {logs} = await paypalUSDCAssetPool.paySeller(toBN(SELL_VALUE).mul(toBN(3)));
            logs.length.should.be.equal(3);
            logs[0].event.should.be.equal('SellerPayouts');            
            logs[1].event.should.be.equal('SellerPayouts');
            logs[2].event.should.be.equal('SellerPayouts');
            logs[0].args.amount.should.be.eq.BN(SELL_VALUE);
            logs[1].args.amount.should.be.eq.BN(SELL_VALUE);
            logs[2].args.amount.should.be.eq.BN(SELL_VALUE);

            let sellerInfo = await paypalUSDCAssetPool.getSellerInfo({from: SELLER1});
            sellerInfo.balance.should.be.eq.BN(toBN(0));

            sellerInfo = await paypalUSDCAssetPool.getSellerInfo({from: SELLER2});
            sellerInfo.balance.should.be.eq.BN(toBN(0));

            sellerInfo = await paypalUSDCAssetPool.getSellerInfo({from: SELLER3});
            sellerInfo.balance.should.be.eq.BN(SELL_VALUE);

            // Make another deposit
            await usdcToken.transfer(SELLER4, SELL_VALUE);
            await usdcToken.approve(paypalUSDCAssetPool.address, SELL_VALUE, {from: SELLER4});
            await paypalUSDCAssetPool.sellerDeposit("test4@test.com", SELL_VALUE, {from: SELLER4});
            
            // Now the pool size is SELL_VALUE * 2, try to pay by  SELL_VALUE * 3 should fail
            await paypalUSDCAssetPool.paySeller(toBN(SELL_VALUE).mul(toBN(3)))
                    .should.be.rejectedWith('Not enough fund in seller\'s balance');

            ;({logs} = await paypalUSDCAssetPool.paySeller(toBN(SELL_VALUE).mul(toBN(2))));
            
            logs.length.should.be.equal(2);
            logs[0].event.should.be.equal('SellerPayouts');
            logs[1].event.should.be.equal('SellerPayouts');
            logs[0].args.amount.should.be.eq.BN(SELL_VALUE);
            logs[1].args.amount.should.be.eq.BN(SELL_VALUE);

            sellerInfo = await paypalUSDCAssetPool.getSellerInfo({from: SELLER3});
            sellerInfo.balance.should.be.eq.BN(toBN(0));

            sellerInfo = await paypalUSDCAssetPool.getSellerInfo({from: SELLER4});
            sellerInfo.balance.should.be.eq.BN(toBN(0));
        })
    })
})