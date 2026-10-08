// Utilidades compartilhadas: criação de elementos, voz, sons e preferências.

export { api } from "./api.js";

// el("button.grande", {onclick: f}, "texto", outroEl) -> HTMLElement
export function el(seletor, props, ...filhos) {
  const [tag, ...classes] = seletor.split(".");
  const no = document.createElement(tag || "div");
  if (classes.length) no.className = classes.join(" ");
  if (props && (typeof props !== "object" || props instanceof Node || Array.isArray(props))) {
    filhos.unshift(props);
    props = null;
  }
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on")) no.addEventListener(k.slice(2), v);
    else if (k === "html") no.innerHTML = v;
    else if (k === "style" && typeof v === "object") {
      for (const [prop, val] of Object.entries(v)) {
        if (prop.includes("-")) no.style.setProperty(prop, val); // variáveis CSS (--cor) e nomes com hífen
        else no.style[prop] = val;
      }
    }
    else if (k in no && k !== "list") no[k] = v;
    else no.setAttribute(k, v === true ? "" : v);
  }
  for (const f of filhos.flat(Infinity)) {
    if (f === null || f === undefined || f === false) continue;
    no.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return no;
}

export function svg(markup) {
  const t = document.createElement("template");
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
}

export const sorteia = (lista) => lista[Math.floor(Math.random() * lista.length)];

export function formatarNota(n) {
  return n === null || n === undefined ? "–" : n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function formatarData(iso) {
  if (!iso) return "–";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ---------- Preferências do aparelho (só conveniência; nada importante fica aqui)

export const prefs = {
  get(chave, padrao) {
    try { const v = localStorage.getItem("s4a3t_" + chave); return v === null ? padrao : JSON.parse(v); } catch { return padrao; }
  },
  set(chave, valor) {
    try { localStorage.setItem("s4a3t_" + chave, JSON.stringify(valor)); } catch { /* sem storage */ }
  },
};

// ---------- Leitura em voz alta (voz do próprio aparelho, funciona sem internet se a voz estiver instalada)

export const voz = {
  disponivel: "speechSynthesis" in window,
  falar(texto, idioma = "pt-BR", aoTerminar) {
    if (!this.disponivel) return;
    speechSynthesis.cancel();
    const fala = new SpeechSynthesisUtterance(texto);
    fala.lang = idioma === "en" ? "en-US" : "pt-BR";
    const vozes = speechSynthesis.getVoices().filter((v) => v.lang.replace("_", "-").startsWith(fala.lang.slice(0, 2)));
    const exata = vozes.find((v) => v.lang.replace("_", "-") === fala.lang);
    if (exata || vozes[0]) fala.voice = exata || vozes[0];
    fala.rate = 0.9;
    if (aoTerminar) { fala.onend = aoTerminar; fala.onerror = aoTerminar; }
    speechSynthesis.speak(fala);
  },
  parar() { if (this.disponivel) speechSynthesis.cancel(); },
};
if (voz.disponivel) speechSynthesis.getVoices(); // carrega a lista de vozes cedo

// ---------- Sons curtos gerados na hora (sem arquivos de áudio)

let audioCtx = null;
function tocar(notas) {
  if (!prefs.get("som", true)) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    let t = audioCtx.currentTime;
    for (const [freq, dur] of notas) {
      const osc = audioCtx.createOscillator();
      const ganho = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      ganho.gain.setValueAtTime(0.0001, t);
      ganho.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(ganho).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      t += dur * 0.8;
    }
  } catch { /* sem áudio */ }
}

export const som = {
  acerto: () => tocar([[660, 0.12], [880, 0.2]]),
  erro: () => tocar([[392, 0.18], [330, 0.25]]),
  combo: () => tocar([[660, 0.1], [784, 0.1], [988, 0.1], [1319, 0.25]]),
  carta: () => tocar([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.35]]),
};

// ---------- Janela de confirmação amigável (em vez de confirm())

export function perguntar({ titulo, texto, sim = "Sim", nao = "Cancelar", perigo = false }) {
  return new Promise((resolver) => {
    const fechar = (valor) => { fundo.remove(); resolver(valor); };
    const fundo = el("div.modal-fundo", { onclick: (e) => { if (e.target === fundo) fechar(false); } },
      el("div.modal", { role: "dialog", "aria-modal": "true" },
        el("h2", titulo),
        texto ? el("p", texto) : null,
        el("div.modal-botoes",
          el("button.botao.secundario", { onclick: () => fechar(false) }, nao),
          el("button.botao" + (perigo ? ".perigo" : ""), { onclick: () => fechar(true) }, sim),
        ),
      ),
    );
    document.body.append(fundo);
    fundo.querySelector(".modal-botoes .botao:last-child").focus();
  });
}

export function avisar(texto, tipo = "info") {
  const t = el("div.toast." + tipo, { role: "status" }, texto);
  document.body.append(t);
  setTimeout(() => t.classList.add("saindo"), 2600);
  setTimeout(() => t.remove(), 3200);
}

// ---------- Confete leve (respeita "reduzir movimento" do sistema)

export function confete(origem, quantidade = 18) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = origem ? origem.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
  const cores = ["#F5B700", "#2D8CFF", "#2FA35A", "#F0592A", "#8B6FE0", "#5CC8D6"];
  for (let i = 0; i < quantidade; i++) {
    const p = el("span.confete", { style: {
      left: r.left + r.width / 2 + "px", top: r.top + r.height / 2 + "px", background: sorteia(cores),
      "--dx": (Math.random() * 2 - 1) * 160 + "px", "--dy": -(80 + Math.random() * 160) + "px",
      "--rot": Math.random() * 720 + "deg",
    } });
    document.body.append(p);
    setTimeout(() => p.remove(), 1100);
  }
}

export const ELEMENTOS = {
  raio:   { nome: "Elétrico",   cor: "#F5B700", escura: "#9A6F00", icone: "⚡" },
  agua:   { nome: "Água",   cor: "#2D8CFF", escura: "#1458B0", icone: "💧" },
  gelo:   { nome: "Gelo",   cor: "#4FC3D9", escura: "#1D7E91", icone: "❄️" },
  planta: { nome: "Planta", cor: "#2FA35A", escura: "#1B6B39", icone: "🌿" },
  terra:  { nome: "Terra",  cor: "#B07434", escura: "#6E4416", icone: "🪨" },
  fogo:   { nome: "Fogo",   cor: "#F0592A", escura: "#A3330F", icone: "🔥" },
  vento:  { nome: "Voador",  cor: "#8B6FE0", escura: "#563CA8", icone: "🌪️" },
};
