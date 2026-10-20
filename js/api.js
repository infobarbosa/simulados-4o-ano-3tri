// "Servidor" dentro do navegador: guarda o progresso no aparelho (localStorage) e responde às mesmas
// chamadas que as telas fazem (/api/catalogo, /api/tentativas...). O conteúdo vem de conteudo/*.json.

import * as M from "./motor.js";
import { sortearCarta, ELEMENTO_POR_DISCIPLINA } from "./cartas.js";

const CHAVE = "s4a3t_estado_v1";
const DISCIPLINAS = ["Matemática", "Português", "Gramática", "Ciências", "Geografia", "História", "Bilíngue"];

let catalogo = null;          // lista de simulados (sem questões)
let estado = null;            // progresso (ver estadoVazio)
let persistente = true;       // false quando o navegador bloqueia o armazenamento
const simulados = new Map();  // id -> conteúdo completo, carregado sob demanda
const materias = new Map();   // arquivo -> mini-aulas de conteudo/materia/, carregadas sob demanda

const estadoVazio = () => ({ versao: 1, nome: "", proximo_id: 1, tentativas: [], cartas: [], reveladas: [] });

class ErroApi extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}

// ---------------------------------------------------------------- armazenamento

function lerEstado() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) return { ...estadoVazio(), ...JSON.parse(bruto) };
  } catch { persistente = false; }
  return estadoVazio();
}

function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
    persistente = true;
  } catch { persistente = false; }
}

export const armazenamentoOk = () => persistente;

async function buscarJson(caminho) {
  let r;
  try { r = await fetch(caminho); } catch { r = null; }
  if (!r || !r.ok) throw new ErroApi(r ? r.status : 0, "Não consegui carregar os simulados. Confira a internet e tente de novo.");
  return r.json();
}

async function iniciar() {
  if (catalogo) return;
  catalogo = await buscarJson("conteudo/catalogo.json");
  estado = lerEstado();
}

async function simulado(id) {
  if (!simulados.has(id)) {
    if (!catalogo.some((s) => s.id === id)) throw new ErroApi(404, "Simulado não encontrado.");
    const dados = await buscarJson(`conteudo/${id}.json`);
    const problemas = M.validar(dados);
    if (problemas.length) throw new ErroApi(500, "Simulado inválido: " + problemas.join("; "));
    simulados.set(id, dados);
  }
  return simulados.get(id);
}

// Mini-aulas que o botão "Ler o conteúdo" abre na tela da questão. O simulado aponta o arquivo
// no campo "materia" e cada questão aponta o tópico no campo "ajuda".
async function materia(arquivo) {
  if (!materias.has(arquivo)) {
    if (!/^[\w-]+$/.test(arquivo)) throw new ErroApi(400, "Matéria inválida.");
    const dados = await buscarJson(`conteudo/materia/${arquivo}.json`);
    if (!dados.topicos) throw new ErroApi(500, "Matéria sem tópicos.");
    materias.set(arquivo, dados);
  }
  return materias.get(arquivo);
}

async function rotaMateria(arquivo, topico) {
  const dados = await materia(arquivo);
  const t = dados.topicos[topico];
  if (!t) throw new ErroApi(404, "Conteúdo não encontrado.");
  return { ...t, materia: dados.titulo, fonte: dados.fonte || null };
}

const agora = () => new Date().toISOString();

function tentativaPorId(id) {
  const t = estado.tentativas.find((x) => x.id === id);
  if (!t) throw new ErroApi(404, "Tentativa não encontrada.");
  return t;
}

// ---------------------------------------------------------------- rotas

function rotaCatalogo() {
  const porSim = {};
  for (const t of estado.tentativas) {
    const p = (porSim[t.simulado_id] ||= { melhor: null, feitas: 0, aberta: null });
    if (t.concluida_em) {
      p.feitas++;
      if (p.melhor === null || t.nota > p.melhor) p.melhor = t.nota;
    } else p.aberta = t.id;
  }
  const disciplinas = {};
  for (const s of catalogo) {
    const d = (disciplinas[s.disciplina] ||= { disciplina: s.disciplina, elemento: ELEMENTO_POR_DISCIPLINA[s.disciplina] || "vento", provas: {} });
    const p = porSim[s.id];
    (d.provas[s.prova] ||= []).push({
      id: s.id, numero: s.numero, titulo: s.titulo, tema: s.tema,
      melhor_nota: p ? p.melhor : null, estrelas: M.estrelasPorNota(p ? p.melhor : null),
      feitas: p ? p.feitas : 0, tentativa_aberta: p ? p.aberta : null,
    });
  }
  const ordem = (n) => (DISCIPLINAS.includes(n) ? DISCIPLINAS.indexOf(n) : 99);
  return Object.values(disciplinas).sort((a, b) => ordem(a.disciplina) - ordem(b.disciplina)).map((d) => ({
    ...d,
    provas: Object.entries(d.provas)
      .sort(([a], [b]) => (a === "P1" ? 0 : 1) - (b === "P1" ? 0 : 1) || a.localeCompare(b))
      .map(([prova, lista]) => ({ prova, simulados: lista.sort((x, y) => x.numero - y.numero) })),
  }));
}

