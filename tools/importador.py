"""Extrai simulados e gabaritos dos PDFs (gerados com ReportLab) para dicionários.

O PDF é convertido em texto com `pdftotext -layout` (poppler-utils) e lido linha a linha.
O formato esperado está descrito no CLAUDE.md, em "Formato dos simulados".
A Parte 5 (questões abertas) é descartada de propósito: o app só usa questões de correção automática.
"""

from __future__ import annotations

import re
import subprocess
import unicodedata
from pathlib import Path

TIPO_POR_PARTE = {1: "vf", 2: "associacao", 3: "lacuna", 4: "multipla"}

# Nome da pasta de disciplina -> nome exibido no app
DISCIPLINAS = ["Matemática", "Português", "Gramática", "Ciências", "Geografia", "História", "Bilíngue"]

RE_RODAPE = re.compile(r"^\s*(Simulado|Mock [Tt]est) •.*(Página|Page) \d+\s*$")
RE_SUBLINHADO = re.compile(r"^\s*\.?_+\s*$")
RE_NOME = re.compile(r"^\s*(Nome|Name):")
RE_CALCULO = re.compile(r"^\s*(Cálculo|Calculation|Working)\b.*?(\d+)\s*$")
RE_PARTE = re.compile(r"^\s?(Parte|Part) (\d) — (.+)$")
RE_QUESTAO = re.compile(r"^\s?(\d{1,2})\. (.*)$")
RE_ALTERNATIVA = re.compile(r"^\s{3,}\(?([A-Ea-e])\) (.*)$")  # "(A) texto" ou "a) texto"
RE_CABECALHO_COLUNAS = re.compile(r"^\s+(Coluna A|Column A)\s+(Coluna B|Column B)\s*$")
RE_LINHA_ASSOCIACAO = re.compile(r"^\s{2,}(\d)\. (.*?)\s{2,}(\( _+ \)) ([a-e])\) (.*)$")
RE_FONTE = re.compile(r"^\s*(Fonte|Source):\s*(.*)$")
RE_PAGINA = re.compile(r"\s*\((?:p|pp)\.\s*([\d–\-, e]+)\)\s*$")
RE_DATA = re.compile(r"\s*•\s*(\d{2}-\d{2}-\d{4})\s*$")
RE_PAR_ASSOCIACAO = re.compile(r"(\d)\s*[–-]\s*([a-e])")


class ErroImportacao(ValueError):
    """O PDF não está no formato esperado."""


def pdf_para_texto(caminho: Path | str) -> str:
    resultado = subprocess.run(
        ["pdftotext", "-layout", str(caminho), "-"],
        capture_output=True, text=True, check=False,
    )
    if resultado.returncode != 0:
        raise ErroImportacao(f"Não consegui ler o PDF {caminho}: {resultado.stderr.strip()}")
    return resultado.stdout


def _linhas_uteis(texto: str) -> list[str]:
    linhas = []
    for linha in texto.splitlines():
        linha = linha.rstrip()
        if not linha.strip() or RE_RODAPE.match(linha) or RE_SUBLINHADO.match(linha) or RE_NOME.match(linha):
            continue
        linhas.append(linha)
    return linhas


def _juntar(partes: list[str]) -> str:
    return re.sub(r"\s+", " ", " ".join(p.strip() for p in partes)).strip()


def _separar_pagina(texto: str) -> tuple[str, str | None]:
    m = RE_PAGINA.search(texto)
    if not m:
        return texto.strip(), None
    return texto[: m.start()].strip(), m.group(1).strip()


def _cabecalho(linhas: list[str]) -> dict:
    if len(linhas) < 3:
        raise ErroImportacao("Arquivo curto demais para ser um simulado.")
    titulo = linhas[1].strip()
    tema = linhas[2].strip()
    data = None
    m = RE_DATA.search(tema)
    if m:
        data = m.group(1)
        tema = tema[: m.start()].strip()
    m = re.search(r"(?:Simulado|Mock Test) (\d+)", titulo)
    if not m:
        raise ErroImportacao(f"Não encontrei o número do simulado no título: {titulo!r}")
    ingles = linhas[0].strip().upper().startswith("MOCK TEST")
    return {
        "cabecalho": linhas[0].strip(),
        "titulo": titulo,
        "numero": int(m.group(1)),
        "tema": tema,
        "data": data,
        "idioma": "en" if ingles else "pt-BR",
    }


