// Figuras das questões de fração: desenha em SVG o que, no livro, vinha impresso
// (barra em partes, pizza em fatias, reta numerada, coleção de itens).
// Dois usos: ilustrar uma questão comum (campo `figura`) e ser a própria resposta
// no tipo "pintar", em que a criança toca nas partes.
//
// Formato do campo `figura` na questão:
//   { tipo: "barra",    partes: 6, pintadas: 4 }
//   { tipo: "circulo",  partes: 8, pintadas: 3 }
//   { tipo: "reta",     partes: 5, marca: 3 }
//   { tipo: "colecao",  itens: 10, destacados: 5, nome: "laranjas", icone: "🍊" }
//   { tipo: "comparar", figuras: [{...}, {...}], rotulos: ["A", "B"] }
//   { tipo: "mapa",     titulo, faixas: [5 nomes], valores: { SP: 4, ... }, descricao: "texto do 🔊" }
//   { tipo: "estados-agua" }  — diagrama fixo da pág. 90 de Ciências, sem parâmetros
// Nas questões de pintar, a figura vem SEM `pintadas` (senão a resposta apareceria desenhada).

const N = (v, padrao = 0) => (Number.isFinite(Number(v)) ? Number(v) : padrao);
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

function elSvg(tag, attrs = {}) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) e.setAttribute(k, String(v));
  return e;
}

