# Simulados do 4º ano (3º trimestre)

App web para treinar com simulados de **Matemática, Português, Gramática, Ciências, Geografia, História e Bilíngue** (provas P1 e Multidisciplinares do 3º trimestre do 4º ano). Responde-se uma questão por tela, com correção na hora, e cada simulado concluído dá uma **cartinha colecionável** de uma criatura inventada para o app.

É uma página estática (HTML, CSS e JavaScript, sem servidor e sem build), publicada no GitHub Pages. O progresso fica **só no aparelho** (`localStorage`); funciona offline depois da primeira visita.

## Como usar
1. Abra o endereço do GitHub Pages deste repositório no celular ou tablet (no iPhone: Compartilhar → Adicionar à Tela de Início; no Android/Chrome: ⋮ → Adicionar à tela inicial).
2. Na primeira vez o app pergunta o nome. Ele fica só no aparelho.
3. Escolha a matéria, a prova e o simulado (27 questões: V/F, ligar colunas, completar e múltipla escolha).

Depois de cada resposta aparece se acertou e, quando erra, a resposta certa e a página do livro para revisar. Não há cronômetro. A leitura em voz alta (🔊) usa a voz do aparelho. Ao terminar: nota de 0 a 10, de 1 a 3 estrelas, uma carta e o botão "Treinar as que errei" (não muda a nota).

### Cartas
| Matéria | Tipo | | Nota | Raridade |
|---|---|---|---|---|
| Matemática | Elétrico | | 9 a 10 | ★★ Lendária |
| Português | Água | | 7 a 8,9 | ★ Rara |
| Gramática | Gelo | | abaixo de 7 | ● Comum |
| Ciências | Planta | | | |
| Geografia | Terra | | | |
| História | Fogo | | | |
| Bilíngue | Voador | | | |

As criaturas são desenhadas pelo próprio app (SVG gerado a partir de uma semente) e têm nomes inventados. Não há imagens nem marcas de terceiros.

### Regras de correção
- Só a primeira passada conta na nota. Na associação, cada par certo vale 1/4.
- Lacunas: maiúsculas, espaços e ponto final não importam; diferença só de acento conta como certo (a tela mostra a grafia correta); números e frações equivalentes valem.
- A Parte 5 (questões abertas) dos PDFs originais fica fora.

### Backup
Em **Ajustes e backup** (rodapé da tela inicial) dá para baixar o progresso em arquivo, restaurar em outro aparelho e apagar tudo. Limpar os dados do navegador apaga o progresso, então vale baixar o backup de vez em quando.

## Para quem for mexer
```bash
python3 -m http.server 8000          # http://localhost:8000
# testes do motor: http://localhost:8000/tests/  (título da aba: "OK 12/12")
python3 tests/e2e.py http://localhost:8000/ [pasta-de-screenshots]   # pip install playwright + Chrome (CHROME)
```
O conteúdo vem de `conteudo/*.json`, gerado a partir dos PDFs (que **não** ficam neste repositório) com `python3 tools/gerar_conteudo.py PASTA_DOS_PDFS` (precisa de `pdftotext`). Veja o `CLAUDE.md` para a arquitetura.

Este projeto é a versão estática do app com servidor `simulados-vitor` (privado). O conteúdo das questões foi elaborado a partir da coleção didática da escola, para estudo pessoal.
