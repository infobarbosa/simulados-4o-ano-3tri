"""Ajustes de conteúdo aplicados por cima do que vem dos PDFs (ajustes_contexto.json).

Os PDFs são a fonte, mas algumas questões dependem de figuras ou textos do livro que o PDF não traz
(ex.: a receita de pão de queijo). Em vez de editar os PDFs, cada ajuste fica neste JSON e é reaplicado
a toda importação, então reimportar não desfaz a correção.

Chave do simulado: "<Disciplina> / <Prova> / <número>"; depois o número da questão. Campos aceitos:
  contexto   caixa mostrada acima do enunciado: {"icone", "titulo", "itens": [linhas]}
  enunciado  novo enunciado (o gabarito nunca é alterado por aqui)
  ajuda      tópico da mini-aula que o botão "Não sei — ler o conteúdo" abre nesta questão
  confere    trecho que precisa existir na questão original; se não existir, a importação falha
             (protege contra o ajuste cair na questão errada se o PDF mudar de numeração).

A chave reservada "_simulado" guarda os campos do simulado inteiro, não de uma questão:
  materia    arquivo de conteudo/materia/ com as mini-aulas deste simulado (sem ele não há botão).
Havia uma cópia idêntica em simulados-vitor (app/simulados_app/). Em 21/10/2026 esta aqui ganhou
"ajuda" e "_simulado", que só fazem sentido no app público (o privado não tem o botão de conteúdo),
e o app privado está sendo arquivado — então as duas passaram a divergir de propósito. A cópia de lá
continua funcionando: o JSON dela não usa os campos novos.
"""

from __future__ import annotations

import json
from pathlib import Path

ARQUIVO = Path(__file__).with_name("ajustes_contexto.json")
CAMPOS = {"contexto", "enunciado", "ajuda", "confere"}
RESERVADA = "_simulado"
CAMPOS_SIMULADO = {"materia"}


class ErroAjuste(ValueError):
    """Um ajuste não bate com a questão que deveria ajustar."""


def carregar() -> dict:
    return json.loads(ARQUIVO.read_text(encoding="utf-8"))


def aplicar(simulado: dict, disciplina: str, prova: str, ajustes: dict | None = None) -> dict:
    """Aplica, no próprio dicionário do simulado, os ajustes da chave disciplina/prova/número."""
    ajustes = carregar() if ajustes is None else ajustes
    chave = f"{disciplina} / {prova} / {simulado['numero']}"
    por_questao = ajustes.get(chave)
    if not por_questao:
        return simulado
    geral = por_questao.get(RESERVADA)
    if geral:
        desconhecidos = set(geral) - CAMPOS_SIMULADO
        if desconhecidos:
            raise ErroAjuste(f"{chave}, _simulado: campos não aceitos {sorted(desconhecidos)}.")
        simulado.update(geral)
    questoes = {str(q["n"]): q for q in simulado["questoes"]}
    for n, ajuste in por_questao.items():
        if n == RESERVADA:
            continue
        if n not in questoes:
            raise ErroAjuste(f"{chave}, questão {n}: a questão não existe.")
        desconhecidos = set(ajuste) - CAMPOS
        if desconhecidos:
            raise ErroAjuste(f"{chave}, questão {n}: campos não aceitos {sorted(desconhecidos)}.")
        q = questoes[n]
        trecho = ajuste.get("confere")
        if trecho and trecho not in json.dumps(q, ensure_ascii=False):
            raise ErroAjuste(f"{chave}, questão {n}: não encontrei {trecho!r}; a numeração mudou?")
        if "enunciado" in ajuste:
            q["enunciado"] = ajuste["enunciado"]
        if "contexto" in ajuste:
            q["contexto"] = ajuste["contexto"]
        if "ajuda" in ajuste:
            q["ajuda"] = ajuste["ajuda"]
    return simulado
