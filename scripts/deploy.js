// Deploy do contrato Turing.
// Uso: npx hardhat run scripts/deploy.js --network localhost
const hre = require("hardhat");

// Se mudar o nome do contrato, altere apenas esta constante.
const CONTRACT_NAME = "Turing";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Fazendo deploy de ${CONTRACT_NAME} com a conta ${deployer.address}`);

  const turing = await hre.ethers.deployContract(CONTRACT_NAME);
  await turing.waitForDeployment();

  console.log(`${CONTRACT_NAME} publicado em: ${await turing.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
