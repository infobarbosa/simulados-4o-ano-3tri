// Roteador (por #hash) e telas: boas-vindas, início, disciplina, álbum e ajustes.

import { api, el, perguntar, avisar, ELEMENTOS } from "./util.js";
import { nomeSalvo, salvarNome, exportarProgresso, importarProgresso, reiniciarProgresso, armazenamentoOk } from "./api.js";
import { telaQuiz, telaResultado } from "./quiz.js";
import { cartaEl } from "./criatura.js";
const raiz = document.getElementById("app");

function temaPadrao() {
  document.documentElement.style.setProperty("--tema", "#5B5BD6");
  document.documentElement.style.setProperty("--tema-escura", "#3A3AA8");
}

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function estrelasEl(n, total = 3) {
  return el("span.estrelas", { "aria-label": `${n} de ${total} estrelas` },
    Array.from({ length: total }, (_, i) => el("span" + (i < n ? ".acesa" : ""), "★")));
}

// ---------------------------------------------------------------- início

async function telaInicio() {
  temaPadrao();
  const nome = await nomeSalvo();
  if (!nome) { location.hash = "#/boas-vindas"; return; }
  const [catalogo, album] = await Promise.all([api("/api/catalogo"), api("/api/album")]);
  const blocos = catalogo.map((d) => {
    const e = ELEMENTOS[d.elemento] || ELEMENTOS.vento;
    const sims = d.provas.flatMap((p) => p.simulados);
    const ganhas = sims.reduce((s, x) => s + x.estrelas, 0);
    const emAndamento = sims.some((x) => x.tentativa_aberta);
    return el("a.disciplina", { href: `#/d/${encodeURIComponent(d.disciplina)}`, style: { "--cor": e.cor, "--escura": e.escura } },
      el("span.disciplina-icone", e.icone),
      el("span.disciplina-nome", d.disciplina),
      el("span.disciplina-info", estrelasEl(Math.round((ganhas / (sims.length * 3 || 1)) * 3)), ` ${ganhas}/${sims.length * 3}`),
      emAndamento ? el("span.selo", "Continuar") : null,
    );
  });
  raiz.replaceChildren(el("div.tela-inicio",
    el("header.boas-vindas",
      el("h1", `${saudacao()}, ${nome}! 👋`),
      el("p", "Escolha uma matéria para treinar.")),
    el("nav.grade-disciplinas", blocos),
    el("a.botao-album", { href: "#/album" },
      el("span.botao-album-icone", "📒"),
      el("span", el("strong", "Meu álbum de cartas"), el("small", `${album.length} ${album.length === 1 ? "carta" : "cartas"}`))),
    armazenamentoOk() ? null : el("p.alerta", "Este navegador não deixa guardar o progresso. Saia da aba anônima ou libere o armazenamento do site."),
    el("footer.rodape-inicio", el("a", { href: "#/ajustes" }, "Ajustes e backup")),
  ));
}

// ---------------------------------------------------------------- disciplina

