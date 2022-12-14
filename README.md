# zkMarket.Finance
zkMarket.Finance is a P2P crypto coin marketplace where anyone can trade using traditional payment method (PayPal) privately.

## Problem Statement
Today, people need to use CEX to buy and sell cryptocurrency with their fiat currency. Such approach has many drawbacks such as,
- User needs to take the burden to register and maintain another account in a centralized financial service, such as CEX or USDC official app.
- By aggregating supply and need, CEX can gain unfair advantage to help them charge high fees.
- Privacy concerns. For fiat/crypto trade, CEX knows who in physical world send/receive the money (through their bank account info) and which crypto address the fund is transferred to/from.

## ZK and Web3 Solution
For ZK part, we build this application based on the source code of original Tornado.cash (sorry, the source code is no longer legitimately available), lift the amount limitation and migrated to the latest version of circom and snarkjs for better performance and code quality. The ZKP serves the purpose of breaking the link between fiat and crypto transactions. There is no way one can tell that a PayPal user purchased certain amount of USDC and deposited to a specific Polygon address. 
For Web3 part, we implemented a PayPal relayer that can relay PayPal deposits to Polygon network and make payouts to sellers based on instructions from the blockchain transactions.

Neither buyer nor seller needs to register to use this service. And thanks to the low transaction fee of Polygon, the platform can only charge a fractional fee compared with traditional CEX service (except the fee charged by PayPal or banks) in order to fulfill the transaction.

*Note*: for the purpose of demonstrating technical feasibility, we only implemented USDC/USD pair trade in current milestone. 

## Use Cases
- **Sell Coin**:  Anyone who possess a Polygon address and would like to sell their coins for fiat currency, can deposit the coins to zkMarket.Finance and provide a PayPal account email to receive fiat. Once the coins are sold, zkMarket.Finance will payout the fiat to their PayPal accounts.
- **Buy Coin**: to purchase crypto coins, user simply specifies how many fiats she wants to spend and a Polygon address to receive the coins. The fiat payment is done through PayPal and the purchased coins are settled to user???s Polygon address. By leveraging ZKP technology, the connection between Paypal account and Polygon address is broken, thus shield the transaction for better privacy.

## Technical Workflows
### Purchase USDC (Happy Path)
1. Buyer specifies amount of fiat she wants to spend and a Polygon address.
1. Buyer generates a `commitment` (hash of nullifier, secret and amount) in browser and initializes a PayPal payment to deposit the fiat together with `commitment` to zkMarket.Finance PayPal account.
1. Once the fiat is received, zkMarket.Finance PayPal relayer register the `commitment` and amount to Polygon zkMarket.Finance contract (a.k.a, PaypalUSDCAssetPool). *Note*: at this time, zkMarket.Finance doesn???t know the received amount matches the amount hashed into `commitment`.
1. Buyer submits a `commitment` zkSnark proof to PaypalUSDCAssetPool to prove she knows the nullifier and secret, and the amount in `commitment` matches what has been registered by PayPal relayer in previous step. Once verified by PaypalUSDCAssetPool, the `commitment` is inserted to Merkle tree.
1. Buyer submits a zkSnark proof with a recipient address to PaypalUSDCAssetPool to prove she knows nullifier, secret and the Merkle path to the `commitment`. Once verified by PaypalUSDCAssetPool, a certain amount (PayPal Deposit - Fee) of USDC will be transferred to the specified recipient address. PaypalUSDCAssetPool saves hash of nullifier so that it can reject same proof in the future to avoid double spending. 

*Note*: PaypalUSDCAssetPool doesn???t know what exact `commitment` is spent. It only knows the not revealed `commitment` is included in Merkle tree by verifying the zkSnark proof. This means PaypalUSDCAssetPool can???t link `commitment` with recipient address.

### Sell USDC
1. Seller deposit a certain amount of USDC to PaypalUSDCAssetPool and specify her PayPal email address for receiving fiat fund. PaypalUSDCAssetPool records this info in Polygon.
1. Once a purchase is made, PaypalUSDCAssetPool take turns to find sellers that can satisfy such purchase, transfer the coins to buyer and deduct sellers??? amount accordingly.
1. PaypalUSDCAssetPool emits events to instruct zkMarket.Finance PayPal relayer payout these sellers from zkMarket.Finance???s PayPal account.

