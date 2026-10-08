// Tela do simulado: uma questão por vez, correção na hora, partes com mini-comemoração,
// revisão das erradas e tela de resultado com a carta.

import { api, el, svg, sorteia, voz, som, perguntar, confete, formatarNota, prefs, ELEMENTOS } from "./util.js";
import { cartaEl } from "./criatura.js";
import { cartaRevelada } from "./api.js";

const ELOGIOS = ["Isso aí!", "Mandou bem!", "Certinho!", "Show de bola!", "Arrasou!", "Muito bem!", "Acertou em cheio!"];
const ANIMO = ["Não foi dessa vez.", "Quase lá!", "Errar faz parte do treino.", "Tudo bem, bora pra próxima!"];
const CORES_PARES = ["#2D8CFF", "#E5489B", "#2FA35A", "#F08A00", "#8B6FE0"];
const INSTRUCOES = {
  vf: "A frase é verdadeira ou falsa?",
  multipla: "Escolha a resposta certa.",
  lacuna: "Escreva o que falta no espaço.",
  associacao: "Toque em um item da esquerda e depois no par dele da direita.",
};
const RE_LACUNA = /_{2,}/;

const letra = (i) => "abcdefgh"[i];
const LETRA = (i) => "ABCDEFGH"[i];
const limparVF = (t) => t.replace(/\(\s*_+\s*\)/g, "").replace(/\s+/g, " ").trim();
const numeroBR = (n) => Number(n.toFixed(2)).toLocaleString("pt-BR");

function textoParaFalar(q, idioma) {
  const lacuna = idioma === "en" ? " blank " : " lacuna ";
  let t = limparVF(q.enunciado).replace(/_{2,}/g, lacuna);
  if (q.tipo === "multipla") t += ". " + q.alternativas.map((a, i) => `${LETRA(i)}: ${a.texto}`).join(". ");
  if (q.tipo === "associacao") {
    t += ". " + q.colunaA.map((a, i) => `${i + 1}: ${a.texto}`).join(". ");
    t += ". " + q.colunaB.map((b, i) => `${letra(i)}: ${b.texto}`).join(". ");
  }
  return t.replace(/_+/g, lacuna);
}

function botaoFalar(q, idioma) {
  if (!voz.disponivel) return null;
  const b = el("button.botao-voz", { type: "button", "aria-label": "Ouvir a questão", title: "Ouvir a questão" }, "🔊");
  b.addEventListener("click", () => {
    if (b.classList.contains("falando")) { voz.parar(); b.classList.remove("falando"); return; }
    b.classList.add("falando");
    voz.falar(textoParaFalar(q, idioma), idioma, () => b.classList.remove("falando"));
  });
  return b;
}

// ---------------------------------------------------------------- rascunho (desenhar com o dedo)

const rascunhos = new Map();

function abrirRascunho(chave) {
  const canvas = el("canvas.rascunho-canvas");
  const fundo = el("div.rascunho",
    el("div.rascunho-barra",
      el("strong", "✏️ Rascunho"),
      el("span.espaco"),
      el("button.botao.secundario.pequeno", { onclick: () => { ctx.clearRect(0, 0, canvas.width, canvas.height); } }, "Apagar tudo"),
      el("button.botao.pequeno", { onclick: fechar }, "Fechar"),
    ),
    canvas,
  );
  document.body.append(fundo);
  const escala = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * escala;
  canvas.height = canvas.clientHeight * escala;
  const ctx = canvas.getContext("2d");
  ctx.scale(escala, escala);
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#1F2430";
  const salvo = rascunhos.get(chave);
  if (salvo) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, canvas.clientWidth, canvas.clientHeight); img.src = salvo; }
  let desenhando = false;
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener("pointerdown", (e) => { desenhando = true; canvas.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pos(e)); });
  canvas.addEventListener("pointermove", (e) => { if (!desenhando) return; ctx.lineTo(...pos(e)); ctx.stroke(); });
  canvas.addEventListener("pointerup", () => { desenhando = false; });
  canvas.addEventListener("pointercancel", () => { desenhando = false; });
  function fechar() { rascunhos.set(chave, canvas.toDataURL()); fundo.remove(); }
}

// ---------------------------------------------------------------- áreas de resposta

