import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, '../.env') });

const privateKey = process.env.PRIVATE_KEY || "";
const rpcUrl = process.env.HARDHAT_RPC_URL || "http://192.168.56.10:8545";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    localBesu: {
      url: rpcUrl,
      accounts: privateKey ? [privateKey] : [],
      gasPrice: 0, 
      gas: 8000000 
    }
  }
};

export default config;