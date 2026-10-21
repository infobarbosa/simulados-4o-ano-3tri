# Simulados do 4º ano (3º trimestre)

App web para treinar com simulados de **Matemática, Português, Gramática, Ciências, Geografia, História e Bilíngue** (provas P1 e Multidisciplinares do 3º trimestre do 4º ano). Responde-se uma questão por tela, com correção na hora, e cada simulado concluído dá uma **cartinha colecionável** de uma criatura inventada para o app.

É uma página estática (HTML, CSS e JavaScript, sem servidor e sem build), publicada no GitHub Pages. O progresso fica **só no aparelho** (`localStorage`); funciona offline depois da primeira visita.

## Como usar
1. Abra o endereço do GitHub Pages deste repositório no celular ou tablet (no iPhone: Compartilhar → Adicionar à Tela de Início; no Android/Chrome: ⋮ → Adicionar à tela inicial).
2. Na primeira vez o app pergunta o nome. Ele fica só no aparelho.
3. Escolha a matéria, a prova e o simulado (27 questões: V/F, ligar colunas, completar, múltipla escolha e, nos simulados 4 e 5 de Matemática, pintar a fração na figura).

Algumas questões trazem uma **caixa de contexto** acima do enunciado, com os dados que no livro estão em figura ou tabela (a receita e o suco, em Frações; o gráfico dos trabalhadores, em Geografia). Em Geografia, o mapa das indústrias do Brasil é **desenhado pelo app**, com legenda e a sigla de cada estado. Assim dá para responder sem o livro aberto.

Se bater dúvida antes de responder, o botão **"📖 Não sei — ler o conteúdo"** abre uma mini-aula curta do assunto da questão (com exemplos, tabela e uma dica), que dá para ouvir em voz alta; ler não muda a nota. Depois de cada resposta aparece se acertou e, quando erra, a resposta certa, a página do livro para revisar e de novo o botão do conteúdo. Por enquanto as mini-aulas existem no Simulado 6 de Gramática (verbos) e em todos os simulados de Geografia do Capítulo 8 (os 5 da P1); nas outras questões o botão não aparece. Não há cronômetro. A leitura em voz alta (🔊) usa a voz do aparelho. Ao terminar: nota de 0 a 10, de 1 a 3 estrelas, uma carta e o botão "Treinar as que errei" (não muda a nota). **A carta mostra a nota daquela rodada**, no rodapé, ao lado da raridade — no resultado e no álbum, inclusive nas cartas ganhas antes.

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

## Termos de uso

No primeiro acesso o app mostra um resumo e pede o aceite de um adulto (a caixinha libera o botão); o texto completo está em Ajustes → "Termos de uso". Resumo: app gratuito e informal, sem garantia de funcionamento nem de continuidade, questões e gabaritos podem ter erros, o progresso fica só no aparelho e pode se perder. O texto fica em `js/termos.js`; ao mudá-lo, aumente `VERSAO_TERMOS` para pedir novo aceite.

## Para quem for mexer
```bash
python3 -m http.server 8000          # http://localhost:8000
# testes do motor: http://localhost:8000/tests/  (título da aba: "OK 23/23")
python3 tests/e2e.py http://localhost:8000/ [pasta-de-screenshots]   # pip install playwright + Chrome (CHROME)
```
As mini-aulas do botão de conteúdo ficam em `conteudo/materia/*.json`. O resto do conteúdo vem de `conteudo/*.json`, gerado a partir dos PDFs (que **não** ficam neste repositório) com `python3 tools/gerar_conteudo.py PASTA_DOS_PDFS` (precisa de `pdftotext`). Veja o `CLAUDE.md` para a arquitetura.

Este projeto é a versão estática do app com servidor `simulados-vitor` (privado). O conteúdo das questões foi elaborado a partir da coleção didática da escola, para estudo pessoal.