function respostaVF(q, idioma, aoMudar) {
  const nomes = idioma === "en" ? ["True", "False"] : ["Verdadeiro", "Falso"];
  let valor = null;
  const botoes = [["V", "👍 " + nomes[0]], ["F", "👎 " + nomes[1]]].map(([v, rotulo]) =>
    el("button.opcao.opcao-vf", { type: "button", "data-v": v, onclick: () => escolher(v) }, rotulo));
  function escolher(v) {
    valor = v;
    botoes.forEach((b) => b.classList.toggle("escolhida", b.dataset.v === v));
    aoMudar(true);
  }
  return {
    el: el("div.opcoes.vf", botoes),
    valor: () => valor,
    mostrar(res) {
      botoes.forEach((b) => {
        b.disabled = true;
        if (b.dataset.v === res.gabarito.valor) b.classList.add("certa");
        else if (b.dataset.v === valor) b.classList.add("errada");
      });
    },
  };
}

function respostaMultipla(q, aoMudar) {
  let valor = null;
  const botoes = q.alternativas.map((a, i) =>
    el("button.opcao", { type: "button", onclick: () => escolher(a.id) },
      el("span.opcao-letra", LETRA(i)), el("span.opcao-texto", a.texto)));
  botoes.forEach((b, i) => { b.dataset.id = q.alternativas[i].id; });
  function escolher(id) {
    valor = id;
    botoes.forEach((b) => b.classList.toggle("escolhida", b.dataset.id === id));
    aoMudar(true);
  }
  return {
    el: el("div.opcoes", botoes),
    valor: () => valor,
    mostrar(res) {
      botoes.forEach((b) => {
        b.disabled = true;
        if (b.dataset.id === res.gabarito.valor) b.classList.add("certa");
        else if (b.dataset.id === valor) b.classList.add("errada");
      });
    },
  };
}

function respostaLacuna(q, aoMudar, aoEnter, enunciadoEl) {
  const lacuna = enunciadoEl.querySelector(".lacuna");
  const temFracao = /\d+\/\d+/.test(q.enunciado);
  const input = el("input.campo-lacuna", {
    type: "text", autocomplete: "off", autocapitalize: "off",
    enterKeyHint: "done", placeholder: "Digite aqui", "aria-label": "Sua resposta",
  });
  input.setAttribute("autocorrect", "off"); // senão o teclado "corrige" a resposta
  input.spellcheck = false;
  input.addEventListener("input", () => {
    if (lacuna) lacuna.textContent = input.value || " ";
    lacuna?.classList.toggle("preenchida", !!input.value.trim());
    aoMudar(!!input.value.trim());
  });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); aoEnter(); } });
  const teclas = temFracao
    ? el("div.teclas-extra", el("button.botao.secundario.pequeno", { type: "button", onclick: () => {
        input.setRangeText("/", input.selectionStart, input.selectionEnd, "end");
        input.dispatchEvent(new Event("input"));
        input.focus();
      } }, "/ (fração)"))
    : null;
  setTimeout(() => input.focus({ preventScroll: true }), 50);
  return {
    el: el("div.lacuna-area", input, teclas),
    valor: () => input.value,
    mostrar(res) {
      input.disabled = true;
      input.classList.add(res.correta ? "certa" : "errada");
      if (lacuna) lacuna.classList.add(res.correta ? "certa" : "errada");
    },
  };
}

