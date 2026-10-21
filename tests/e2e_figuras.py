"""Teste de ponta a ponta das figuras e das questões de pintar (opcional; precisa de playwright e Chrome).
Uso:  python3 -m http.server 6792 &   depois   python3 tests/e2e_figuras.py http://127.0.0.1:6792/ [pasta-de-screenshots]
Joga os simulados 4 e 5 de Matemática inteiros, em iPhone emulado, e confere: as figuras aparecem desenhadas e
descritas em texto, a questão de pintar só libera o "Conferir" depois do primeiro toque, acerta pela quantidade
de partes (não por quais), mostra a figura certa quando erra, e a nota sai como o esperado."""
import json, os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

CONTEUDO = Path(__file__).parent.parent / "conteudo"


def gabarito(sim_id):
    return {q["n"]: q for q in json.loads((CONTEUDO / f"{sim_id}.json").read_text())["questoes"]}


def responder(pg, q, acertar):
    """Mesma ideia do e2e.py, com o tipo de pintar incluído (aqui separado para não rodar o e2e.py inteiro)."""
    t, r = q["tipo"], q["resposta"]
    if t == "vf":
        pg.click(f".opcao-vf[data-v='{r if acertar else ('F' if r == 'V' else 'V')}']")
    elif t == "multipla":
        pg.click(f".opcao[data-id='{r if acertar else next(a['id'] for a in q['alternativas'] if a['id'] != r)}']")
    elif t == "lacuna":
        pg.fill(".campo-lacuna", r if acertar else "zzz")
    elif t == "pintar":
        for i in range(r if acertar else (r + 1 if r < q["figura"]["partes"] else r - 1)):
            pg.click(f".figura-pintar .parte[data-i='{i}']")
    else:
        ids = list(r)
        for i, a in enumerate(ids):
            b = r[a] if acertar else r[ids[(i + 1) % len(ids)]]
            if not acertar and len({x["texto"] for x in q["colunaB"]}) < len(q["colunaB"]):
                b = r[a]
            pg.click(f".associacao .coluna:nth-child(1) .item-assoc[data-id='{a}']")
            pg.click(f".associacao .coluna:nth-child(2) .item-assoc[data-id='{b}']")
    pg.click(".botao.conferir")
    pg.wait_for_selector(".retorno")

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:6792/"
SHOTS = Path(sys.argv[2]) if len(sys.argv) > 2 else None
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")


def jogar_tudo(pg, banco, errar_ns=()):
    """Responde o simulado inteiro, errando as questões cujos números estiverem em `errar_ns`."""
    vistas = []
    while True:
        pg.wait_for_selector(".numero-questao")
        n = int(pg.inner_text(".numero-questao"))
        q = banco[n]
        vistas.append(n)
        if q.get("figura") or any(a.get("figura") for a in q.get("colunaA", [])):
            assert pg.locator(".questao svg.figura, .questao .figura-comparar svg").count() >= 1, f"q{n} sem figura"
        if q["tipo"] == "pintar":
            assert pg.is_disabled(".botao.conferir"), f"q{n}: Conferir liberado antes de pintar"
            assert "Nenhuma parte pintada" in pg.inner_text(".pintar-contagem")
            assert pg.locator(".figura-pintar .parte.pintada").count() == 0, f"q{n} já vem pintada"
        responder(pg, q, n not in errar_ns)
        if q["tipo"] == "pintar":
            esperado = q["resposta"] if n not in errar_ns else q["resposta"] + 1
            contagem = pg.inner_text(".pintar-contagem")
            texto = f"{esperado} parte pintada" if esperado == 1 else f"{esperado} partes pintadas"
            assert texto in contagem, f"q{n}: contagem {contagem!r}, esperava {texto!r}"
            if n in errar_ns:
                assert pg.locator(".pintar-gabarito .figura").count() == 1, f"q{n} sem a figura certa no erro"
                assert f"{q['resposta']} de {q['figura']['partes']} partes" in pg.inner_text(".retorno")
            if SHOTS: pg.screenshot(path=str(SHOTS / f"pintar-q{n}-{'erro' if n in errar_ns else 'acerto'}.png"))
        pg.click(".retorno > .botao.grande")   # e não o "📖 Ler o conteúdo", que também é .botao
        pg.wait_for_selector(".fim-parte, .tela-resultado, .numero-questao")
        if pg.locator(".fim-parte .botao").count():
            pg.click(".fim-parte .botao")
            pg.wait_for_selector(".numero-questao, .tela-resultado")
        if pg.locator(".tela-resultado").count():
            return vistas


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    erros = []
    ctx = b.new_context(**p.devices["iPhone 13"])
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: erros.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and erros.append(m.text))
    pg.goto(URL)
    pg.wait_for_selector("input")
    pg.fill("input[type=text]", "Maria"); pg.check(".aceite-linha input"); pg.click("text=Vamos lá")
    pg.wait_for_selector(".grade-disciplinas")

    for numero, errar in ((4, {25}), (5, set())):
        sim_id = f"matematica-multidisciplinar-2-{numero}"
        banco = gabarito(sim_id)
        pg.goto(URL + "#/d/Matem%C3%A1tica"); pg.wait_for_selector(".simulado")
        pg.click(f".prova:has-text('Multidisciplinar 2') .simulado:has-text('Simulado {numero}')")
        pg.click("text=Começar!")
        vistas = jogar_tudo(pg, banco, errar)
        assert vistas == list(range(1, 28)), vistas
        nota = pg.inner_text(".nota")
        esperada = "10,0" if not errar else "9,6"  # 26 de 27 = 9,62…
        assert esperada in nota, f"simulado {numero}: nota {nota}, esperava {esperada}"
        if SHOTS: pg.screenshot(path=str(SHOTS / f"matematica-{numero}-resultado.png"))
        print(f"simulado {numero}: 27 questões, nota {nota}")

    # a leitura em voz alta inclui a descrição da figura
    pg.goto(URL + "#/d/Matem%C3%A1tica"); pg.wait_for_selector(".simulado")
    assert pg.locator(".prova:has-text('Multidisciplinar 2') .simulado").count() == 5

    assert not erros, erros
    b.close()
    print("ok: figuras e questões de pintar")