## Component
- zkmarket-core (this repository): zkSnark circuits and smart contracts that compose the core logic of this application.
- [zkmarket -ui]( https://github.com/geesimon/zkmarket-ui): a ReactJS based web application for end users.
- [zkmarket -relayer]( https://github.com/geesimon/zkmarket-relayer): 
  * PayPal relayer services to relay transactions between Polygon and PayPal. 
  * Proof relayer for submitting proofs on user???s behalf. It is a trustless service that solves the "`pay gas fee without revealing the identity`" issue.

## Requirements

1. `node v14+`
2. `circom 2.0.3`

## Local Setup & Test

1. `cp .env.example .env` and change the parameters accordingly
1. `npm run build`
1. `npx truffle develop`
  * `migrate --reset`
  * `test`

## Contract Usage

Please check [test cases]( https://github.com/geesimon/zkmarket-core/tree/main/test)

## Polygon Deployment

### TestNet

`npm run migrate:test`

#### Already Deployed (Mumbai)
1. `Hasher`:  0x2987789984964942814EcA0E62a416e28caB6632
1. `CommitmentVerifier`:  0xF0859Bb069207a9208E56269406cE27BB0C04dcd
1. `WithdrawalVerifier`:  0x207c5cea88202e0708416AcB0f5BEEcA8607B7FA
1. `PaypalUSDCAssetPool`:  0xC6Ac772ebe6751877cC3B9B997F11e401917E87f
1. `USDC (official USDC bridge contract on Mumbai)`:  0x0fa8781a83e46826621b3bc094ea2a0212e71b23

### MainNet
`npm run migrate:mainnet`
#### Already Deployed
1. `Hasher`:  0x6cbD754473C4A4451200269C9344060d3057718d
1. `CommitmentVerifier`:  0x9fF45B2A08408C724Af9E5b15a202280139e8143
1. `WithdrawalVerifier`:  0x1cc1532d549C29A03275591094d62000329db044
1. `PaypalUSDCAssetPool`:  0x87c4a39A42F37e5Ff389BE1D66B751bDF96E30de
1. `USDC (official USDC bridge contract on Polygon Mainnet)`:  0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174

## Demo Web Site (use Mumbai)
https://zkmarket.finance

- The demo site is configured to use test environment settings and Polygon Mumbai network.
- To play with this demo, you will need a PayPal sandbox account and some USDCs in Mumbai. The easiest way to get test USDCs is through creating a dev account in https://developers.circle.com , fund the account and bridge some USDCs to Polygon Mumbai.
- PayPal and Relayer services are deployed as FaaS in AliCloud (Singapore). The PayPal payout service is scheduled to run every 5 minutes. Which means after user successfully trade USDC coins, seller will receive PayPal payment within 5 minutes.

## Demo Video
https://youtu.be/VKlfaYuKOfM

## Discussions
### Security
Most part of this web3 application follows the trustless setup pattern, including smart contracts, UI and zkSnark proof relayers. However, user does need to trust two centralized pieces in this application (besides PayPal) in order to make it work.
1. zkMarket Finance PayPal account that acts as payment channel between buyer and seller.
1. PayPal relayer and payout services that relay PayPal payment transactions to block chain and instructs payout to sellers??? account.

User's money in zkMarket Finance PayPal account won't last long before moving to sellers. Therefore, we probably can mitigate this risk by deploying another (or several others) 3rd party services to monitor this account (check PayPal transaction logs) and incentivize them to raise alarm if something goes wrong. Simillar ideas are deployed by optimistic rollups. We could also post user's PalPay payment transaction on chain as evidence for resolving dispute.

### Fees
PayPal charges `%3.49 of gross amount + $0.39` for our merchant transaction. To compensate such attrition and for simplicity, zkMarket Finance deducts 4% from buyer's gross amount when calculate amount of USDC to transfer. For example: if user paid $100, PayPal charges $3.98, zkMarket Finance gets 0.02 USDC and user gets 96 USDC. The 0.02 USDC is paid to Relayer address as current implementation. Due to the high fee, this solution is not economically appealing to end user if not taking privacy protection into account. 

To mitigate this issue, we could consider other payment solutions if it is accessible through API. Another interesting idea is to use P2P payment and buyer can just pay seller directly through PayPal or bank account. But this could violate usage agreement enforced by PayPal.

### Privacy
Current implementation has good protection on buyer???s privacy. I.e., break the link between buyer PayPal account and Polygon address. However, Seller???s activity is more easier to be traced.

As future improvement, we could design another mechanism to break the link between seller???s Polygon address and her PayPal account. For example: seller can post a commitment when deposit USDC coins. Then seller can provide a valid proof (without telling with commitment), to zkMarket.Finance contract to instruct PayPal payout service to make a payment to a specific PayPal account.

### Beyond USDC/USD PAIR
We only implement USDC/USD trade as POC. By leveraging such technology, we can support any trades between crypto coins and fiat currencies (and beyond USD). Such extension would make this app a rich market place for P2P crypto trading.
