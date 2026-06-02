import { ethers } from "hardhat";

async function main() {
  const factory = await ethers.getContractFactory("RegistroDocumental");
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  console.log(`Contrato desplegado en: ${await contract.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});