function respostaAssociacao(q, aoMudar) {
  const pares = {}; // id da Coluna A -> id da Coluna B
  let selecionado = null; // {lado: "A"|"B", id}
  const corDe = (aId) => CORES_PARES[q.colunaA.findIndex((a) => a.id === aId) % CORES_PARES.length];
  const posA = (aId) => q.colunaA.findIndex((a) => a.id === aId) + 1;

  const botoesA = q.colunaA.map((a, i) => el("button.item-assoc", { type: "button", onclick: () => tocar("A", a.id) },
    el("span.item-marca", String(i + 1)), el("span.item-texto", a.texto), el("span.item-par")));
  const botoesB = q.colunaB.map((b, i) => el("button.item-assoc", { type: "button", onclick: () => tocar("B", b.id) },
    el("span.item-marca", letra(i)), el("span.item-texto", b.texto), el("span.item-par")));
  botoesA.forEach((b, i) => { b.dataset.id = q.colunaA[i].id; });
  botoesB.forEach((b, i) => { b.dataset.id = q.colunaB[i].id; });

  function ligar(aId, bId) {
    for (const [a, b] of Object.entries(pares)) if (b === bId) delete pares[a];
    pares[aId] = bId;
  }
  function tocar(lado, id) {
    if (selecionado && selecionado.lado !== lado) {
      const [aId, bId] = lado === "B" ? [selecionado.id, id] : [id, selecionado.id];
      ligar(aId, bId);
      selecionado = null;
    } else if (selecionado && selecionado.id === id) {
      selecionado = null;
    } else {
      const aPareado = lado === "A" ? pares[id] : Object.keys(pares).find((a) => pares[a] === id);
      if (aPareado) { // tocar num item já ligado desfaz o par
        if (lado === "A") delete pares[id]; else delete pares[aPareado];
      }
      selecionado = { lado, id };
    }
    pintar();
    aoMudar(Object.keys(pares).length === q.colunaA.length);
  }
  function pintar() {
    botoesA.forEach((b) => {
      const bId = pares[b.dataset.id];
      const ligado = !!bId;
      b.classList.toggle("ligado", ligado);
      b.classList.toggle("selecionado", selecionado?.lado === "A" && selecionado.id === b.dataset.id);
      b.style.setProperty("--par", ligado ? corDe(b.dataset.id) : "transparent");
      b.querySelector(".item-par").textContent = ligado ? "→ " + letra(q.colunaB.findIndex((x) => x.id === bId)) : "";
    });
    botoesB.forEach((b) => {
      const aId = Object.keys(pares).find((a) => pares[a] === b.dataset.id);
      b.classList.toggle("ligado", !!aId);
      b.classList.toggle("selecionado", selecionado?.lado === "B" && selecionado.id === b.dataset.id);
      b.style.setProperty("--par", aId ? corDe(aId) : "transparent");
      b.querySelector(".item-par").textContent = aId ? String(posA(aId)) : "";
    });
  }
  return {
    el: el("div.associacao",
      el("div.coluna", el("div.coluna-titulo", "Coluna A"), botoesA),
      el("div.coluna", el("div.coluna-titulo", "Coluna B"), botoesB)),
    valor: () => ({ ...pares }),
    mostrar(res) {
      [...botoesA, ...botoesB].forEach((b) => { b.disabled = true; b.classList.remove("selecionado"); });
      botoesA.forEach((b) => {
        const certo = res.detalhe ? res.detalhe[b.dataset.id] : res.correta;
        b.classList.add(certo ? "certa" : "errada");
        if (!certo) b.append(el("span.item-correcao", "Certo: " + res.gabarito.pares[b.dataset.id]));
      });
    },
  };
}

// ---------------------------------------------------------------- enunciado

function enunciadoEl(q) {
  if (q.tipo === "lacuna" && RE_LACUNA.test(q.enunciado)) {
    const [antes, ...resto] = q.enunciado.split(RE_LACUNA);
    return el("p.enunciado", antes, el("span.lacuna", " "), resto.join("____"));
  }
  return el("p.enunciado", q.tipo === "vf" ? limparVF(q.enunciado) : q.enunciado);
}

// ---------------------------------------------------------------- tela do quiz

