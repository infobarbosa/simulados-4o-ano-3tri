// Monta a carta colecionável. A arte é uma criatura original desenhada em SVG a partir da semente
// (mesma semente = mesma criatura), sem imagens externas: funciona offline.

import { el, svg, ELEMENTOS, formatarNota } from "./util.js";
import { criarRng as gerador } from "./motor.js";

function hsl(h, s, l) { return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`; }

const MATIZ = { raio: 58, agua: 212, gelo: 190, planta: 130, terra: 28, fogo: 14, vento: 262 };

function acessorio(elemento, cx, topo, cor, escura, rnd) {
  switch (elemento) {
    case "raio": // antenas com lâmpadas + raio na testa (nada de orelhas pontudas)
      return `<path d="M${cx - 18} ${topo + 8} Q${cx - 30} ${topo - 26} ${cx - 44} ${topo - 34}" fill="none" stroke="${escura}" stroke-width="4" stroke-linecap="round"/>
              <path d="M${cx + 18} ${topo + 8} Q${cx + 30} ${topo - 26} ${cx + 44} ${topo - 34}" fill="none" stroke="${escura}" stroke-width="4" stroke-linecap="round"/>
              <circle cx="${cx - 46}" cy="${topo - 38}" r="11" fill="#FFF3A6" stroke="${escura}" stroke-width="3"/>
              <circle cx="${cx + 46}" cy="${topo - 38}" r="11" fill="#FFF3A6" stroke="${escura}" stroke-width="3"/>
              <path d="M${cx - 60} ${topo - 52} l-6 -6 M${cx - 46} ${topo - 56} v-9 M${cx + 60} ${topo - 52} l6 -6 M${cx + 46} ${topo - 56} v-9" stroke="#F5B700" stroke-width="3" stroke-linecap="round"/>
              <path d="M${cx + 4} ${topo + 6} l-10 14 h8 l-6 12 l14 -17 h-8 l6 -9 Z" fill="#fff" stroke="${escura}" stroke-width="2" stroke-linejoin="round"/>`;
    case "agua":
      return `<path d="M${cx - 6} ${topo + 8} Q${cx + 4} ${topo - 50} ${cx + 30} ${topo - 40} Q${cx + 14} ${topo - 20} ${cx + 22} ${topo + 8} Z" fill="${escura}" opacity=".85"/>
              <circle cx="${cx - 60}" cy="${topo - 10}" r="7" fill="none" stroke="#fff" stroke-width="3" opacity=".8"/>
              <circle cx="${cx - 72}" cy="${topo - 32}" r="4" fill="none" stroke="#fff" stroke-width="2.5" opacity=".7"/>`;
    case "gelo":
      return [-30, 0, 30].map((dx, i) =>
        `<path d="M${cx + dx - 12} ${topo + 12} L${cx + dx} ${topo - 34 - (i === 1 ? 14 : 0)} L${cx + dx + 12} ${topo + 12} Z" fill="#E8FBFF" stroke="${escura}" stroke-width="3" stroke-linejoin="round"/>`).join("");
    case "planta": {
      const giro = rnd() * 30 - 15;
      return `<g transform="rotate(${giro} ${cx} ${topo})">
                <path d="M${cx} ${topo + 6} L${cx} ${topo - 26}" stroke="#1B6B39" stroke-width="5" stroke-linecap="round"/>
                <path d="M${cx} ${topo - 24} Q${cx - 40} ${topo - 50} ${cx - 46} ${topo - 20} Q${cx - 20} ${topo - 8} ${cx} ${topo - 24} Z" fill="#5CCB7A" stroke="#1B6B39" stroke-width="3"/>
                <path d="M${cx} ${topo - 24} Q${cx + 40} ${topo - 56} ${cx + 48} ${topo - 26} Q${cx + 22} ${topo - 10} ${cx} ${topo - 24} Z" fill="#7BDC94" stroke="#1B6B39" stroke-width="3"/>
              </g>`;
    }
    case "terra":
      return [-36, -8, 22].map((dx, i) =>
        `<path d="M${cx + dx - 14} ${topo + 14} L${cx + dx - 6} ${topo - 14 - i * 4} L${cx + dx + 12} ${topo - 8} L${cx + dx + 16} ${topo + 14} Z" fill="#9C8F80" stroke="#4E4237" stroke-width="3" stroke-linejoin="round"/>`).join("");
    case "fogo":
      return `<path d="M${cx - 28} ${topo + 14} Q${cx - 40} ${topo - 24} ${cx - 12} ${topo - 40} Q${cx - 14} ${topo - 16} ${cx} ${topo - 20} Q${cx - 4} ${topo - 56} ${cx + 24} ${topo - 64} Q${cx + 14} ${topo - 30} ${cx + 34} ${topo - 22} Q${cx + 40} ${topo} ${cx + 28} ${topo + 14} Z" fill="#FFB020" stroke="#C2410C" stroke-width="3" stroke-linejoin="round"/>
              <path d="M${cx - 10} ${topo + 10} Q${cx - 14} ${topo - 14} ${cx + 4} ${topo - 26} Q${cx + 2} ${topo - 8} ${cx + 14} ${topo - 4} Q${cx + 16} ${topo + 6} ${cx + 10} ${topo + 10} Z" fill="#FFE066"/>`;
    case "vento":
    default:
      return `<path d="M${cx - 50} ${topo + 4} q -10 -26 14 -34 q 22 -6 22 14 q 0 12 -12 12 q -10 0 -8 -8" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".85"/>
              <path d="M${cx + 46} ${topo - 6} q 24 -10 30 10 q 4 16 -12 18 q -10 0 -10 -8" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".75"/>`;
  }
}

function cauda(elemento, cx, base, cor, escura) {
  const x = cx + 70, y = base - 40;
  if (elemento === "raio") return `<path d="M${x - 14} ${y + 26} Q${x + 24} ${y + 30} ${x + 22} ${y}" fill="none" stroke="${escura}" stroke-width="6" stroke-linecap="round"/><rect x="${x + 10}" y="${y - 22}" width="24" height="20" rx="5" fill="#C9CED8" stroke="${escura}" stroke-width="3"/><path d="M${x + 16} ${y - 22} v-8 M${x + 28} ${y - 22} v-8" stroke="${escura}" stroke-width="3" stroke-linecap="round"/>`;
  if (elemento === "agua") return `<path d="M${x - 14} ${y + 26} Q${x + 20} ${y + 20} ${x + 26} ${y - 4} L${x + 44} ${y - 14} L${x + 38} ${y + 10} L${x + 50} ${y + 26} L${x + 26} ${y + 20} Q${x + 14} ${y + 40} ${x - 14} ${y + 38} Z" fill="${cor}" stroke="${escura}" stroke-width="3" stroke-linejoin="round"/>`;
  return `<path d="M${x - 14} ${y + 26} Q${x + 30} ${y + 28} ${x + 30} ${y - 6} Q${x + 30} ${y - 22} ${x + 18} ${y - 20}" fill="none" stroke="${escura}" stroke-width="9" stroke-linecap="round"/>`;
}

export function criaturaSVG(semente, elemento, raridade = "comum") {
  const rnd = gerador(semente);
  const matiz = (MATIZ[elemento] ?? 260) + (rnd() * 24 - 12);
  const cor = hsl(matiz, 62 + rnd() * 20, 58 + rnd() * 10);
  const escura = hsl(matiz, 55, 30);
  const barriga = hsl(matiz, 70, 86);
  const cx = 120, base = 196;
  const forma = Math.floor(rnd() * 3);
  const largura = 62 + rnd() * 16;
  const altura = 58 + rnd() * 14;
  const cy = base - altura - 6;
  let corpo;
  if (forma === 0) { // redondinho
    corpo = `<ellipse cx="${cx}" cy="${cy}" rx="${largura}" ry="${altura}" fill="${cor}" stroke="${escura}" stroke-width="4"/>`;
  } else if (forma === 1) { // pera
    corpo = `<path d="M${cx} ${cy - altura} C ${cx + largura * 0.7} ${cy - altura} ${cx + largura * 1.1} ${cy + altura * 0.3} ${cx + largura} ${cy + altura * 0.7} Q ${cx} ${cy + altura * 1.25} ${cx - largura} ${cy + altura * 0.7} C ${cx - largura * 1.1} ${cy + altura * 0.3} ${cx - largura * 0.7} ${cy - altura} ${cx} ${cy - altura} Z" fill="${cor}" stroke="${escura}" stroke-width="4"/>`;
  } else { // gotinha larga
    corpo = `<rect x="${cx - largura}" y="${cy - altura}" width="${largura * 2}" height="${altura * 2}" rx="${largura * 0.8}" fill="${cor}" stroke="${escura}" stroke-width="4"/>`;
  }
  const topo = cy - altura + 6;
  const olhoR = 11 + rnd() * 6;
  const afast = 22 + rnd() * 10;
  const olhoY = cy - altura * 0.15;
  const olho = (x) => `<ellipse cx="${x}" cy="${olhoY}" rx="${olhoR}" ry="${olhoR * 1.15}" fill="#fff" stroke="${escura}" stroke-width="3"/>
    <circle cx="${x + 2}" cy="${olhoY + 3}" r="${olhoR * 0.62}" fill="#1E1B2E"/>
    <circle cx="${x + 5}" cy="${olhoY - 2}" r="${olhoR * 0.24}" fill="#fff"/>`;
  const bocaY = olhoY + olhoR + 16;
  const bocas = [
    `<path d="M${cx - 12} ${bocaY} Q${cx} ${bocaY + 12} ${cx + 12} ${bocaY}" fill="none" stroke="#1E1B2E" stroke-width="3.5" stroke-linecap="round"/>`,
    `<path d="M${cx - 12} ${bocaY - 2} Q${cx} ${bocaY + 18} ${cx + 12} ${bocaY - 2} Z" fill="#7A1F2B" stroke="#1E1B2E" stroke-width="3"/><path d="M${cx - 5} ${bocaY + 6} Q${cx} ${bocaY + 12} ${cx + 5} ${bocaY + 6}" fill="#FF8FA3"/>`,
    `<path d="M${cx - 12} ${bocaY} Q${cx - 6} ${bocaY + 8} ${cx} ${bocaY} Q${cx + 6} ${bocaY + 8} ${cx + 12} ${bocaY}" fill="none" stroke="#1E1B2E" stroke-width="3.5" stroke-linecap="round"/><path d="M${cx + 4} ${bocaY + 2} l3 7 l3 -6" fill="#fff" stroke="#1E1B2E" stroke-width="1.5"/>`,
  ];
  const boca = bocas[Math.floor(rnd() * bocas.length)];
  const bochecha = elemento !== "raio" && rnd() > 0.35
    ? `<ellipse cx="${cx - afast - 14}" cy="${bocaY - 2}" rx="9" ry="6" fill="#FF7A9A" opacity=".55"/><ellipse cx="${cx + afast + 14}" cy="${bocaY - 2}" rx="9" ry="6" fill="#FF7A9A" opacity=".55"/>`
    : "";
  const pes = `<ellipse cx="${cx - largura * 0.5}" cy="${base - 4}" rx="18" ry="10" fill="${escura}"/><ellipse cx="${cx + largura * 0.5}" cy="${base - 4}" rx="18" ry="10" fill="${escura}"/>`;
  const bracos = `<ellipse cx="${cx - largura + 2}" cy="${cy + 14}" rx="10" ry="16" fill="${cor}" stroke="${escura}" stroke-width="3" transform="rotate(25 ${cx - largura} ${cy + 14})"/>
    <ellipse cx="${cx + largura - 2}" cy="${cy + 14}" rx="10" ry="16" fill="${cor}" stroke="${escura}" stroke-width="3" transform="rotate(-25 ${cx + largura} ${cy + 14})"/>`;
  const manchas = rnd() > 0.5
    ? `<circle cx="${cx - largura * 0.55}" cy="${cy - altura * 0.45}" r="6" fill="${escura}" opacity=".25"/><circle cx="${cx + largura * 0.6}" cy="${cy - altura * 0.3}" r="4" fill="${escura}" opacity=".25"/>`
    : "";
  const brilho = (x, y, r) => `<path d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z" fill="#fff" stroke="#F5B700" stroke-width="2"/>`;
  const enfeite = raridade === "lendaria"
    ? `<ellipse cx="${cx}" cy="${cy}" rx="${largura + 34}" ry="${altura + 30}" fill="#FFF3A6" opacity=".35"/>${brilho(34, 40, 14)}${brilho(206, 30, 11)}${brilho(214, 120, 9)}${brilho(24, 124, 8)}`
    : raridade === "rara" ? `${brilho(36, 44, 11)}${brilho(204, 36, 9)}` : "";
  return `<svg viewBox="0 0 240 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="criatura">
    ${enfeite}
    <ellipse cx="${cx}" cy="${base + 2}" rx="${largura + 10}" ry="8" fill="#000" opacity=".12"/>
    ${cauda(elemento, cx, base, cor, escura)}
    ${pes}
    ${corpo}
    <ellipse cx="${cx}" cy="${cy + altura * 0.35}" rx="${largura * 0.55}" ry="${altura * 0.45}" fill="${barriga}" opacity=".9"/>
    ${manchas}
    ${bracos}
    ${acessorio(elemento, cx, topo, cor, escura, rnd)}
    ${olho(cx - afast)}${olho(cx + afast)}
    ${bochecha}
    ${boca}
  </svg>`;
}

