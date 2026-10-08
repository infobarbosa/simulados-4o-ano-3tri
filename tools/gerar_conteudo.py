"""Gera os JSONs de conteúdo (conteudo/) a partir dos PDFs dos simulados.

Uso: python3 tools/gerar_conteudo.py PASTA_DOS_PDFS
Precisa do pdftotext (poppler-utils). Os PDFs não ficam neste repositório; só o JSON gerado.
Cada simulado ganha um id estável: <disciplina>-<prova>-<numero>, sem acentos.
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import importador  # noqa: E402

SAIDA = Path(__file__).resolve().parent.parent / "conteudo"


def slug(texto: str) -> str:
    t = "".join(c for c in unicodedata.normalize("NFKD", texto) if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")


def main(pasta: Path) -> int:
    SAIDA.mkdir(exist_ok=True)
    for antigo in SAIDA.glob("*.json"):
        antigo.unlink()
    catalogo, falhas = [], 0
    for par in importador.descobrir_pdfs(pasta):
        nome = f"{par['disciplina']} / {par['prova']} / {par['simulado'].name}"
        if par["gabarito"] is None:
            print(f"PULADO (sem gabarito): {nome}")
            falhas += 1
            continue
        try:
            dados = importador.importar_par(par["simulado"], par["gabarito"])
        except importador.ErroImportacao as e:
            print(f"ERRO: {nome}: {e}")
            falhas += 1
            continue
        problemas = importador.validar(dados)
        if problemas:
            print(f"ERRO: {nome}: " + "; ".join(problemas))
            falhas += 1
            continue
        sid = f"{slug(par['disciplina'])}-{slug(par['prova'])}-{dados['numero']}"
        dados = {"id": sid, "disciplina": par["disciplina"], "prova": par["prova"], **dados}
        (SAIDA / f"{sid}.json").write_text(json.dumps(dados, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        catalogo.append({k: dados[k] for k in ("id", "disciplina", "prova", "numero", "titulo", "tema", "idioma")}
                        | {"questoes": len(dados["questoes"])})
        print(f"ok: {sid} ({len(dados['questoes'])} questões)")
    catalogo.sort(key=lambda s: (importador.DISCIPLINAS.index(s["disciplina"]), s["prova"] != "P1", s["prova"], s["numero"]))
    (SAIDA / "catalogo.json").write_text(json.dumps(catalogo, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(catalogo)} simulados, {falhas} falhas")
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1])))