async function telaDisciplina(nome) {
  const catalogo = await api("/api/catalogo");
  const d = catalogo.find((x) => x.disciplina === nome);
  if (!d) { location.hash = "#/"; return; }
  const e = ELEMENTOS[d.elemento] || ELEMENTOS.vento;
  document.documentElement.style.setProperty("--tema", e.cor);
  document.documentElement.style.setProperty("--tema-escura", e.escura);

  async function abrir(s, prova) {
    const iniciar = async () => {
      const nova = await api(`/api/simulados/${s.id}/tentativas`, { method: "POST" });
      location.hash = `#/quiz/${nova.id}`;
    };
    const fechar = () => fundo.remove();
    const botoes = s.tentativa_aberta
      ? [
          el("button.botao.grande", { type: "button", onclick: () => { location.hash = `#/quiz/${s.tentativa_aberta}`; fechar(); } }, "Continuar de onde parei"),
          el("button.botao.secundario", { type: "button", onclick: async () => {
            fechar();
            const ok = await perguntar({ titulo: "Começar de novo?", texto: "As respostas que você já deu neste simulado serão apagadas.", sim: "Começar de novo", nao: "Voltar" });
            if (ok) iniciar();
          } }, "Começar de novo"),
        ]
      : [el("button.botao.grande", { type: "button", onclick: () => { fechar(); iniciar(); } }, "Começar! 🚀")];
    const fundo = el("div.modal-fundo", { onclick: (ev) => { if (ev.target === fundo) fechar(); } },
      el("div.modal.modal-simulado", { role: "dialog", "aria-modal": "true" },
        el("p.modal-sobre", `${d.disciplina} • ${prova}`),
        el("h2", `Simulado ${s.numero}`),
        s.tema ? el("p", s.tema) : null,
        el("ul.lista-partes",
          el("li", "👍 Verdadeiro ou falso"), el("li", "🔗 Ligar as colunas"),
          el("li", "✍️ Completar"), el("li", "🔘 Múltipla escolha")),
        el("p.pequeno", "27 questões. Sem relógio: vá no seu ritmo. Dá para pausar quando quiser."),
        s.feitas ? el("p.pequeno", `Você já fez ${s.feitas} ${s.feitas === 1 ? "vez" : "vezes"}. Melhor nota: ${String(s.melhor_nota).replace(".", ",")}`) : null,
        el("div.botoes-coluna", botoes, el("button.botao.texto", { type: "button", onclick: fechar }, "Agora não")),
      ));
    document.body.append(fundo);
  }

  raiz.replaceChildren(el("div.tela-disciplina",
    el("header.topo-simples",
      el("a.botao-icone", { href: "#/", "aria-label": "Voltar" }, "←"),
      el("h1", `${e.icone} ${d.disciplina}`)),
    d.provas.map((p) => el("section.prova",
      el("h2", p.prova),
      el("div.lista-simulados", p.simulados.map((s) =>
        el("button.simulado", { type: "button", onclick: () => abrir(s, p.prova) },
          el("span.simulado-nome", `Simulado ${s.numero}`),
          estrelasEl(s.estrelas),
          s.tentativa_aberta ? el("span.selo", "Continuar") : s.feitas ? el("span.simulado-feito", `feito ${s.feitas}x`) : el("span.simulado-novo", "novo"),
        ))),
    )),
  ));
}

// ---------------------------------------------------------------- álbum

async function telaAlbum() {
  temaPadrao();
  const cartas = await api("/api/album");
  const conta = (r) => cartas.filter((c) => c.raridade === r).length;
  let filtro = "todas";
  const grade = el("div.grade-cartas");
  const disciplinas = [...new Set(cartas.map((c) => c.disciplina))];

  function ampliar(c) {
    const fundo = el("div.modal-fundo.carta-ampliada", { onclick: () => fundo.remove() }, cartaEl(c));
    document.body.append(fundo);
  }
  function pintar() {
    const lista = filtro === "todas" ? cartas : cartas.filter((c) => c.disciplina === filtro);
    grade.replaceChildren(...lista.map((c) => {
      const b = el("button.carta-botao", { type: "button", onclick: () => ampliar(c), "aria-label": `Carta ${c.nome}` }, cartaEl(c, { pequena: true }));
      return b;
    }));
  }
  const chips = el("div.chips", ["todas", ...disciplinas].map((dsc) =>
    el("button.chip", { type: "button", onclick: (ev) => {
      filtro = dsc;
      chips.querySelectorAll(".chip").forEach((x) => x.classList.toggle("ativo", x === ev.currentTarget));
      pintar();
    } }, dsc === "todas" ? "Todas" : dsc)));
  chips.firstChild?.classList.add("ativo");

  raiz.replaceChildren(el("div.tela-album",
    el("header.topo-simples", el("a.botao-icone", { href: "#/", "aria-label": "Voltar" }, "←"), el("h1", "📒 Meu álbum")),
    cartas.length
      ? [
          el("p.resumo-album", `${cartas.length} ${cartas.length === 1 ? "carta" : "cartas"} • ${conta("lendaria")} ${conta("lendaria") === 1 ? "lendária" : "lendárias"} ★★ • ${conta("rara")} ${conta("rara") === 1 ? "rara" : "raras"} ★ • ${conta("comum")} ${conta("comum") === 1 ? "comum" : "comuns"} ●`),
          el("p.pequeno", "Nota 9 ou mais = lendária. Nota 7 ou mais = rara. Terminar o simulado sempre dá uma carta!"),
          disciplinas.length > 1 ? chips : null,
          grade,
        ]
      : el("div.vazio", el("div.emoji-grande", "🃏"), el("p.grande", "Seu álbum ainda está vazio."), el("p", "Termine um simulado para ganhar sua primeira carta!"), el("a.botao.grande", { href: "#/" }, "Escolher matéria")),
  ));
  pintar();
}

// ---------------------------------------------------------------- boas-vindas e ajustes

