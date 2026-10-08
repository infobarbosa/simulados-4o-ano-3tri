// Cartinhas colecionáveis: cada simulado concluído dá uma carta de uma criatura inventada para este app.
// O tipo vem da disciplina; a raridade vem da nota. O desenho é gerado a partir da `semente` (criatura.js).

import { criarRng } from "./motor.js";

export const ELEMENTO_POR_DISCIPLINA = {
  "Matemática": "raio", "Português": "agua", "Gramática": "gelo", "Ciências": "planta",
  "Geografia": "terra", "História": "fogo", "Bilíngue": "vento",
};

const NOMES = {
  raio: {
    comum: ["Faiscudo", "Zunzum", "Centelhinha", "Fusivelzinho", "Voltinho", "Estalinho"],
    rara: ["Relampagão", "Trovoleta", "Dínamo Rex", "Chispante"],
    lendaria: ["Tempestrovão", "Eletrônia"],
  },
  agua: {
    comum: ["Gotinha", "Borbulho", "Pinguelo", "Chapinha", "Marolinha", "Ondinho"],
    rara: ["Cascatão", "Marejante", "Maremoto", "Correntão"],
    lendaria: ["Abissalor", "Oceânia"],
  },
  gelo: {
    comum: ["Flocão", "Gelinho", "Nevinha", "Pingente", "Friozinho", "Sorvetin"],
    rara: ["Glacialdo", "Nevascão", "Iceberto", "Cristalino"],
    lendaria: ["Polarion", "Criogênia"],
  },
  planta: {
    comum: ["Brotinho", "Folhudo", "Sementinha", "Trevinho", "Musguito", "Cipozinho"],
    rara: ["Frondoso", "Florestino", "Cipoalto", "Raizão"],
    lendaria: ["Arvoredor", "Florestana"],
  },
  terra: {
    comum: ["Pedrinha", "Seixo", "Tatuzinho", "Barrento", "Cascalho", "Rochedinho"],
    rara: ["Montanhão", "Rochedão", "Terremotino", "Granitão"],
    lendaria: ["Tectônico", "Geodária"],
  },
  fogo: {
    comum: ["Brasinha", "Chamita", "Fagulha", "Carvãozinho", "Tochinha", "Cinzinha"],
    rara: ["Labaredo", "Vulcanito", "Chamejante", "Fornalha"],
    lendaria: ["Magmaron", "Solaris"],
  },
  vento: {
    comum: ["Brisinha", "Penugem", "Pipinha", "Asinha", "Ventinho", "Revoada"],
    rara: ["Ventania", "Turbilhão", "Redemoinho", "Rajadão"],
    lendaria: ["Ciclônia", "Celestial"],
  },
};

const ATAQUES = {
  raio: ["Choque de Tabuada", "Raio Fracionário", "Faísca Exata", "Trovão do Quociente"],
  agua: ["Onda de Palavras", "Jato de Rima", "Chuva de Plurais", "Maré da Notícia"],
  gelo: ["Sopro Sinônimo", "Nevasca Antônima", "Cristal Adjetivo", "Gelo Verbal"],
  planta: ["Folha Reversível", "Semente da Mistura", "Raiz Curiosa", "Pólen Científico"],
  terra: ["Terremoto Rural", "Rocha Urbana", "Avalanche de Mapas", "Tremor Industrial"],
  fogo: ["Chama Histórica", "Brasa das Caravelas", "Labareda do Tempo", "Fogo Migrante"],
  vento: ["Gust of Words", "Comparative Breeze", "Past Tense Tornado", "Windy Wonder"],
};

export function raridadePorNota(nota) {
  return nota >= 9 ? "lendaria" : nota >= 7 ? "rara" : "comum";
}

export function sortearCarta(disciplina, nota, semente = 1 + Math.floor(Math.random() * 2 ** 31)) {
  const rnd = criarRng(semente);
  const escolhe = (lista) => lista[Math.floor(rnd() * lista.length)];
  const elemento = ELEMENTO_POR_DISCIPLINA[disciplina] || "vento";
  const raridade = raridadePorNota(nota);
  const basePv = { comum: 40, rara: 70, lendaria: 110 }[raridade];
  return {
    disciplina, elemento, raridade,
    nome: escolhe(NOMES[elemento][raridade]),
    ataque: escolhe(ATAQUES[elemento]),
    pv: basePv + Math.floor(rnd() * 4) * 10,
    semente,
  };
}