export async function telaQuiz(raiz, tentativaId, modo = "normal") {
  let t = await api(`/api/tentativas/${tentativaId}`);
  if (modo === "normal" && t.concluida) { location.hash = `#/resultado/${tentativaId}`; return; }
  if (modo === "revisao" && !t.concluida) { location.hash = `#/quiz/${tentativaId}`; return; }

  const sim = t.simulado;
  const cor = ELEMENTOS[sim.elemento] || ELEMENTOS.vento;
  document.documentElement.style.setProperty("--tema", cor.cor);
  document.documentElement.style.setProperty("--tema-escura", cor.escura);

  const fila = modo === "normal"
    ? t.questoes
    : t.questoes.filter((q) => t.respondidas.normal[q.n] && !t.respondidas.normal[q.n].correta);
  const feitas = modo === "normal" ? t.respondidas.normal : t.respondidas.revisao;
  let sequencia = 0;

  const proximaPendente = () => fila.findIndex((q) => !feitas[q.n]);

  function barraProgresso(indiceAtual) {
    return el("div.progresso", { role: "progressbar", "aria-valuemin": 0, "aria-valuemax": fila.length, "aria-valuenow": Object.keys(feitas).length },
      fila.map((q, i) => {
        const r = feitas[q.n];
        let classe = "";
        if (r) classe = r.correta ? "certa" : r.pontos > 0 ? "meio" : "errada";
        if (i === indiceAtual) classe += " atual";
        const prev = fila[i - 1];
        return el("span.segmento" + (classe ? "." + classe.trim().split(" ").join(".") : "") + (prev && prev.parte !== q.parte ? ".nova-parte" : ""));
      }));
  }

  async function sair() {
    voz.parar();
    const ok = await perguntar({
      titulo: "Fazer uma pausa?",
      texto: modo === "normal" ? "Suas respostas ficam guardadas. Depois é só tocar em \"Continuar\"." : "Você pode voltar ao treino depois.",
      sim: "Sair", nao: "Continuar aqui",
    });
    if (ok) location.hash = `#/d/${encodeURIComponent(sim.disciplina)}`;
  }

  function cabecalho(indice) {
    const somLigado = prefs.get("som", true);
    const bSom = el("button.botao-icone", { type: "button", "aria-label": "Som", title: "Som" }, somLigado ? "🔔" : "🔕");
    bSom.addEventListener("click", () => { const v = !prefs.get("som", true); prefs.set("som", v); bSom.textContent = v ? "🔔" : "🔕"; });
    const contagem = modo === "normal" ? `Questão ${indice + 1} de ${fila.length}` : `Treino ${indice + 1} de ${fila.length}`;
    return el("header.quiz-topo",
      el("button.botao-icone", { type: "button", onclick: sair, "aria-label": "Sair", title: "Sair" }, "✕"),
      el("div.quiz-topo-meio",
        el("div.quiz-topo-texto", el("span", `${cor.icone} ${sim.disciplina} • Simulado ${sim.numero}`), el("strong", contagem)),
        barraProgresso(indice)),
      bSom);
  }

  function mostrarQuestao() {
    const indice = proximaPendente();
    if (indice === -1) return terminar();
    const q = fila[indice];
    voz.parar();
    const parte = t.partes[q.parte] || {};
    const corpoEnunciado = enunciadoEl(q);
    const conferir = el("button.botao.grande.conferir", { type: "button", disabled: true }, "Conferir");
    const aoMudar = (pronto) => { conferir.disabled = !pronto; };
    let area;
    if (q.tipo === "vf") area = respostaVF(q, sim.idioma, aoMudar);
    else if (q.tipo === "multipla") area = respostaMultipla(q, aoMudar);
    else if (q.tipo === "lacuna") area = respostaLacuna(q, aoMudar, () => { if (!conferir.disabled) conferir.click(); }, corpoEnunciado);
    else area = respostaAssociacao(q, aoMudar);

    const precisaRascunho = q.calculo || sim.disciplina === "Matemática";
    const rodape = el("footer.quiz-rodape", conferir);
    const cartao = el("article.questao" + (q.tipo === "associacao" ? ".larga" : ""),
      el("div.questao-topo",
        el("span.chip-parte", `Parte ${q.parte} • ${parte.titulo || ""}`),
        modo === "revisao" ? el("span.chip-revisao", "Treino") : null,
        sequencia >= 3 ? el("span.chip-sequencia", `🔥 ${sequencia} seguidas`) : null,
      ),
      el("div.enunciado-linha", el("span.numero-questao", q.n), corpoEnunciado, botaoFalar(q, sim.idioma)),
      el("p.instrucao", INSTRUCOES[q.tipo]),
      area.el,
      precisaRascunho ? el("button.botao.secundario.pequeno.botao-rascunho", { type: "button", onclick: () => abrirRascunho(`${tentativaId}-${q.n}`) }, "✏️ Rascunho") : null,
    );

    conferir.addEventListener("click", async () => {
      conferir.disabled = true;
      voz.parar();
      let res;
      try {
        res = await api(`/api/tentativas/${tentativaId}/respostas`, { json: { n: q.n, resposta: area.valor(), revisao: modo === "revisao" } });
      } catch (e) {
        conferir.disabled = false;
        rodape.prepend(el("p.erro-rede", "Não consegui salvar a resposta. Tente de novo."));
        return;
      }
      feitas[q.n] = res;
      area.mostrar(res);
      raiz.querySelector(".progresso")?.replaceWith(barraProgresso(indice));
      mostrarRetorno(res, q, rodape);
    });

    raiz.replaceChildren(el("div.tela-quiz", cabecalho(indice), el("main.quiz-corpo", cartao), rodape));
    window.scrollTo(0, 0);
  }

  function mostrarRetorno(res, q, rodape) {
    const parcial = !res.correta && res.pontos > 0;
    if (res.correta) {
      sequencia += 1;
      if (sequencia > 0 && sequencia % 5 === 0) { som.combo(); } else { som.acerto(); }
    } else {
      sequencia = 0;
      som.erro();
    }
    let titulo;
    if (res.correta) titulo = sorteia(ELOGIOS);
    else if (parcial && q.tipo === "associacao") {
      const certos = Object.values(res.detalhe || {}).filter(Boolean).length;
      titulo = `Quase! ${certos} de ${q.colunaA.length} pares certos.`;
    } else titulo = sorteia(ANIMO);

    const detalhes = [];
    if (res.correta && res.aviso === "acento") detalhes.push(el("p", "Repare na escrita: ", el("strong", res.gabarito.valor)));
    if (res.correta && res.aviso === "equivalente") detalhes.push(el("p", "Também vale! No gabarito está: ", el("strong", res.gabarito.valor)));
    if (!res.correta && q.tipo !== "associacao") {
      let certa = res.gabarito.valor;
      if (q.tipo === "vf") certa = (t.simulado.idioma === "en" ? { V: "True", F: "False" } : { V: "Verdadeiro", F: "Falso" })[certa];
      if (q.tipo === "multipla") certa = res.gabarito.texto;
      detalhes.push(el("p", "Resposta certa: ", el("strong", certa)));
    }
    if (!res.correta && res.pagina) detalhes.push(el("p.pagina-livro", `📖 Para revisar: livro, página ${res.pagina}`));

    const ultima = proximaPendente() === -1;
    const proximaQ = fila[proximaPendente()];
    const fimDeParte = modo === "normal" && (ultima || (proximaQ && proximaQ.parte !== q.parte));
    const seguir = el("button.botao.grande", { type: "button" }, ultima ? "Ver resultado 🎉" : "Próxima →");
    if (modo === "revisao" && ultima) seguir.textContent = "Terminar treino";
    seguir.addEventListener("click", () => {
      if (fimDeParte) return mostrarFimDeParte(q.parte);
      mostrarQuestao();
    });

    const painel = el("div.retorno." + (res.correta ? "acerto" : parcial ? "meio" : "erro"), { role: "status" },
      el("div.retorno-texto", el("strong.retorno-titulo", (res.correta ? "✅ " : parcial ? "🟡 " : "💪 ") + titulo), detalhes),
      seguir);
    rodape.replaceChildren(painel);
    if (res.correta) confete(painel.querySelector(".retorno-titulo"), sequencia % 5 === 0 ? 40 : 14);
    seguir.focus({ preventScroll: true });
  }

  function mostrarFimDeParte(numParte) {
    const daParte = fila.filter((q) => q.parte === numParte);
    const pontos = daParte.reduce((s, q) => s + (feitas[q.n]?.pontos || 0), 0);
    const proporcao = pontos / daParte.length;
    const proximaQ = fila[proximaPendente()];
    const mensagem = proporcao >= 0.85 ? "Que parte incrível!" : proporcao >= 0.6 ? "Bom trabalho!" : "Você terminou mais uma parte. Isso é o que importa!";
    const estrelas = proporcao >= 0.85 ? 3 : proporcao >= 0.6 ? 2 : 1;
    const botao = el("button.botao.grande", { type: "button", onclick: mostrarQuestao },
      proximaQ ? `Próxima parte: ${t.partes[proximaQ.parte]?.titulo || ""} →` : "Ver resultado 🎉");
    raiz.replaceChildren(el("div.tela-centro",
      el("div.fim-parte",
        el("div.estrelas-grandes", [1, 2, 3].map((i) => el("span" + (i <= estrelas ? ".acesa" : ""), { style: { "--i": i } }, "★"))),
        el("h1", `Parte ${numParte} concluída!`),
        el("p.grande", `Você fez ${numeroBR(pontos)} de ${daParte.length} pontos nesta parte.`),
        el("p", mensagem),
        botao)));
    som.acerto();
    botao.focus();
  }

  async function terminar() {
    if (modo === "normal") {
      raiz.replaceChildren(el("div.tela-centro", el("p.grande", "Calculando sua nota…")));
      await api(`/api/tentativas/${tentativaId}/concluir`, { method: "POST" });
      location.hash = `#/resultado/${tentativaId}`;
      return;
    }
    const acertos = fila.filter((q) => feitas[q.n]?.correta).length;
    raiz.replaceChildren(el("div.tela-centro",
      el("div.fim-parte",
        el("div.emoji-grande", acertos === fila.length ? "🏆" : "💪"),
        el("h1", "Treino concluído!"),
        el("p.grande", `Das ${fila.length} que você tinha errado, agora acertou ${acertos}.`),
        el("p", acertos === fila.length ? "Você corrigiu tudo. Demais!" : "Cada treino deixa você mais forte."),
        el("div.botoes-coluna",
          el("a.botao.grande", { href: `#/resultado/${tentativaId}` }, "Voltar ao resultado"),
          el("a.botao.secundario", { href: "#/" }, "Início")))));
    if (acertos === fila.length) { som.combo(); confete(null, 40); }
  }

  mostrarQuestao();
}

