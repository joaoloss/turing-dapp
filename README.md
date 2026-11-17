# Turing (TUR)

Token ERC20 de votação entre alunos (`contracts/Turing.sol`).

O deploy pode ser feito de duas formas equivalentes:

- **Script** (`scripts/deploy.js`), no formato do boilerplate da atividade 12;
- **Hardhat Ignition** (`ignition/modules/Turing.js`).

Se o nome do contrato mudar, atualize `CONTRACT_NAME` em `scripts/deploy.js` e o nome em
`ignition/modules/Turing.js`.

## Como rodar

```shell
npm install
npx hardhat compile
```

O `hardhat node` fica em primeiro plano, então use um terminal só para ele:

```shell
# terminal 1: blockchain local (deixe aberto; ao encerrar, todo o estado é perdido)
npx hardhat node
```

```shell
# terminal 2: deploy (escolha UMA das opções)
npx hardhat run scripts/deploy.js --network localhost
npx hardhat ignition deploy ./ignition/modules/Turing.js --network localhost
```

> O deploy imprime o endereço do contrato. Fazendo o deploy uma única vez numa rede recém-iniciada,
> o endereço é sempre o mesmo (veja abaixo). Reiniciar o `hardhat node` apaga o contrato: faça o deploy de novo.

## Frontend

Interface simples em `frontend/` (HTML + ethers.js via CDN + MetaMask).

```shell
# terminal 3: servir o frontend (MetaMask não injeta em file://)
npm run frontend   # ou: npx serve frontend -l 3000
```

Abra http://localhost:3000, conecte o MetaMask na rede `localhost:8545` (chainId 31337)
e importe uma das contas do Hardhat. O endereço padrão do contrato já é o do primeiro
deploy local (`0x5FbDB2315678afecb367f032d93F642f64180aa3`); troque no campo do topo se necessário.

- **Alunos registrados**: votam (1 ou 2 Turings) em outro aluno.
- **Superusuários** (quem fez o deploy ou a professora): votar, `issueToken`, `votingOn` e `votingOff`.
- O ranking lista os alunos (sem a professora) ordenados por saldo de Turings.
