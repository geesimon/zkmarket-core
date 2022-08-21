require('dotenv').config()

const PrivateKeyProvider = require('./private-provider')

const networkId = {
  Mainnet: 137,
  Testnet: 80001
}

module.exports = {
  networks: {
      development: {
        host: "127.0.0.1",
        port: 9545,
        network_id: "*"
      },

    mumbai: {
      provider: () => {
        return new PrivateKeyProvider(process.env.TESTNET_PRIVATE_KEY, 'https://matic-mumbai.chainstacklabs.com', networkId.Testnet)
      },
      network_id: networkId.Testnet
    },

    mainnet: {
      provider: () => {
        return new PrivateKeyProvider(process.env.MAINNET_PRIVATE_KEY, 'https://polygon-rpc.com', networkId.Mainnet)
      },
      network_id: networkId.Mainnet
    }
  },

  compilers: {
    solc: {
      version: '0.8.0'
    },
  }
}