def parse_simulado(texto: str) -> dict:
    """Converte o texto de um simulado (sem respostas) em um dicionário."""
    linhas = _linhas_uteis(texto)
    simulado = _cabecalho(linhas)
    questoes: list[dict] = []
    partes: dict[int, dict] = {}
    parte_atual: int | None = None
    atual: dict | None = None  # questão sendo montada
    texto_atual: list[str] = []
    fonte: list[str] = []
    em_colunas = False
    pos_coluna_b = 0

    def fechar():
        nonlocal atual, texto_atual
        if atual is not None:
            enunciado, pagina = _separar_pagina(_juntar(texto_atual))
            atual["enunciado"] = enunciado
            atual["pagina"] = pagina
            for lista in ("colunaA", "colunaB", "alternativas"):
                for item in atual.get(lista, []):
                    item["texto"] = _juntar([item["texto"]])
            questoes.append(atual)
        atual, texto_atual = None, []

    for linha in linhas[3:]:
        if fonte:
            fonte.append(linha)
            continue
        if m := RE_FONTE.match(linha):
            fechar()
            fonte.append(m.group(2))
            continue
        if m := RE_PARTE.match(linha):
            fechar()
            parte_atual = int(m.group(2))
            partes[parte_atual] = {"titulo": m.group(3).strip(), "instrucao": ""}
            em_colunas = False
            continue
        if m := RE_CALCULO.match(linha):
            n = int(m.group(2))
            alvo = atual if atual and atual["n"] == n else next((q for q in questoes if q["n"] == n), None)
            if alvo is not None:
                alvo["calculo"] = True
            continue
        if parte_atual is None:
            continue
        if m := RE_QUESTAO.match(linha):
            fechar()
            em_colunas = False
            if parte_atual not in TIPO_POR_PARTE:
                continue  # Parte 5: questões abertas, fora do app
            atual = {"n": int(m.group(1)), "parte": parte_atual, "tipo": TIPO_POR_PARTE[parte_atual], "calculo": False}
            if atual["tipo"] == "associacao":
                atual["colunaA"], atual["colunaB"] = [], []
            if atual["tipo"] == "multipla":
                atual["alternativas"] = []
            texto_atual = [m.group(2)]
            continue
        if atual is None:
            if parte_atual in TIPO_POR_PARTE:
                instr = partes[parte_atual]
                instr["instrucao"] = _juntar([instr["instrucao"], linha])
            continue
        if atual["tipo"] == "associacao":
            if m := RE_CABECALHO_COLUNAS.match(linha):
                em_colunas = True
                pos_coluna_b = m.start(2)
                continue
            if em_colunas:
                if m := RE_LINHA_ASSOCIACAO.match(linha):
                    atual["colunaA"].append({"id": m.group(1), "texto": m.group(2)})
                    atual["colunaB"].append({"id": m.group(4), "texto": m.group(5)})
                    pos_coluna_b = m.start(3)
                    continue
                # Continuação de um item que quebrou de linha
                if not atual["colunaA"]:
                    raise ErroImportacao(f"Questão {atual['n']}: linha inesperada nas colunas: {linha!r}")
                esquerda, direita = linha[:pos_coluna_b], linha[pos_coluna_b:]
                if esquerda.strip():
                    atual["colunaA"][-1]["texto"] += " " + esquerda.strip()
                if direita.strip():
                    atual["colunaB"][-1]["texto"] += " " + direita.strip()
                continue
        if atual["tipo"] == "multipla":
            if m := RE_ALTERNATIVA.match(linha):
                atual["alternativas"].append({"id": m.group(1).upper(), "texto": m.group(2)})
                continue
            if atual["alternativas"] and len(linha) - len(linha.lstrip()) >= 5:
                atual["alternativas"][-1]["texto"] += " " + linha.strip()
                continue
        texto_atual.append(linha)
    fechar()

    simulado["fonte"] = _juntar(fonte) or None
    simulado["partes"] = {str(k): v for k, v in partes.items() if k in TIPO_POR_PARTE}
    simulado["questoes"] = questoes
    return simulado


def parse_gabarito(texto: str) -> dict:
    """Converte o texto de um gabarito em {"numero": n, "respostas": {n_questao: resposta}}."""
    linhas = _linhas_uteis(texto)
    titulo = linhas[0].strip() if linhas else ""
    m = re.search(r"(?:Simulado|Mock Test) (\d+)", titulo)
    if not m or not re.search(r"Gabarito|Answer Key", titulo):
        raise ErroImportacao(f"Isto não parece um gabarito: {titulo!r}")
    respostas: dict[int, object] = {}
    parte_atual = None
    for linha in linhas[1:]:
        if RE_FONTE.match(linha):
            break
        if mp := RE_PARTE.match(linha):
            parte_atual = int(mp.group(2))
            continue
        if parte_atual not in TIPO_POR_PARTE:
            continue
        mq = RE_QUESTAO.match(linha)
        if not mq:
            continue
        n, valor = int(mq.group(1)), mq.group(2).strip()
        tipo = TIPO_POR_PARTE[parte_atual]
        if tipo == "vf":
            letra = valor.upper()[:1]
            respostas[n] = {"V": "V", "T": "V", "F": "F"}.get(letra, valor)
        elif tipo == "associacao":
            respostas[n] = {a: b for a, b in RE_PAR_ASSOCIACAO.findall(valor)}
        elif tipo == "multipla":
            ma = re.match(r"\(?([A-Ea-e])\)", valor) or re.match(r"([A-Ea-e])\b", valor)
            respostas[n] = ma.group(1).upper() if ma else valor
        else:
            respostas[n] = valor
    return {"numero": int(m.group(1)), "respostas": respostas}