async function telaBoasVindas() {
  temaPadrao();
  if (await nomeSalvo()) { location.hash = "#/"; return; }
  const campo = el("input", { type: "text", placeholder: "Seu nome", maxLength: 30, autocomplete: "given-name", autocapitalize: "words", spellcheck: false, "aria-label": "Seu nome" });
  const entrar = async (ev) => {
    ev.preventDefault();
    if (!campo.value.trim()) { campo.focus(); return; }
    await salvarNome(campo.value);
    location.hash = "#/";
  };
  raiz.replaceChildren(el("div.tela-centro",
    el("div.fim-parte",
      el("div.emoji-grande", "🃏"),
      el("h1", "Simulados do 4º ano"),
      el("p.grande", "Treine para as provas do 3º trimestre e ganhe cartinhas de criaturas!"),
      el("p", "Como você se chama?"),
      el("form.form-nome", { onsubmit: entrar }, campo, el("button.botao.grande", { type: "submit" }, "Vamos lá! 🚀")),
      el("p.pequeno", "O nome e o progresso ficam só neste aparelho."))));
}

function baixarArquivo(nome, texto) {
  const url = URL.createObjectURL(new Blob([texto], { type: "application/json" }));
  const a = el("a", { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function telaAjustes() {
  temaPadrao();
  const campoNome = el("input", { type: "text", value: await nomeSalvo(), maxLength: 30, autocapitalize: "words", spellcheck: false, "aria-label": "Seu nome" });
  const arquivo = el("input", { type: "file", accept: "application/json,.json", hidden: true });
  arquivo.addEventListener("change", async () => {
    const f = arquivo.files[0];
    if (!f) return;
    try {
      await importarProgresso(await f.text());
      avisar("Backup restaurado!");
      location.hash = "#/";
    } catch (e) { avisar(e.message); }
  });
  raiz.replaceChildren(el("div.tela-ajustes",
    el("header.topo-simples", el("a.botao-icone", { href: "#/", "aria-label": "Voltar" }, "←"), el("h1", "Ajustes")),
    el("section", el("h2", "Seu nome"),
      el("div.ajuste-nome", campoNome,
        el("button.botao.pequeno", { type: "button", onclick: async () => {
          if (!campoNome.value.trim()) return;
          await salvarNome(campoNome.value);
          avisar("Nome salvo!");
        } }, "Salvar"))),
    el("section", el("h2", "Backup do progresso"),
      el("p.pequeno", "O progresso e as cartas ficam guardados só neste aparelho. Baixe um backup para não perder se limpar os dados do navegador, ou para levar para outro aparelho."),
      el("div.botoes-linha",
        el("button.botao.pequeno", { type: "button", onclick: async () => baixarArquivo(`backup-simulados-${new Date().toISOString().slice(0, 10)}.json`, await exportarProgresso()) }, "⬇️ Baixar backup"),
        el("button.botao.secundario.pequeno", { type: "button", onclick: () => arquivo.click() }, "⬆️ Restaurar backup"),
        arquivo)),
    el("section", el("h2", "Recomeçar"),
      el("p.pequeno", "Apaga notas, respostas e cartas deste aparelho. O nome fica."),
      el("button.botao.perigo.pequeno", { type: "button", onclick: async () => {
        const ok = await perguntar({ titulo: "Apagar todo o progresso?", texto: "As notas e as cartas serão apagadas. Não dá para desfazer (a não ser com um backup).", sim: "Apagar tudo", nao: "Voltar", perigo: true });
        if (ok) { await reiniciarProgresso(); avisar("Progresso apagado."); location.hash = "#/"; }
      } }, "Apagar progresso")),
  ));
}

// ---------------------------------------------------------------- roteador

async function rotear() {
  document.querySelectorAll(".modal-fundo, .rascunho").forEach((m) => m.remove());
  const partes = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  try {
    switch (partes[0]) {
      case "d": await telaDisciplina(partes[1]); break;
      case "quiz": await telaQuiz(raiz, Number(partes[1]), partes[2] === "revisao" ? "revisao" : "normal"); break;
      case "resultado": await telaResultado(raiz, Number(partes[1])); break;
      case "album": await telaAlbum(); break;
      case "boas-vindas": await telaBoasVindas(); break;
      case "ajustes": await telaAjustes(); break;
      default: await telaInicio();
    }
  } catch (erro) {
    console.error(erro);
    raiz.replaceChildren(el("div.tela-centro",
      el("div.fim-parte",
        el("div.emoji-grande", "🔌"),
        el("h1", "Ops, algo deu errado"),
        el("p", erro.message || "Algo não carregou."),
        el("div.botoes-coluna",
          el("button.botao.grande", { type: "button", onclick: rotear }, "Tentar de novo"),
          el("a.botao.secundario", { href: "#/" }, "Início")))));
  }
}

window.addEventListener("hashchange", rotear);
rotear();

if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("sw.js").catch(() => { /* sem offline, tudo bem */ });
}
