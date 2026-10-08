// Regras do app, sem DOM e sem armazenamento: correção, embaralhamento e nota.
// É a versão em JavaScript do `correcao.py` do app com servidor (simulados-vitor); se uma regra mudar lá, mude aqui.
//
// - V/F e múltipla escolha: certo ou errado.
// - Associação: vale 1 ponto dividido entre os pares. Itens da Coluna B com o mesmo texto são equivalentes.
// - Lacunas: ignora maiúsculas, espaços extras e pontuação final. Diferença só de acento conta como certo
//   (a tela mostra a grafia correta). Números e frações equivalentes contam como certo.

export function criarRng(semente) { // mulberry32
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const semAcento = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");

export function normalizar(texto) {
  let t = String(texto).normalize("NFC").trim().toLowerCase();
  t = t.replace(/^["'“”‘’ ]+|["'“”‘’ ]+$/g, "");
  t = t.replace(/[.!;:]+$/, "");
  t = t.replace(/\s+/g, " ");
  t = t.replace(/\s*\/\s*/g, "/");
  return t.replace(/^-+/, "").trim();
}

// Número ou fração como [numerador, denominador] inteiros (null se não for número).
function comoNumero(texto) {
  let t = texto.replace(/ /g, "");
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ""); // 1.500 -> 1500
  t = t.replace(",", ".");
  let m;
  if ((m = /^(-?\d+)(?:\.(\d+))?$/.exec(t))) {
    const casas = (m[2] || "").length;
    return [Number(m[1] + (m[2] || "")), 10 ** casas];
  }
  if ((m = /^(-?\d+)\/(\d+)$/.exec(t))) return Number(m[2]) === 0 ? null : [Number(m[1]), Number(m[2])];
  return null;
}

export function corrigirLacuna(resposta, gabarito) {
  const r = normalizar(resposta || ""), g = normalizar(gabarito);
  if (!r) return { pontos: 0, aviso: null };
  if (r === g) return { pontos: 1, aviso: null };
  if (semAcento(r) === semAcento(g)) return { pontos: 1, aviso: "acento" };
  const nr = comoNumero(r), ng = comoNumero(g);
  if (nr && ng && nr[0] * ng[1] === ng[0] * nr[1]) {
    // 1.500 x 1500 é só formatação; 1/2 x 3/6 é outra fração (vale, mas mostramos a do gabarito)
    return { pontos: 1, aviso: (r + g).includes("/") ? "equivalente" : null };
  }
  return { pontos: 0, aviso: null };
}

export function corrigir(questao, resposta) {
  const gabarito = questao.resposta;
  let pontos, aviso = null, detalhe = null;
  if (questao.tipo === "vf") {
    pontos = String(resposta).toUpperCase().slice(0, 1) === gabarito ? 1 : 0;
  } else if (questao.tipo === "multipla") {
    pontos = String(resposta).toUpperCase() === gabarito ? 1 : 0;
  } else if (questao.tipo === "lacuna") {
    ({ pontos, aviso } = corrigirLacuna(String(resposta ?? ""), gabarito));
  } else if (questao.tipo === "associacao") {
    const textosB = Object.fromEntries(questao.colunaB.map((i) => [i.id, normalizar(i.texto)]));
    const resp = resposta && typeof resposta === "object" ? resposta : {};
    detalhe = {};
    const ids = Object.keys(gabarito);
    for (const aId of ids) {
      const escolhido = resp[aId];
      detalhe[aId] = escolhido !== undefined && escolhido !== null && textosB[escolhido] === textosB[gabarito[aId]];
    }
    pontos = ids.length ? Object.values(detalhe).filter(Boolean).length / ids.length : 0;
  } else {
    throw new Error(`Tipo de questão desconhecido: ${questao.tipo}`);
  }
  pontos = Math.round(pontos * 10000) / 10000;
  return { pontos, correta: pontos >= 1, aviso, detalhe };
}

export function gabaritoParaExibir(q) {
  const r = q.resposta;
  if (q.tipo === "vf" || q.tipo === "lacuna") return { valor: r };
  if (q.tipo === "multipla") {
    const alt = q.alternativas.find((a) => a.id === r);
    return { valor: r, texto: alt ? alt.texto : "" };
  }
  const b = Object.fromEntries(q.colunaB.map((i) => [i.id, i.texto]));
  return { pares: Object.fromEntries(Object.entries(r).map(([a, bId]) => [a, b[bId] ?? ""])) };
}

function embaralhar(lista, rnd) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

// Ordem das alternativas e da Coluna B, por questão (as partes ficam na ordem do PDF).
export function sortearOrdem(questoes, semente) {
  const rnd = criarRng(semente);
  const ordem = {};
  for (const q of questoes) {
    if (q.tipo === "multipla") ordem[q.n] = embaralhar(q.alternativas.map((a) => a.id), rnd);
    else if (q.tipo === "associacao") ordem[q.n] = embaralhar(q.colunaB.map((b) => b.id), rnd);
  }
  return ordem;
}

// Versão da questão sem o gabarito e com a ordem sorteada aplicada.
export function questaoParaAluno(questao, ordem) {
  const { resposta, ...q } = questao;
  const ids = ordem[questao.n];
  if (ids) {
    const chave = questao.tipo === "multipla" ? "alternativas" : "colunaB";
    const porId = Object.fromEntries(questao[chave].map((i) => [i.id, i]));
    q[chave] = ids.filter((i) => porId[i]).map((i) => porId[i]);
  }
  return q;
}

export function estrelasPorNota(nota) {
  if (nota === null || nota === undefined) return 0;
  return nota >= 9 ? 3 : nota >= 7 ? 2 : 1;
}

export function validar(s) {
  const problemas = [];
  if (!s || !Array.isArray(s.questoes) || !s.questoes.length) return ["simulado sem questões"];
  const vistos = new Set();
  for (const q of s.questoes) {
    if (vistos.has(q.n)) problemas.push(`questão ${q.n} repetida`);
    vistos.add(q.n);
    if (q.resposta === undefined || q.resposta === null || q.resposta === "") problemas.push(`questão ${q.n} sem gabarito`);
  }
  return problemas;
}
