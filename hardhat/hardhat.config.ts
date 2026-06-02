import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const rpcUrl = process.env.HARDHAT_RPC_URL || "http://127.0.0.1:8545";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    localBesu: {
      url: rpcUrl,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 0,
      gas: 8000000,
    },
  },
};

export default config;