async function rotaNovaTentativa(simuladoId) {
  const conteudo = await simulado(simuladoId);
  const id = estado.proximo_id++;
  // Só uma tentativa aberta por simulado: as antigas não concluídas são descartadas.
  estado.tentativas = estado.tentativas.filter((t) => t.simulado_id !== simuladoId || t.concluida_em);
  estado.tentativas.push({
    id, simulado_id: simuladoId, iniciada_em: agora(), concluida_em: null,
    ordem: M.sortearOrdem(conteudo.questoes, Math.floor(Math.random() * 2 ** 31)),
    total: conteudo.questoes.length, nota: null, pontos: null, respostas: [],
  });
  salvar();
  return { id };
}

function resultadoResposta(q, r) {
  return {
    n: q.n, resposta: r.resposta, pontos: r.pontos, correta: !!r.correta, aviso: r.aviso ?? null,
    detalhe: r.detalhe ?? null, gabarito: M.gabaritoParaExibir(q), pagina: q.pagina ?? null,
  };
}

async function rotaVerTentativa(id) {
  const t = tentativaPorId(id);
  const conteudo = await simulado(t.simulado_id);
  const meta = catalogo.find((s) => s.id === t.simulado_id);
  const porN = Object.fromEntries(conteudo.questoes.map((q) => [q.n, q]));
  const respondidas = { normal: {}, revisao: {} };
  for (const r of t.respostas) respondidas[r.revisao ? "revisao" : "normal"][r.n] = resultadoResposta(porN[r.n], r);
  return {
    id: t.id,
    simulado: {
      id: meta.id, disciplina: meta.disciplina, prova: meta.prova, numero: meta.numero, titulo: meta.titulo,
      tema: meta.tema, idioma: meta.idioma, elemento: ELEMENTO_POR_DISCIPLINA[meta.disciplina] || "vento",
      materia: conteudo.materia || null,
    },
    partes: conteudo.partes || {},
    questoes: conteudo.questoes.map((q) => M.questaoParaAluno(q, t.ordem)),
    respondidas,
    concluida: !!t.concluida_em,
    nota: t.nota, pontos: t.pontos, total: t.total,
    estrelas: M.estrelasPorNota(t.nota),
    carta: estado.cartas.find((c) => c.tentativa_id === id) || null,
  };
}

async function rotaResponder(id, corpo) {
  const t = tentativaPorId(id);
  const conteudo = await simulado(t.simulado_id);
  const q = conteudo.questoes.find((x) => x.n === corpo.n);
  if (!q) throw new ErroApi(404, "Questão não encontrada.");
  const revisao = !!corpo.revisao;
  if (revisao && !t.concluida_em) throw new ErroApi(409, "A revisão só existe depois de terminar o simulado.");
  if (!revisao && t.concluida_em) throw new ErroApi(409, "Este simulado já foi concluído.");
  const existente = t.respostas.find((r) => r.n === corpo.n && r.revisao === revisao);
  if (existente) return resultadoResposta(q, existente); // toque duplo: devolve a mesma correção
  const c = M.corrigir(q, corpo.resposta);
  const r = { n: corpo.n, revisao, resposta: corpo.resposta, pontos: c.pontos, correta: c.correta, aviso: c.aviso, detalhe: c.detalhe, respondida_em: agora() };
  t.respostas.push(r);
  salvar();
  return resultadoResposta(q, r);
}