function setor(cx, cy, r, a0, a1) {
  const p = (a) => [(cx + r * Math.cos(a)).toFixed(2), (cy + r * Math.sin(a)).toFixed(2)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  const grande = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${grande} 1 ${x1} ${y1} Z`;
}

// --------------------------------------------------------------- descrição em texto
// Usada na leitura em voz alta e como aria-label (a figura nunca é só cor).

export function descreverFigura(fig) {
  if (!fig || !fig.tipo) return "";
  if (fig.tipo === "comparar") {
    const rotulos = fig.rotulos || [];
    return (fig.figuras || []).map((f, i) => `${rotulos[i] ? rotulos[i] + ": " : ""}${descreverFigura(f)}`).join(" ");
  }
  const partes = N(fig.partes), pintadas = N(fig.pintadas);
  if (fig.tipo === "barra" || fig.tipo === "circulo") {
    const todo = fig.tipo === "barra" ? "uma barra dividida em" : "uma figura redonda dividida em";
    const nomeParte = fig.tipo === "barra" ? ["parte", "partes"] : ["fatia", "fatias"];
    const base = `${todo} ${plural(partes, nomeParte[0] + " igual", nomeParte[1] + " iguais")}`;
    if (fig.pintadas === undefined || fig.pintadas === null) return `${base}, nenhuma pintada ainda.`;
    return `${base}, com ${plural(pintadas, nomeParte[0] + " pintada", nomeParte[1] + " pintadas")}.`;
  }
  if (fig.tipo === "reta") {
    const marca = N(fig.marca);
    return `uma reta numerada de 0 a 1 dividida em ${plural(partes, "parte igual", "partes iguais")}, com a marca número ${marca} destacada.`;
  }
  if (fig.tipo === "colecao") {
    const nome = fig.nome || "itens";
    return `${N(fig.itens)} ${nome}, com ${N(fig.destacados)} em destaque.`;
  }
  // O mapa traz a descrição pronta no conteúdo: é ela que o 🔊 lê e que vira o aria-label, e ela
  // não pode depender de brasil.js, que só carrega depois. `tests/` confere que bate com `valores`.
  if (fig.tipo === "mapa") return fig.descricao || "";
  if (fig.tipo === "estados-agua") {
    return "Diagrama dos estados físicos da água. O gelo é o estado sólido, a água é o líquido e o vapor "
      + "de água é o gasoso. Do sólido para o líquido é a fusão; do líquido para o gasoso, a vaporização. "
      + "Voltando: do gasoso para o líquido é a condensação; do líquido para o sólido, a solidificação. "
      + "As setas vermelhas são as que precisam de calor e as azuis, as que precisam de esfriar.";
  }
  return "";
}

// --------------------------------------------------------------- desenho

// Uma barra em `partes` partes iguais. `pintadas` pode ser número ou lista de índices.
function barraEl(fig, pintadasSet) {
  const partes = Math.max(1, N(fig.partes, 1));
  const larg = 40, alt = 48;
  const s = elSvg("svg", {
    class: "figura figura-barra", viewBox: `0 0 ${partes * larg} ${alt}`,
    preserveAspectRatio: "xMidYMid meet", focusable: "false",
  });
  for (let i = 0; i < partes; i++) {
    const r = elSvg("rect", {
      class: "parte" + (pintadasSet.has(i) ? " pintada" : ""),
      x: i * larg, y: 0, width: larg, height: alt, "data-i": i,
    });
    s.append(r);
  }
  return s;
}

// Uma "pizza" em `partes` fatias iguais.
function circuloEl(fig, pintadasSet) {
  const partes = Math.max(1, N(fig.partes, 1));
  const cx = 60, cy = 60, r = 54;
  const s = elSvg("svg", {
    class: "figura figura-circulo", viewBox: "0 0 120 120",
    preserveAspectRatio: "xMidYMid meet", focusable: "false",
  });
  const passo = (2 * Math.PI) / partes;
  for (let i = 0; i < partes; i++) {
    const a0 = -Math.PI / 2 + i * passo;
    s.append(elSvg("path", {
      class: "parte" + (pintadasSet.has(i) ? " pintada" : ""),
      d: setor(cx, cy, r, a0, a0 + passo), "data-i": i,
    }));
  }
  return s;
}

// Reta numerada de 0 a 1, dividida em `partes`, com a marca `marca` destacada.
function retaEl(fig) {
  const partes = Math.max(1, N(fig.partes, 1));
  const marca = N(fig.marca, 0);
  const x0 = 24, x1 = 376, y = 44;
  const s = elSvg("svg", {
    class: "figura figura-reta", viewBox: "0 0 400 72",
    preserveAspectRatio: "xMidYMid meet", focusable: "false",
  });
  s.append(elSvg("line", { class: "eixo", x1: x0, y1: y, x2: x1, y2: y }));
  for (let i = 0; i <= partes; i++) {
    const x = x0 + ((x1 - x0) * i) / partes;
    const destacada = i === marca;
    s.append(elSvg("line", { class: "risco" + (destacada ? " destacada" : ""), x1: x, y1: y - (destacada ? 18 : 10), x2: x, y2: y + (destacada ? 18 : 10) }));
    if (i === 0 || i === partes) {
      const t = elSvg("text", { class: "rotulo", x, y: y + 34, "text-anchor": "middle" });
      t.textContent = i === 0 ? "0" : "1";
      s.append(t);
    }
  }
  const xm = x0 + ((x1 - x0) * marca) / partes;
  s.append(elSvg("circle", { class: "marca", cx: xm, cy: y, r: 9 }));
  return s;
}

// Uma coleção de itens iguais (ovos, laranjas, lápis), alguns em destaque.
function colecaoEl(fig) {
  const itens = Math.max(1, N(fig.itens, 1));
  const destacados = N(fig.destacados);
  const porLinha = Math.min(itens, 10);
  const linhas = Math.ceil(itens / porLinha);
  const passo = 40, r = 16;
  const s = elSvg("svg", {
    class: "figura figura-colecao", viewBox: `0 0 ${porLinha * passo} ${linhas * passo}`,
    preserveAspectRatio: "xMidYMid meet", focusable: "false",
  });
  for (let i = 0; i < itens; i++) {
    const cx = (i % porLinha) * passo + passo / 2;
    const cy = Math.floor(i / porLinha) * passo + passo / 2;
    s.append(elSvg("circle", { class: "parte" + (i < destacados ? " pintada" : ""), cx, cy, r }));
    if (fig.icone) {
      const t = elSvg("text", { class: "icone", x: cx, y: cy + 7, "text-anchor": "middle" });
      t.textContent = fig.icone;
      s.append(t);
    }
  }
  return s;
}

function conjunto(pintadas, partes) {
  if (Array.isArray(pintadas)) return new Set(pintadas.map(Number));
  const n = N(pintadas);
  return new Set(Array.from({ length: Math.min(n, N(partes, n)) }, (_, i) => i));
}

// Mapa do Brasil pintado por faixa (`valores`: sigla -> índice em `faixas`). A geometria mora em
// brasil.js e é pesada, então entra por import tardio: a caixa já volta com o aria-label e a legenda,
// e os contornos aparecem quando chegam. Estados pequenos demais levam a sigla para fora, com linha
// de chamada. A cor nunca é a única pista: há sigla, legenda e a descrição falada.
const CORES_MAPA = ["#FFFBE3", "#FBC23C", "#EE7A1A", "#CC2C1E", "#78183F"];
const TINTA_MAPA = ["#1F2430", "#1F2430", "#1F2430", "#FFFFFF", "#FFFFFF"];
const SEM_DADO = "#E7E1D7";

function mapaEl(fig) {
  const caixa = divCom("figura-mapa");
  const desenho = divCom("figura-mapa-desenho");
  const faixas = fig.faixas || [];
  const legenda = divCom("figura-mapa-legenda");
  faixas.forEach((nome, i) => {
    const linha = divCom("figura-mapa-item");
    const amostra = divCom("figura-mapa-cor");
    amostra.style.background = CORES_MAPA[i] || SEM_DADO;
    linha.append(amostra, document.createTextNode(nome));
    legenda.prepend(linha); // da maior faixa para a menor, como no livro
  });
  caixa.append(desenho, legenda);
  import("./brasil.js").then(({ UFS }) => {
    const svg = elSvg("svg", { viewBox: "0 0 1180 1000", class: "mapa-svg" });
    // Contorno cinza fino por cima da separação branca: sem ele os estados das faixas mais claras
    // (contraste de 1,04:1 contra o cartão) somem no fundo. 3,37:1 na faixa clara, 2,99:1 na escura.
    const contornos = [], chamadas = [], textos = [];
    for (const [sigla, uf] of Object.entries(UFS)) {
      const faixa = fig.valores ? fig.valores[sigla] : undefined;
      svg.append(elSvg("path", {
        d: uf.d, fill: faixa === undefined ? SEM_DADO : CORES_MAPA[faixa],
        stroke: "#fff", "stroke-width": 3.5, "stroke-linejoin": "round",
      }));
      contornos.push(elSvg("path", { d: uf.d, fill: "none", stroke: "#8C8698", "stroke-width": 1.4, "stroke-linejoin": "round" }));
      if (uf.f) {
        chamadas.push(elSvg("line", { x1: uf.c[0], y1: uf.c[1], x2: uf.f[0] - 14, y2: uf.f[1], stroke: "#9A93A8", "stroke-width": 2.5 }));
        chamadas.push(elSvg("circle", { cx: uf.c[0], cy: uf.c[1], r: 6, fill: "#4A4455" }));
        const t = elSvg("text", { x: uf.f[0], y: uf.f[1], fill: "#1F2430", "font-size": 34, "font-weight": 800, "dominant-baseline": "central" });
        t.textContent = sigla;
        textos.push(t);
      } else {
        const t = elSvg("text", {
          x: uf.c[0], y: uf.c[1], fill: faixa === undefined ? "#5E6472" : TINTA_MAPA[faixa],
          "font-size": 34, "font-weight": 800, "text-anchor": "middle", "dominant-baseline": "central",
        });
        t.textContent = sigla;
        textos.push(t);
      }
    }
    svg.append(...contornos, ...chamadas, ...textos); // contornos, linhas e siglas por cima de todos os estados
    desenho.replaceChildren(svg);
  }).catch(() => {
    // sem a geometria, a legenda e a descrição ainda respondem a questão
    desenho.remove();
  });
  return caixa;
}

function divCom(classe) {
  const d = document.createElement("div");
  d.className = classe;
  return d;
}

// Diagrama dos estados físicos da água (Ciências, Cap. 9, pág. 90), redesenhado — nunca a imagem do
// livro. Não tem parâmetro: é sempre o mesmo. Vermelho = precisa de calor, azul = precisa esfriar,
// mas a cor nunca decide sozinha: cada seta leva o nome do processo escrito.
const AGUA_T = "#17304A", AGUA_VIDRO = "#CBD9E4", AGUA_LIQ = "#6FA8D4",
      AGUA_GELO = "#BFE0F2", AGUA_GELOB = "#8FC4E0", AGUA_VAPOR = "#D9E6F0",
      AGUA_QUENTE = "#CC2C1E", AGUA_FRIO = "#3B5BC4";

function estadosAguaEl() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = elSvg("svg", { viewBox: "0 0 640 310", class: "figura-estados" });
  const bruto = [];
  const marcador = (cor, id) => `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${cor}"/></marker>`;
  bruto.push(`<defs>${marcador(AGUA_QUENTE, "setaQ")}${marcador(AGUA_FRIO, "setaF")}`
    + `<linearGradient id="termo"><stop offset="0" stop-color="${AGUA_FRIO}"/><stop offset="1" stop-color="${AGUA_QUENTE}"/></linearGradient></defs>`);
  const copo = (x) => `<path d="M${x},96 L${x + 12},208 L${x + 82},208 L${x + 94},96" fill="none" stroke="${AGUA_VIDRO}" stroke-width="7" stroke-linejoin="round"/>`;
  const seta = (d, cor, id) => `<path d="${d}" fill="none" stroke="${cor}" stroke-width="7" stroke-linecap="round" marker-end="url(#${id})"/>`;
  const rotulo = (x, y, t, cor, tam = 18) => `<text x="${x}" y="${y}" font-size="${tam}" font-weight="800" fill="${cor}" text-anchor="middle">${t}</text>`;
  bruto.push(rotulo(69, 80, "gelo", AGUA_T, 19), rotulo(320, 80, "água", AGUA_T, 19), rotulo(571, 80, "vapor de água", AGUA_T, 19));
  bruto.push(copo(22));
  for (const [dx, dy] of [[18, 150], [52, 146], [36, 176], [70, 172], [20, 186], [60, 196]]) {
    bruto.push(`<rect x="${28 + dx}" y="${dy}" width="26" height="22" rx="5" fill="${AGUA_GELO}" stroke="${AGUA_GELOB}" stroke-width="3"/>`);
  }
  bruto.push(copo(273), `<path d="M278,142 L286,208 L356,208 L364,142 Z" fill="${AGUA_LIQ}"/>`);
  bruto.push(copo(524));
  for (const [dx, dy] of [[28, 120], [62, 104], [90, 132], [46, 150], [80, 168], [36, 186]]) {
    bruto.push(`<circle cx="${524 + dx}" cy="${dy}" r="9" fill="${AGUA_VAPOR}" stroke="${AGUA_VIDRO}" stroke-width="3"/>`);
  }
  bruto.push(seta("M124,134 C166,122 206,122 258,134", AGUA_QUENTE, "setaQ"), rotulo(191, 108, "Fusão", AGUA_QUENTE));
  bruto.push(seta("M258,172 C206,184 166,184 124,172", AGUA_FRIO, "setaF"), rotulo(191, 212, "Solidificação", AGUA_FRIO));
  bruto.push(seta("M376,134 C418,122 458,122 510,134", AGUA_QUENTE, "setaQ"), rotulo(443, 108, "Vaporização", AGUA_QUENTE));
  bruto.push(seta("M510,172 C458,184 418,184 376,172", AGUA_FRIO, "setaF"), rotulo(443, 212, "Condensação", AGUA_FRIO));
  bruto.push(rotulo(69, 238, "sólido", AGUA_T, 17), rotulo(320, 238, "líquido", AGUA_T, 17), rotulo(571, 238, "gasoso", AGUA_T, 17));
  bruto.push(`<rect x="22" y="262" width="596" height="24" rx="12" fill="url(#termo)"/>`);
  bruto.push(`<text x="40" y="280" font-size="15" font-weight="800" fill="#fff">fria</text>`);
  bruto.push(rotulo(320, 280, "temperatura", "#fff", 15));
  bruto.push(`<text x="600" y="280" font-size="15" font-weight="800" fill="#fff" text-anchor="end">quente</text>`);
  svg.innerHTML = bruto.join("");
  return svg;
}

function umaFigura(fig) {
  if (fig.tipo === "barra") return barraEl(fig, conjunto(fig.pintadas, fig.partes));
  if (fig.tipo === "circulo") return circuloEl(fig, conjunto(fig.pintadas, fig.partes));
  if (fig.tipo === "reta") return retaEl(fig);
  if (fig.tipo === "colecao") return colecaoEl(fig);
  if (fig.tipo === "estados-agua") return estadosAguaEl();
  return null;
}

// Figura para ilustrar uma questão (sem interação).
export function figuraEl(fig) {
  if (!fig || !fig.tipo) return null;
  const descricao = descreverFigura(fig);
  if (fig.tipo === "mapa") {
    const caixa = mapaEl(fig);
    caixa.setAttribute("role", "img");
    caixa.setAttribute("aria-label", descricao);
    return caixa;
  }
  if (fig.tipo === "comparar") {
    const rotulos = fig.rotulos || [];
    const caixa = document.createElement("div");
    caixa.className = "figura-comparar";
    caixa.setAttribute("role", "img");
    caixa.setAttribute("aria-label", descricao);
    (fig.figuras || []).forEach((f, i) => {
      const linha = document.createElement("div");
      linha.className = "figura-linha";
      if (rotulos[i]) {
        const r = document.createElement("strong");
        r.className = "figura-rotulo";
        r.textContent = rotulos[i];
        linha.append(r);
      }
      const desenho = umaFigura(f);
      if (desenho) linha.append(desenho);
      caixa.append(linha);
    });
    return caixa;
  }
  const s = umaFigura(fig);
  if (!s) return null;
  s.setAttribute("role", "img");
  s.setAttribute("aria-label", descricao);
  return s;
}

// Figura em que a criança pinta as partes tocando nelas.
// Devolve { el, pintadas() } — `pintadas()` é a lista de índices pintados.
export function figuraInterativa(fig, aoMudar) {
  const partes = Math.max(1, N(fig.partes, 1));
  const pintadas = new Set();
  const s = fig.tipo === "circulo" ? circuloEl(fig, pintadas) : barraEl(fig, pintadas);
  s.classList.add("figura-pintar");
  s.setAttribute("aria-label", `${descreverFigura({ ...fig, pintadas: undefined })} Toque nas partes para pintar.`);

  const alvos = [...s.querySelectorAll(".parte")];
  alvos.forEach((alvo, i) => {
    alvo.setAttribute("tabindex", "0");
    alvo.setAttribute("role", "checkbox");
    alvo.setAttribute("aria-checked", "false");
    alvo.setAttribute("aria-label", `Parte ${i + 1} de ${partes}`);
    const alternar = () => {
      if (s.classList.contains("travada")) return;
      if (pintadas.has(i)) pintadas.delete(i); else pintadas.add(i);
      alvo.classList.toggle("pintada", pintadas.has(i));
      alvo.setAttribute("aria-checked", pintadas.has(i) ? "true" : "false");
      aoMudar(pintadas.size > 0);
    };
    alvo.addEventListener("click", alternar);
    alvo.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); alternar(); }
    });
  });

  return {
    el: s,
    pintadas: () => [...pintadas].sort((a, b) => a - b),
    travar() {
      s.classList.add("travada");
      alvos.forEach((a) => { a.setAttribute("tabindex", "-1"); });
    },
  };
}