const RARIDADE = {
  comum: { nome: "Comum", simbolo: "●" },
  rara: { nome: "Rara", simbolo: "★" },
  lendaria: { nome: "Lendária", simbolo: "★★" },
};

function arteEl(carta) {
  return el("div.carta-arte", svg(criaturaSVG(carta.semente, carta.elemento, carta.raridade)));
}

export function cartaEl(carta, { pequena = false } = {}) {
  const e = ELEMENTOS[carta.elemento] || ELEMENTOS.vento;
  const r = RARIDADE[carta.raridade] || RARIDADE.comum;
  const dano = { comum: 20, rara: 40, lendaria: 70 }[carta.raridade] || 20;
  return el(`div.carta.${carta.raridade}${pequena ? ".pequena" : ""}`,
    { style: { "--cor": e.cor, "--escura": e.escura } },
    el("div.carta-topo",
      el("span.carta-nome", carta.nome),
      el("span.carta-pv", el("small", "PV"), carta.pv, " ", e.icone),
    ),
    arteEl(carta),
    el("div.carta-info", `Tipo ${e.nome} • ${carta.disciplina}`),
    el("div.carta-ataque",
      el("span", e.icone, " ", carta.ataque),
      el("strong", dano),
    ),
    el("div.carta-rodape",
      el("span", r.simbolo, " ", r.nome),
      // a nota da rodada que deu esta carta: é o que ele quer ver ao rever o álbum
      carta.nota === null || carta.nota === undefined
        ? null
        : el("span.carta-nota", el("small", "Nota "), formatarNota(carta.nota)),
      el("span", carta.obtida_em ? new Date(carta.obtida_em).toLocaleDateString("pt-BR") : ""),
    ),
  );
}