// ---------------------------------------------------------------- resultado

export async function telaResultado(raiz, tentativaId) {
  const t = await api(`/api/tentativas/${tentativaId}`);
  if (!t.concluida) { location.hash = `#/quiz/${tentativaId}`; return; }
  const sim = t.simulado;
  const cor = ELEMENTOS[sim.elemento] || ELEMENTOS.vento;
  document.documentElement.style.setProperty("--tema", cor.cor);
  document.documentElement.style.setProperty("--tema-escura", cor.escura);

  const erradas = t.questoes.filter((q) => t.respondidas.normal[q.n] && !t.respondidas.normal[q.n].correta);
  const feitasRevisao = erradas.filter((q) => t.respondidas.revisao[q.n]).length;
  const mensagem = { 3: "Incrível! Você é fera nisso!", 2: "Muito bom! Está quase lá!", 1: "Você terminou! Cada simulado deixa você mais preparado." }[t.estrelas];

  const areaCarta = el("div.area-carta");
  if (t.carta) {
    if (await cartaRevelada(tentativaId)) {
      areaCarta.append(cartaEl(t.carta));
    } else {
      const pacote = el("button.pacote", { type: "button", "aria-label": "Abrir carta" },
        el("span.pacote-icone", cor.icone), el("span", "Você ganhou uma carta!"), el("strong", "Toque para abrir"));
      pacote.addEventListener("click", () => {
        cartaRevelada(tentativaId, true);
        const carta = cartaEl(t.carta);
        carta.classList.add("revelando");
        areaCarta.replaceChildren(carta);
        som.carta();
        confete(carta, t.carta.raridade === "lendaria" ? 60 : 30);
      });
      areaCarta.append(pacote);
    }
  }

  let botaoTreino = null;
  if (erradas.length && feitasRevisao < erradas.length) {
    botaoTreino = el("a.botao.grande", { href: `#/quiz/${tentativaId}/revisao` },
      feitasRevisao ? `Continuar treino das erradas (${erradas.length - feitasRevisao})` : `Treinar as que errei (${erradas.length})`);
  } else if (erradas.length) {
    const corrigidas = erradas.filter((q) => t.respondidas.revisao[q.n]?.correta).length;
    botaoTreino = el("p.nota-revisao", `Treino feito: você corrigiu ${corrigidas} de ${erradas.length}.`);
  }

  raiz.replaceChildren(el("div.tela-resultado",
    el("header.topo-simples", el("a.botao-icone", { href: "#/", "aria-label": "Início" }, "🏠"), el("span", `${sim.disciplina} • ${sim.prova} • Simulado ${sim.numero}`)),
    el("section.resultado",
      el("h1", "Simulado concluído! 🎉"),
      el("div.estrelas-grandes", [1, 2, 3].map((i) => el("span" + (i <= t.estrelas ? ".acesa" : ""), { style: { "--i": i } }, "★"))),
      el("div.nota", el("small", "Nota"), formatarNota(t.nota)),
      el("p.grande", `Você fez ${numeroBR(t.pontos)} de ${t.total} pontos.`),
      el("p", mensagem),
      areaCarta,
      el("div.botoes-coluna",
        botaoTreino,
        el("a.botao.secundario", { href: "#/album" }, "📒 Ver meu álbum"),
        el("a.botao.secundario", { href: `#/d/${encodeURIComponent(sim.disciplina)}` }, "Escolher outro simulado"),
      ),
    ),
  ));
  if (t.estrelas === 3) confete(null, 50);
}