async function rotaConcluir(id) {
  const t = tentativaPorId(id);
  if (!t.concluida_em) {
    const conteudo = await simulado(t.simulado_id);
    const normais = t.respostas.filter((r) => !r.revisao);
    const total = conteudo.questoes.length;
    if (normais.length < total) throw new ErroApi(409, `Ainda faltam ${total - normais.length} questões.`);
    const pontos = normais.reduce((s, r) => s + r.pontos, 0);
    t.pontos = Math.round(pontos * 100) / 100;
    t.total = total;
    t.nota = Math.round((pontos / total) * 100) / 10;
    t.concluida_em = agora();
    const meta = catalogo.find((s) => s.id === t.simulado_id);
    estado.cartas.push({ id: estado.proximo_id++, tentativa_id: id, ...sortearCarta(meta.disciplina, t.nota), obtida_em: t.concluida_em });
    salvar();
  }
  return rotaVerTentativa(id);
}

const rotaAlbum = () => [...estado.cartas].sort((a, b) => b.obtida_em.localeCompare(a.obtida_em) || b.id - a.id);

// ---------------------------------------------------------------- ponto de entrada (mesma forma do fetch)

export async function api(caminho, opcoes = {}) {
  await iniciar();
  const metodo = opcoes.method || (opcoes.json !== undefined ? "POST" : "GET");
  let m;
  if (metodo === "GET" && caminho === "/api/catalogo") return rotaCatalogo();
  if (metodo === "GET" && caminho === "/api/album") return rotaAlbum();
  if (metodo === "GET" && (m = /^\/api\/materia\/([\w-]+)\/([\w-]+)$/.exec(caminho))) return rotaMateria(m[1], m[2]);
  if (metodo === "POST" && (m = /^\/api\/simulados\/([\w-]+)\/tentativas$/.exec(caminho))) return rotaNovaTentativa(m[1]);
  if ((m = /^\/api\/tentativas\/(\d+)(\/respostas|\/concluir)?$/.exec(caminho))) {
    const id = Number(m[1]);
    if (!m[2] && metodo === "GET") return rotaVerTentativa(id);
    if (m[2] === "/respostas" && metodo === "POST") return rotaResponder(id, opcoes.json);
    if (m[2] === "/concluir" && metodo === "POST") return rotaConcluir(id);
  }
  throw new ErroApi(404, `Rota desconhecida: ${metodo} ${caminho}`);
}

// ---------------------------------------------------------------- nome, backup e reinício (tela Ajustes)

// ---------------------------------------------------------------- aceite dos termos de uso
// Guardado à parte do progresso: restaurar um backup não aceita por você e apagar o progresso não desfaz o aceite.

const CHAVE_TERMOS = "s4a3t_termos_v1";
let termosMemoria = null;

export function termosAceitos() {
  try { const bruto = localStorage.getItem(CHAVE_TERMOS); if (bruto) return JSON.parse(bruto); } catch { /* sem storage */ }
  return termosMemoria;
}

export function aceitarTermos(versao) {
  termosMemoria = { versao, aceito_em: new Date().toISOString() };
  try { localStorage.setItem(CHAVE_TERMOS, JSON.stringify(termosMemoria)); } catch { /* vale só nesta visita */ }
}

export async function nomeSalvo() { await iniciar(); return estado.nome; }

export async function salvarNome(nome) {
  await iniciar();
  estado.nome = String(nome).trim().slice(0, 30);
  salvar();
}

export async function exportarProgresso() {
  await iniciar();
  return JSON.stringify({ app: "simulados-4o-ano-3tri", exportado_em: agora(), estado }, null, 1);
}

export async function importarProgresso(texto) {
  await iniciar();
  let dados;
  try { dados = JSON.parse(texto); } catch { throw new ErroApi(400, "Esse arquivo não parece ser um backup deste app."); }
  const e = dados && dados.app === "simulados-4o-ano-3tri" ? dados.estado : null;
  if (!e || !Array.isArray(e.tentativas) || !Array.isArray(e.cartas)) throw new ErroApi(400, "Esse arquivo não parece ser um backup deste app.");
  estado = { ...estadoVazio(), ...e };
  salvar();
}

export async function reiniciarProgresso() {
  await iniciar();
  const nome = estado.nome;
  estado = { ...estadoVazio(), nome };
  salvar();
}

// Marca que a carta de uma tentativa já foi aberta (fica no backup também).
export async function cartaRevelada(tentativaId, marcar = false) {
  await iniciar();
  if (marcar && !estado.reveladas.includes(tentativaId)) { estado.reveladas.push(tentativaId); salvar(); }
  return estado.reveladas.includes(tentativaId);
}
