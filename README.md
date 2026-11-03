# Turing (TUR)

Token ERC20 de votação entre alunos (`contracts/Turing.sol`), com módulo de deploy
Hardhat Ignition (`ignition/modules/Turing.js`).

```shell
npx hardhat compile
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Turing.js --network localhost
```

## Frontend

Interface simples em `frontend/` (HTML + ethers.js via CDN + MetaMask).

```shell
# terminal 1: blockchain local
npx hardhat node

# terminal 2: deploy do contrato Turing
npx hardhat ignition deploy ./ignition/modules/Turing.js --network localhost

# servir o frontend (MetaMask não injeta em file://)
npm run frontend   # ou: npx serve frontend -l 3000
```

Abra http://localhost:3000, conecte o MetaMask na rede `localhost:8545` (chainId 31337)
e importe uma das contas do Hardhat. O endereço padrão do contrato já é o do primeiro
deploy local (`0x5FbDB2315678afecb367f032d93F642f64180aa3`); troque no campo do topo se necessário.

- **Alunos registrados**: votam (1 ou 2 Turings) em outro aluno.
- **Superusuários** (quem fez o deploy ou a professora): votar, `issueToken`, `votingOn` e `votingOff`.
- O ranking lista os alunos (sem a professora) ordenados por saldo de Turings.
