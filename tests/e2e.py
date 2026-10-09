"""Teste de ponta a ponta no navegador (opcional). Precisa de: pip install playwright e de um Chrome.
Uso:  python3 -m http.server 6792 &   depois   python3 tests/e2e.py http://127.0.0.1:6792/ [pasta-de-screenshots]
Joga um simulado inteiro (com erros de propósito) em iPhone e Android emulados e confere: nome, nota, carta,
treino das erradas, persistência depois de recarregar, backup/restauração e funcionamento offline."""
import json, os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:6792/"
SHOTS = Path(sys.argv[2]) if len(sys.argv) > 2 else None
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
CONTEUDO = Path(__file__).parent.parent / "conteudo"


def gabarito(sim_id):
    return {q["n"]: q for q in json.loads((CONTEUDO / f"{sim_id}.json").read_text())["questoes"]}


def responder(pg, q, acertar):
    t, r = q["tipo"], q["resposta"]
    if t == "vf":
        pg.click(f".opcao-vf[data-v='{r if acertar else ('F' if r == 'V' else 'V')}']")
    elif t == "multipla":
        pg.click(f".opcao[data-id='{r if acertar else next(a['id'] for a in q['alternativas'] if a['id'] != r)}']")
    elif t == "lacuna":
        pg.fill(".campo-lacuna", r if acertar else "zzz")
    else:
        ids = list(r)
        for i, a in enumerate(ids):
            b = r[a] if acertar else r[ids[(i + 1) % len(ids)]]  # errando: todos os pares trocados
            if not acertar and q["colunaB"] and len({x["texto"] for x in q["colunaB"]}) < len(q["colunaB"]):
                b = r[a]  # Coluna B com textos repetidos: não dá para garantir erro; deixa certo
            pg.click(f".associacao .coluna:nth-child(1) .item-assoc[data-id='{a}']")
            pg.click(f".associacao .coluna:nth-child(2) .item-assoc[data-id='{b}']")
    pg.click(".botao.conferir")
    pg.wait_for_selector(".retorno")


def jogar(pg, banco, errar):
    """Responde o que estiver aberto, errando as `errar` primeiras questões. Devolve quantas respondeu."""
    feitas = 0
    while True:
        pg.wait_for_selector(".numero-questao")
        q = banco[int(pg.inner_text(".numero-questao"))]
        responder(pg, q, feitas >= errar)
        feitas += 1
        pg.click(".retorno .botao")
        pg.wait_for_selector(".fim-parte, .tela-resultado, .numero-questao, .tela-centro")
        if pg.locator("text=Treino concluído").count():
            return feitas
        if pg.locator(".fim-parte .botao").count():
            pg.click(".fim-parte .botao")
            pg.wait_for_selector(".numero-questao, .tela-resultado")
        if pg.locator(".tela-resultado").count():
            return feitas


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    banco = gabarito("geografia-p1-1")
    for nome, disp in (("iphone", p.devices["iPhone 13"]), ("android", p.devices["Pixel 7"])):
        ctx = b.new_context(**disp, accept_downloads=True)
        pg = ctx.new_page()
        erros = []
        pg.on("pageerror", lambda e: erros.append(str(e)))
        pg.on("console", lambda m: m.type == "error" and erros.append(m.text))
        pg.goto(URL)
        pg.wait_for_selector("input")
        pg.fill("input[type=text]", "Maria"); pg.check(".aceite-linha input"); pg.click("text=Vamos lá")
        pg.wait_for_selector(".grade-disciplinas")
        assert "Maria" in pg.inner_text("h1")
        assert pg.locator(".disciplina").count() == 7
        if SHOTS: pg.screenshot(path=str(SHOTS / f"{nome}-inicio.png"))
        # Geografia > Simulado 1 da P1, com 3 erros
        pg.click(".disciplina:has-text('Geografia')")
        pg.click(".prova:has-text('P1') .simulado:has-text('Simulado 1')")
        pg.click("text=Começar!")
        assert jogar(pg, banco, 3) == 27
        pg.wait_for_selector(".tela-resultado")
        nota = pg.inner_text(".nota")
        assert "8,9" in nota, nota  # 24 de 27 = 8,888… → 8,9 (associação errada pode dar pontos parciais, ver abaixo)
        pg.locator(".pacote").dispatch_event("click"); pg.wait_for_selector(".carta")
        assert "Tipo Terra" in pg.inner_text(".carta") and "Rara" in pg.inner_text(".carta")
        assert pg.locator(".carta-arte svg").count() == 1 and pg.locator(".carta-arte img").count() == 0
        if SHOTS: pg.screenshot(path=str(SHOTS / f"{nome}-resultado.png"))
        # treino das erradas não muda a nota
        pg.click("text=Treinar as que errei")
        jogar(pg, banco, 0)
        pg.click("text=Voltar ao resultado"); pg.wait_for_selector(".tela-resultado")
        assert "8,9" in pg.inner_text(".nota")
        # persiste depois de recarregar; carta no álbum
        pg.reload(); pg.wait_for_selector(".tela-resultado")
        pg.goto(URL + "#/album"); pg.wait_for_selector(".grade-cartas .carta")
        assert pg.locator(".grade-cartas .carta").count() == 1
        if SHOTS: pg.screenshot(path=str(SHOTS / f"{nome}-album.png"))
        # estrelas na matéria
        pg.goto(URL + "#/d/Geografia"); pg.wait_for_selector(".simulado")
        assert pg.locator(".prova:has-text('P1') .simulado:has-text('Simulado 1') .estrelas .acesa").count() == 2
        # simulado pela metade continua depois de recarregar
        pg.click(".prova:has-text('P1') .simulado:has-text('Simulado 2')"); pg.click("text=Começar!")
        pg.wait_for_selector(".numero-questao")
        responder(pg, banco2 := gabarito("geografia-p1-2")[int(pg.inner_text(".numero-questao"))], True)
        pg.reload(); pg.wait_for_selector(".numero-questao")
        assert "Questão 2 de 27" in pg.inner_text(".quiz-topo-texto")
        # backup e restauração
        pg.goto(URL + "#/ajustes"); pg.wait_for_selector("text=Baixar backup")
        with pg.expect_download() as d:
            pg.click("text=Baixar backup")
        arq = Path(d.value.path()); backup = json.loads(arq.read_text())
        assert len(backup["estado"]["cartas"]) == 1 and backup["estado"]["nome"] == "Maria"
        pg.click("text=Apagar progresso"); pg.click(".modal .botao:has-text('Apagar tudo')")
        pg.wait_for_selector(".grade-disciplinas")
        pg.goto(URL + "#/album"); pg.wait_for_selector(".vazio")
        pg.goto(URL + "#/ajustes"); pg.wait_for_selector("input[type=file]", state="attached")
        pg.set_input_files("input[type=file]", str(arq)); pg.wait_for_selector(".grade-disciplinas")
        pg.goto(URL + "#/album"); pg.wait_for_selector(".grade-cartas .carta")
        # offline (o service worker já guardou os arquivos)
        pg.goto(URL); pg.wait_for_timeout(2500)
        ctx.set_offline(True)
        pg.goto(URL); pg.wait_for_selector(".grade-disciplinas", timeout=8000)
        pg.click(".disciplina:has-text('História')")
        pg.click(".prova:has-text('P1') .simulado:has-text('Simulado 3')"); pg.click("text=Começar!")
        pg.wait_for_selector(".numero-questao")
        ctx.set_offline(False)
        assert not erros, erros
        print(nome, "ok")
        ctx.close()
    b.close()
print("tudo certo")
