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

let statusTimer;

// Toast no canto da tela; sucesso e erro somem sozinhos
function setStatus(message, kind = "info") {
  const el = $("status");
  clearTimeout(statusTimer);
  el.textContent = message;
  el.className = "status hidden";
  void el.offsetWidth; // reinicia a animação de entrada
  el.className = `status ${kind}`;
  if (kind !== "info") {
    statusTimer = setTimeout(() => {
      el.classList.add("leaving");
      statusTimer = setTimeout(() => el.classList.add("hidden"), 350);
    }, kind === "error" ? 7000 : 4000);
  }
}

function setBalance(value) {
  const el = $("balance");
  const text = `${value} TUR`;
  if (el.textContent === text) return;
  const changed = el.textContent !== "—";
  el.textContent = text;
  if (changed) {
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }
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
    const roleLabel = isSuper ? "Superusuário" : isRegistered ? "Aluno" : "Não registrado";
    $("role").textContent = roleLabel;
    $("role").dataset.role = isSuper ? "super" : isRegistered ? "aluno" : "none";
    setBalance(await contract.balanceOf(account));

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
  const firstDraw = body.children.length === 0;
  // FLIP: guarda a posição de cada linha antes de redesenhar
  const before = new Map([...body.children].map((li) => [li.dataset.name, li.getBoundingClientRect().top]));
  const max = ranking.reduce((m, r) => (r.balance > m ? r.balance : m), 0n);

  body.innerHTML = "";
  ranking.forEach((r, i) => {
    const li = document.createElement("li");
    const isMe = account && r.addr.toLowerCase() === account.toLowerCase();
    li.className = "rank-row";
    li.dataset.name = r.name;
    if (i < 3 && r.balance > 0n) li.classList.add("top");
    if (isMe) li.classList.add("me");
    if (highlight.includes(r.name)) li.classList.add("flash");
    const pct = max > 0n ? Number((r.balance * 100n) / max) : 0;
    li.innerHTML = `
      <span class="rank-pos">${i + 1}</span>
      <span class="rank-main">
        <span class="rank-name">${r.name}${isMe ? '<span class="you">você</span>' : ""}</span>
        <span class="bar"><i style="--w:${firstDraw ? 0 : pct}%"></i></span>
      </span>
      <span class="rank-value">${r.balance}<small>TUR</small></span>`;
    body.appendChild(li);
    if (firstDraw) requestAnimationFrame(() => li.querySelector(".bar > i").style.setProperty("--w", `${pct}%`));
  });

  for (const li of body.children) {
    const prev = before.get(li.dataset.name);
    if (prev === undefined) continue;
    const dy = prev - li.getBoundingClientRect().top;
    if (!dy) continue;
    li.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], {
      duration: 400,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    });
  }
  show("rankingCard", true);
}

// Transfer(from, to, value): relê o saldo só das contas envolvidas
async function onTransfer(from, to) {
  const touched = ranking.filter((r) => [from, to].some((a) => a.toLowerCase() === r.addr.toLowerCase()));
  await Promise.all(touched.map(async (r) => (r.balance = await contract.balanceOf(r.addr))));
  if (touched.length) drawRanking(touched.map((r) => r.name));

  if (account && [from, to].some((a) => a.toLowerCase() === account.toLowerCase())) {
    setBalance(await contract.balanceOf(account));
  }
}

function listen(address) {
  events?.removeAllListeners();
  events = new ethers.Contract(address, ABI, provider);
  events.on("Transfer", (from, to) => onTransfer(from, to).catch((err) => console.error(err)));
}

async function send(button, label, txPromiseFactory) {
  button.disabled = true;
  button.classList.add("loading");
  try {
    setStatus(`${label}: confirme na carteira…`);
    const tx = await txPromiseFactory();
    setStatus(`${label}: aguardando confirmação do bloco…`);
    await tx.wait();
    setStatus(`${label}: sucesso!`, "success");
    // Recarrega o ranking aqui: o listener Transfer via MetaMask+Hardhat
    // costuma não disparar; o evento segue útil para outras abas quando funciona.
    await refresh({ reloadRanking: true });
  } catch (err) {
    setStatus(`${label}: ${errorMessage(err)}`, "error");
  } finally {
    button.disabled = false;
    button.classList.remove("loading");
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
    ? `<span class="wallet-chip"><span class="wallet-dot" aria-hidden="true"></span><code title="${account}">${short(account)}</code></span>`
    : '<button id="connectBtn" type="button">Conectar carteira</button>';
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
  $("refreshBtn").onclick = (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    refresh().finally(() => (btn.disabled = false));
  };

  $("voteForm").onsubmit = (e) => {
    e.preventDefault();
    const name = $("voteName").value;
    const amount = BigInt(document.querySelector('input[name="voteAmount"]:checked').value);
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
