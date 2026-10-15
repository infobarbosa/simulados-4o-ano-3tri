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

function umaFigura(fig) {
  if (fig.tipo === "barra") return barraEl(fig, conjunto(fig.pintadas, fig.partes));
  if (fig.tipo === "circulo") return circuloEl(fig, conjunto(fig.pintadas, fig.partes));
  if (fig.tipo === "reta") return retaEl(fig);
  if (fig.tipo === "colecao") return colecaoEl(fig);
  return null;
}

// Figura para ilustrar uma questão (sem interação).
export function figuraEl(fig) {
  if (!fig || !fig.tipo) return null;
  const descricao = descreverFigura(fig);
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
