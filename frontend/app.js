import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.13.4/dist/ethers.min.js";

// Primeiro deploy do Hardhat local (conta #0, nonce 0)
const DEFAULT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// Endereço fixo da professora no modifier assertOwnerOrTeacher
const TEACHER_ADDRESS = "0x502542668aF09fa7aea52174b9965A7799343Df7";

// Codinomes registrados no construtor (sem a professora)
const STUDENTS = Array.from({ length: 19 }, (_, i) => `nome${i + 1}`);

const ABI = [
  "function users(string) view returns (address)",
  "function addressOf(address) view returns (string)",
  "function balanceOf(address) view returns (uint256)",
  "function getOwner() view returns (address)",
  "function isVotingOn() view returns (bool)",
  "function vote(string _name, uint256 _vote)",
  "function issueToken(string _name, uint256 _amount)",
  "function votingOn()",
  "function votingOff()",
  "error NotAllowed(string message)",
  "error BadRequest(string message)",
  // Emitido pelo _mint do ERC20 em vote() e issueToken() (from = 0x0)
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

const $ = (id) => document.getElementById(id);

let provider;
let signer;
let account;
let contract;
let events; // instância só de leitura usada para escutar eventos
let ranking = []; // [{ name, addr, balance }]

function show(id, visible) {
  $(id).classList.toggle("hidden", !visible);
}

function setStatus(message, kind = "info") {
  const el = $("status");
  el.textContent = message;
  el.className = `status ${kind}`;
}

function errorMessage(err) {
  if (err?.code === "ACTION_REJECTED") return "Transação cancelada na carteira.";
  if (err?.revert?.args?.[0]) return err.revert.args[0];

  // Em transações (estimateGas) o ethers não decodifica os erros customizados;
  // o retorno do revert vem cru em err.data (às vezes aninhado no erro do RPC)
  const data = [err?.data, err?.info?.error?.data, err?.info?.error?.data?.data, err?.error?.data]
    .find((d) => typeof d === "string" && d.startsWith("0x") && d.length >= 10);
  if (data && contract) {
    try {
      const parsed = contract.interface.parseError(data);
      if (parsed?.args?.[0]) return parsed.args[0];
    } catch {}
  }

  return err?.shortMessage || err?.reason || err?.message || String(err);
}

function short(addr) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// reloadRanking = false quando o ranking já é mantido pelos eventos Transfer
async function refresh({ reloadRanking = true } = {}) {
  if (!contract) return;
  try {
    const code = await provider.getCode(await contract.getAddress());
    if (code === "0x") {
      setStatus("Nenhum contrato encontrado nesse endereço/rede.", "error");
      return;
    }

    const [owner, voting] = await Promise.all([contract.getOwner(), contract.isVotingOn()]);
    $("votingState").innerHTML = voting
      ? '<span class="badge on">aberta</span>'
      : '<span class="badge off">fechada</span>';

    if (reloadRanking) await loadRanking();

    if (!account) {
      show("infoCard", true);
      return;
    }

    const name = await contract.addressOf(account);
    const isSuper = [owner, TEACHER_ADDRESS].some((a) => a.toLowerCase() === account.toLowerCase());
    const isRegistered = name !== "";

    $("whoami").textContent = name || short(account);
    $("role").textContent = isSuper ? "Superusuário" : isRegistered ? "Aluno" : "Não registrado";
    $("balance").textContent = `${await contract.balanceOf(account)} TUR`;

    show("infoCard", true);
    // Superusuário sempre vê o voto (spec), mas o contrato só aceita votos de quem tem codinome
    show("voteCard", isRegistered || isSuper);
    show("adminCard", isSuper);
    show("voteWarning", isSuper && !isRegistered);
    show("notRegisteredCard", !isRegistered && !isSuper);
  } catch (err) {
    setStatus(`Erro ao ler o contrato: ${errorMessage(err)}`, "error");
  }
}

// Carga inicial completa; depois disso o ranking é atualizado pelos eventos
async function loadRanking() {
  ranking = await Promise.all(
    STUDENTS.map(async (name) => {
      const addr = await contract.users(name);
      const balance = addr === ethers.ZeroAddress ? 0n : await contract.balanceOf(addr);
      return { name, addr, balance };
    }),
  );
  drawRanking();
}

function drawRanking(highlight = []) {
  ranking.sort((a, b) => (b.balance === a.balance ? a.name.localeCompare(b.name, undefined, { numeric: true }) : b.balance > a.balance ? 1 : -1));

  const body = $("rankingBody");
  body.innerHTML = "";
  ranking.forEach((r, i) => {
    const tr = document.createElement("tr");
    if (account && r.addr.toLowerCase() === account.toLowerCase()) tr.classList.add("me");
    if (highlight.includes(r.name)) tr.classList.add("flash");
    tr.innerHTML = `<td>${i + 1}</td><td>${r.name}</td><td class="num">${r.balance}</td>`;
    body.appendChild(tr);
  });
  show("rankingCard", true);
}

// Transfer(from, to, value): relê o saldo só das contas envolvidas
async function onTransfer(from, to) {
  const touched = ranking.filter((r) => [from, to].some((a) => a.toLowerCase() === r.addr.toLowerCase()));
  await Promise.all(touched.map(async (r) => (r.balance = await contract.balanceOf(r.addr))));
  if (touched.length) drawRanking(touched.map((r) => r.name));

  if (account && [from, to].some((a) => a.toLowerCase() === account.toLowerCase())) {
    $("balance").textContent = `${await contract.balanceOf(account)} TUR`;
  }
}

function listen(address) {
  events?.removeAllListeners();
  events = new ethers.Contract(address, ABI, provider);
  events.on("Transfer", (from, to) => onTransfer(from, to).catch((err) => console.error(err)));
}

async function send(button, label, txPromiseFactory) {
  button.disabled = true;
  try {
    setStatus(`${label}: confirme na carteira…`);
    const tx = await txPromiseFactory();
    setStatus(`${label}: aguardando confirmação do bloco…`);
    await tx.wait();
    setStatus(`${label}: sucesso!`, "success");
    // O ranking chega pelo evento Transfer; aqui só o resto (ex.: estado da votação)
    await refresh({ reloadRanking: false });
  } catch (err) {
    setStatus(`${label}: ${errorMessage(err)}`, "error");
  } finally {
    button.disabled = false;
  }
}

function useContract(address) {
  if (!ethers.isAddress(address)) {
    setStatus("Endereço de contrato inválido.", "error");
    return;
  }
  try { localStorage.setItem("turingAddress", address); } catch {}
  contract = new ethers.Contract(address, ABI, signer ?? provider);
  listen(address);
  refresh();
}

async function connect() {
  if (!window.ethereum) {
    setStatus("Nenhuma carteira encontrada. Instale o MetaMask.", "error");
    return;
  }
  try {
    const accounts = await provider.send("eth_requestAccounts", []);
    await onAccountChange(accounts);
  } catch (err) {
    setStatus(errorMessage(err), "error");
  }
}

async function onAccountChange(accounts) {
  account = accounts[0] ? ethers.getAddress(accounts[0]) : undefined;
  signer = account ? await provider.getSigner() : undefined;
  $("account").innerHTML = account
    ? `<span class="muted">Conectado:</span> <code>${short(account)}</code>`
    : '<button id="connectBtn">Conectar carteira</button>';
  if (!account) $("connectBtn").onclick = connect;
  $("status").classList.add("hidden");
  useContract($("contractAddr").value.trim());
}

function init() {
  const options = STUDENTS.map((n) => `<option value="${n}">${n}</option>`).join("");
  document.querySelectorAll(".studentSelect").forEach((s) => (s.innerHTML = options));

  let saved;
  try { saved = localStorage.getItem("turingAddress"); } catch {}
  $("contractAddr").value = saved || DEFAULT_ADDRESS;

  $("connectBtn").onclick = connect;
  $("saveAddrBtn").onclick = () => useContract($("contractAddr").value.trim());
  $("refreshBtn").onclick = () => refresh();

  $("voteForm").onsubmit = (e) => {
    e.preventDefault();
    const name = $("voteName").value;
    const amount = BigInt($("voteAmount").value);
    send(e.submitter, `Voto em ${name}`, () => contract.vote(name, amount));
  };

  $("issueForm").onsubmit = (e) => {
    e.preventDefault();
    const name = $("issueName").value;
    const amount = BigInt($("issueAmount").value);
    send(e.submitter, `Emissão para ${name}`, () => contract.issueToken(name, amount));
  };

  $("votingOnBtn").onclick = (e) => send(e.currentTarget, "Abrir votação", () => contract.votingOn());
  $("votingOffBtn").onclick = (e) => send(e.currentTarget, "Fechar votação", () => contract.votingOff());

  if (!window.ethereum) {
    setStatus("Nenhuma carteira encontrada. Instale o MetaMask para usar o app.", "error");
    return;
  }

  provider = new ethers.BrowserProvider(window.ethereum);
  window.ethereum.on("accountsChanged", onAccountChange);
  window.ethereum.on("chainChanged", () => window.location.reload());

  provider.send("eth_accounts", []).then(onAccountChange);
}

init();
