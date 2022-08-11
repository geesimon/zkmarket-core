# Hongbao

Hongbao is a ZK-based/Web3 donation application that anyone can setup a donation campaign while keeping the donors’ activities completely anonymous. 
 
## Problem Statement

Today, more and more content creators make money through web2 applications (YouTube, TikTok etc). However, these apps usually take a big cut from their work. A possible solution is to embed Paypal donate button in their content. But this centralized solution introduces high fee and may cause privacy concerns on givers.

When people ask friends to do a favor on emergent finance need (for example: curing a disease) or organize a group giving (for example: wedding wish list). Such donation activities are done publicly, i.e., the requester and (probably) the donators can see who and how much each friend donate. This causes social pressure on some friends, who for some reason, may either don’t want to give or can’t afford the amount other friends do. It also introduces unhealthy competition environment and encourage displaying of loyalty by money.

## ZK Solution

This application is based on [Tornado.cash](https://github.com/tornadocash/tornado-core) source code and migrated to latest circom (2.0.3) and snarkjs (0.4.16) for better performance and code quality. Asker uses this app to setup a campaign, then donor can transfer fund to this campaign anonymously. The requester can see how many people and how much in total made to this campaign but can never find out individual donation (who and by how much).

Technically, Hongbao uses zkSnarks to shield fund transfer, thus hides donors’ activity. 

## Use Cases
- **Tipping**: Content creator embed a `Tip` button (similar to PayPal Donate Button) in their content. Audiences can tip the author (with token) without need to worry about revealing their identities and donation amount. 
- **Charity**: NGO setup a charity campaign to request fund from public to support a project. Not only donors can make donation anonymously but also thanks to the nature of block chain, all donations and withdrawals are transparent and traceable to public.
- **Money-Raising**: Susan is organizing a money-raising campaign among her friends and will use the money to reimburse her medical expense. She setup a Hongbao campaign and send a link of this campaign to her friends via social network. Her friends can then make the donation without pressure.

## Component

- Hongbao-core (this repository): zkSnark circuits and smart contracts that compose the core logic of this application.
- [Hongbao-UI](https://github.com/geesimon/hongbao-ui): a ReactJs based web application.
- [Hongbao-relayer](https://github.com/geesimon/hongbao-relayer): relay withdraw request (with zk-proof) to campaign.

## Requirements

1. `node v14+`
2. `circom 2.0.3`

## Local Setup & Test

1. `cp .env.example .env` and change the parameters accordingly
1. `npm run build`
1. `npx truffle develop`
  * `migrate --reset`
  * `test`

## Usage

Please check [test cases](https://github.com/geesimon/hongbao-core/blob/main/test/3_CampaignManager.test.js)

## Harmony Deployment

### TestNet

`npm run migrate:test`

#### Already Deployed
1. Verifier: `0x52Bfa85Ca6Fe844b8E90391e89DF3b4f2c91b67F`
1. Hasher: `0x047315Ef1B6298573f3229BB6f729Dd06Ff22C00`
1. ETHHongbao_1: `0xC8B9DFe300F374491a25597043252F1343b250f0`
1. ETHHongbao_10: `0x5B26C997f65e5E4ec93CB05A9a795F9DE2D4150e`
1. ETHHongbao_100: `0x5b630F70943199EaD899D61BdfaC42D5DC699c95`
1. ETHHongbao_1000: `0x1B3Ed84f469c65B35E38e6Ff64584dE9a92d4f13`
4. CampaignManager: `0x68ca3828C0268Cd9A6048E7F3DB4fDfcf971C38d`


### MainNet

`npm run migrate:mainnet`

#### Already Deployed
1. Verifier: `0xc4e9076EAb0c7c894fF67EdcA5f204d319B2D61c`
1. Hasher: `0xC06eBd326696761fCa99a683a69CA164B58Ab848`
1. ETHHongbao_1: `0x85f179b1763AE933d6B95A8B473889e9d290A784`
1. ETHHongbao_10: `0x674f5440Aea3679A5567dFE3c621131Da427605B`
1. ETHHongbao_100: `0x79670b9EBCcb8c562F0e42c46EE8086726F9B93D`
1. ETHHongbao_1000: `0x56A67a9933EC75d47E29c7D1D6C8d155A54ccf43`
1. CampaignManager: `0x46ae45448ddEd730d1AcA074f806109245a08502`

## Production Web Site
https://redbao.me

## Demo Video
https://youtu.be/VKlfaYuKOfM

