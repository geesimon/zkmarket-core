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
- **Buy Coin**: to purchase crypto coins, user simply specifies how many fiats she wants to spend and a Polygon address to receive the coins. The fiat payment is done through PayPal and the purchased coins are settled to user’s Polygon address. By leveraging ZKP technology, the connection between Paypal account and Polygon address is broken, thus shield the transaction for better privacy.

## Technical Workflows
### Purchase USDC (Happy Path)
1. Buyer specifies amount of fiat she wants to spend and a Polygon address.
1. Buyer generates a `commitment` (hash of nullifier, secret and amount) in browser and initializes a PayPal payment to deposit the fiat together with `commitment` to zkMarket.Finance PayPal account.
1. Once the fiat is received, zkMarket.Finance PayPal relayer register the `commitment` and amount to Polygon zkMarket.Finance contract (a.k.a, PaypalUSDCAssetPool). *Note*: at this time, zkMarket.Finance doesn’t know the received amount matches the amount hashed into `commitment`.
1. Buyer submits a `commitment` zkSnark proof to PaypalUSDCAssetPool to prove she knows the nullifier and secret, and the amount in `commitment` matches what has been registered by PayPal relayer in previous step. Once verified by PaypalUSDCAssetPool, the `commitment` is inserted to Merkle tree.
1. Buyer submits a zkSnark proof with a recipient address to PaypalUSDCAssetPool to prove she knows nullifier, secret and the Merkle path to the `commitment`. Once verified by PaypalUSDCAssetPool, a certain amount (PayPal Deposit - Fee) of USDC will be transferred to the specified recipient address. PaypalUSDCAssetPool saves hash of nullifier so that it can reject same proof in the future to avoid double spending. 

*Note*: PaypalUSDCAssetPool doesn’t know what exact `commitment` is spent. It only knows the not revealed `commitment` is included in Merkle tree by verifying the zkSnark proof. This means PaypalUSDCAssetPool can’t link `commitment` with recipient address.

### Sell USDC
1. Seller deposit a certain amount of USDC to PaypalUSDCAssetPool and specify her PayPal email address for receiving fiat fund. PaypalUSDCAssetPool records this info in Polygon.
1. Once a purchase is made, PaypalUSDCAssetPool take turns to find sellers that can satisfy such purchase, transfer the coins to buyer and deduct sellers’ amount accordingly.
1. PaypalUSDCAssetPool emits events to instruct zkMarket.Finance PayPal relayer payout these sellers from zkMarket.Finance’s PayPal account.

## Component
- zkmarket-core (this repository): zkSnark circuits and smart contracts that compose the core logic of this application.
- [zkmarket -ui]( https://github.com/geesimon/zkmarket-ui): a ReactJS based web application for end users.
- [zkmarket -relayer]( https://github.com/geesimon/zkmarket-relayer): 
  * PayPal relayer services to relay transactions between Polygon and PayPal. 
  * Proof relayer for submitting proofs on user’s behalf. It is a trustless service that solves the "`pay gas fee without revealing the identity`" issue.

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
1. `Hasher`:  0xD2BEcA2BBf752770994DcbD49026e4e8c48649ba
1. `CommitmentVerifier`:  0xA83898Aa6F0126a2558c95990851B0762dcebB8E
1. `WithdrawalVerifier`:  0x8b31e578314aCA727392ef3628113BB4a0c3a08C
1. `PaypalUSDCAssetPool`:  0x1Bd15aA5Fe95Fd5ff5B300e2545407e14BECB76c
1. `USDC (official USDC bridge contract on Mumbai)`:  0x0fa8781a83e46826621b3bc094ea2a0212e71b23

### MainNet
`npm run migrate:mainnet`
#### Already Deployed
1. `Hasher`:  0x2e1B61931cA77EE4ed39135e41C4dD1D6AdEF4f6
1. `CommitmentVerifier`:  0x661E796F4ccda98E4a9031687B4E394447d1cc22
1. `WithdrawalVerifier`:  0x0CD5a54bBA5141d323d1aFe8F93B35689963a590
1. `PaypalUSDCAssetPool`:  0x695B4367D9096D287960718Bf509bB53be6e3B56
1. `USDC (official USDC bridge contract on Mumbai)`:  0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174

## Demo Web Site
https://zkmarket.finance

## Demo Video
https://youtu.be/VKlfaYuKOfM

## Discussions
### Fees
PayPal charges `%3.49 of gross amount + $0.39` for our merchant transaction. To compensate such attrition and for simplicity, we deduct 4% from buyer's gross amount. For example: if user paid $100, she would get 96 USDC. Due to the high fee, this solution is not economically appealing to end user if not taking privacy protection into account. 
To mitigate this issue, we could consider other payment solutions if it is accessible through API. 
### Privacy
Current implementation has good protection on buyer’s privacy. I.e., break the link between buyer PayPal account and Polygon address. However, Seller’s activity is more easier to be traced.
As future improvement, we could design another mechanism to break the link between seller’s Polygon address and her PayPal account. For example: seller can post a commitment when deposit USDC coins. Then seller can provide a valid proof (without telling with commitment), to zkMarket.Finance contract to instruct PayPal payout service to make a payment to a specific PayPal account.
### Beyond USDC/USD PAIR
We only implement USDC/USD trade as POC. By leveraging such technology, we can support any crypto coins to fiat pairs (and beyond USD) and make this app a rich market place for P2P crypto trading.