def juntar_gabarito(simulado: dict, gabarito: dict) -> dict:
    if simulado["numero"] != gabarito["numero"]:
        raise ErroImportacao(
            f"O gabarito é do simulado {gabarito['numero']}, mas o simulado é o {simulado['numero']}."
        )
    for q in simulado["questoes"]:
        q["resposta"] = gabarito["respostas"].get(q["n"])
    return simulado


def validar(simulado: dict) -> list[str]:
    """Retorna a lista de problemas encontrados (vazia = tudo certo)."""
    problemas = []
    if not simulado["questoes"]:
        problemas.append("Nenhuma questão encontrada.")
    for q in simulado["questoes"]:
        rotulo = f"Questão {q['n']}"
        if not q.get("enunciado"):
            problemas.append(f"{rotulo}: enunciado vazio.")
        r = q.get("resposta")
        if r in (None, "", {}):
            problemas.append(f"{rotulo}: sem resposta no gabarito.")
            continue
        if q["tipo"] == "vf" and r not in ("V", "F"):
            problemas.append(f"{rotulo}: resposta V/F inválida ({r!r}).")
        elif q["tipo"] == "multipla":
            ids = [a["id"] for a in q["alternativas"]]
            if len(ids) < 2:
                problemas.append(f"{rotulo}: menos de 2 alternativas.")
            if r not in ids:
                problemas.append(f"{rotulo}: resposta {r!r} não está entre as alternativas {ids}.")
        elif q["tipo"] == "associacao":
            ids_a = {i["id"] for i in q["colunaA"]}
            ids_b = {i["id"] for i in q["colunaB"]}
            if len(ids_a) < 2 or len(ids_a) != len(ids_b):
                problemas.append(f"{rotulo}: colunas com tamanhos inválidos ({len(ids_a)} x {len(ids_b)}).")
            if set(r) != ids_a or not set(r.values()) <= ids_b:
                problemas.append(f"{rotulo}: gabarito {r} não bate com as colunas.")
    return problemas


def _prova_pela_pasta(nome_pasta: str) -> str | None:
    """'P1_de_Historia' -> 'P1'; 'Multidisciplinar_3_Historia_e_Bilingue' -> 'Multidisciplinar 3'."""
    if nome_pasta.startswith("P1"):
        return "P1"
    m = re.match(r"Multidisciplinar_(\d+)", nome_pasta)
    if m:
        return f"Multidisciplinar {m.group(1)}"
    return None


def prova_pelo_cabecalho(cabecalho: str) -> str | None:
    """Palpite de prova a partir do cabeçalho (usado no envio de PDFs pela área dos pais)."""
    sem_acento = unicodedata.normalize("NFKD", cabecalho).encode("ascii", "ignore").decode().upper()
    m = re.search(r"MULTIDISCIPLINAR[YI]?O? (\d+)", sem_acento)
    if m:
        return f"Multidisciplinar {m.group(1)}"
    if re.search(r"\bP1\b", sem_acento):
        return "P1"
    return None


def disciplina_pelo_titulo(titulo: str) -> str | None:
    """Palpite de disciplina a partir do título ('Matemática — Simulado 1')."""
    inicio = titulo.split("—")[0].strip().lower()
    if inicio in ("english", "bilingual", "inglês", "bilíngue"):
        return "Bilíngue"
    for d in DISCIPLINAS:
        if d.lower() == inicio:
            return d
    return None


def importar_par(pdf_simulado: Path | str, pdf_gabarito: Path | str) -> dict:
    simulado = parse_simulado(pdf_para_texto(pdf_simulado))
    gabarito = parse_gabarito(pdf_para_texto(pdf_gabarito))
    return juntar_gabarito(simulado, gabarito)


def descobrir_pdfs(raiz: Path | str) -> list[dict]:
    """Varre <raiz>/<Disciplina>/<P1_...|Multidisciplinar_...>/ e devolve os pares simulado+gabarito.

    Pastas que não são P1 nem Multidisciplinar (ex.: 'Capítulo 7', 'Claude outputs') são ignoradas.
    """
    raiz = Path(raiz)
    encontrados = []
    for pasta_disc in sorted(p for p in raiz.iterdir() if p.is_dir()):
        if pasta_disc.name not in DISCIPLINAS:
            continue
        for pasta_prova in sorted(p for p in pasta_disc.iterdir() if p.is_dir()):
            prova = _prova_pela_pasta(pasta_prova.name)
            if prova is None:
                continue
            for pdf in sorted(pasta_prova.glob("*.pdf")):
                if "Gabarito" in pdf.name:
                    continue
                gab = pdf.with_name(re.sub(r"( - Simulado \d+)", r"\1 - Gabarito", pdf.name, count=1))
                encontrados.append({
                    "disciplina": pasta_disc.name,
                    "prova": prova,
                    "simulado": pdf,
                    "gabarito": gab if gab.exists() else None,
                })
    return encontrados
