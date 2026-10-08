"""Ajustes de conteúdo aplicados por cima do que vem dos PDFs (ajustes_contexto.json).

Os PDFs são a fonte, mas algumas questões dependem de figuras ou textos do livro que o PDF não traz
(ex.: a receita de pão de queijo). Em vez de editar os PDFs, cada ajuste fica neste JSON e é reaplicado
a toda importação, então reimportar não desfaz a correção.

Chave do simulado: "<Disciplina> / <Prova> / <número>"; depois o número da questão. Campos aceitos:
  contexto   caixa mostrada acima do enunciado: {"icone", "titulo", "itens": [linhas]}
  enunciado  novo enunciado (o gabarito nunca é alterado por aqui)
  confere    trecho que precisa existir na questão original; se não existir, a importação falha
             (protege contra o ajuste cair na questão errada se o PDF mudar de numeração).
Este arquivo é idêntico nos repositórios simulados-vitor (app/simulados_app/) e simulados-4o-ano-3tri (tools/).
"""

from __future__ import annotations

import json
from pathlib import Path

ARQUIVO = Path(__file__).with_name("ajustes_contexto.json")
CAMPOS = {"contexto", "enunciado", "confere"}


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
    questoes = {str(q["n"]): q for q in simulado["questoes"]}
    for n, ajuste in por_questao.items():
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
    return simulado
