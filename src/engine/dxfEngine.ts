import { AVVISO_RESPONSABILITA_LEGALE } from '../data/rulesAndLibrary';
import {
  MappaturaCampoDXF,
  ProgettoAntincendio,
  RisultatoCalcoloCompleto,
  TemplateTavolaDXF,
  TipoPosa,
} from '../types/elettrocad';

// 1 colonna montante generale (Q.GEN / QS0) + fino a 6 linee in partenza per tavola A3
export const LINEE_PER_TAVOLA = 6;
const CAVI_PER_TAVOLA = 6;
const MORSETTI_PER_TAVOLA = 7;

export function parseDxfTemplate(
  fileName: string,
  content: string,
  clienteAssociato = 'Personalizzato'
): TemplateTavolaDXF {
  const lines = content.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim());
  const layers = new Set<string>();
  const blocks = new Set<string>();
  const attributes = new Set<string>();

  let extMinX = 0;
  let extMinY = 0;
  let extMaxX = 420;
  let extMaxY = 297;

  let currentSection = '';
  let currentEntity = '';
  let currentVar = '';

  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = lines[i];
    const value = lines[i + 1] ?? '';

    if (code === '0' && value === 'SECTION') {
      const nextCode = lines[i + 2];
      const nextVal = lines[i + 3];
      if (nextCode === '2') {
        currentSection = nextVal;
      }
    }

    if (currentSection === 'HEADER') {
      if (code === '9') {
        currentVar = value;
      } else if (currentVar === '$EXTMIN') {
        if (code === '10') extMinX = parseFloat(value) || 0;
        if (code === '20') extMinY = parseFloat(value) || 0;
      } else if (currentVar === '$EXTMAX') {
        if (code === '10') extMaxX = parseFloat(value) || 420;
        if (code === '20') extMaxY = parseFloat(value) || 297;
      }
    }

    if (code === '0') {
      currentEntity = value;
    }

    if (currentSection === 'TABLES' && currentEntity === 'LAYER' && code === '2' && value) {
      layers.add(value);
    }

    if (currentSection === 'BLOCKS' && currentEntity === 'BLOCK' && code === '2' && value) {
      if (!value.startsWith('*')) {
        blocks.add(value);
      }
    }

    if ((currentEntity === 'ATTDEF' || currentEntity === 'ATTRIB') && code === '2' && value) {
      attributes.add(value.toUpperCase());
    }
  }

  const width = Math.abs(extMaxX - extMinX) || 420;
  const height = Math.abs(extMaxY - extMinY) || 297;
  const isA4 = Math.max(width, height) <= 320;
  const isOrizzontale = width >= height;

  const attrList = Array.from(attributes);
  const guessAttr = (keywords: string[], fallback: string) =>
    attrList.find((a) => keywords.some((k) => a.includes(k))) ?? fallback;

  const mappatura: MappaturaCampoDXF[] = [
    { campoProgetto: 'commessa', tagAttributoDXF: guessAttr(['COMMESSA', 'JOB', 'COD'], 'COMMESSA') },
    { campoProgetto: 'cliente', tagAttributoDXF: guessAttr(['CLIENTE', 'CLIENT', 'COMMITT'], 'CLIENTE') },
    { campoProgetto: 'progettista', tagAttributoDXF: guessAttr(['PROGETT', 'AUTORE', 'DIS'], 'PROGETTISTA') },
    { campoProgetto: 'titoloTavola', tagAttributoDXF: guessAttr(['TITOLO', 'OGGETTO', 'TITLE'], 'TITOLO_TAVOLA') },
    { campoProgetto: 'scala', tagAttributoDXF: guessAttr(['SCALA', 'SCALE'], 'SCALA') },
    { campoProgetto: 'data', tagAttributoDXF: guessAttr(['DATA', 'DATE'], 'DATA') },
    { campoProgetto: 'revisione', tagAttributoDXF: guessAttr(['REV'], 'REVISIONE') },
    { campoProgetto: 'numeroTavola', tagAttributoDXF: guessAttr(['TAV', 'FOGLIO', 'SHEET'], 'NUM_TAVOLA') },
  ];

  return {
    id: `tpl-dxf-${Date.now()}`,
    nome: fileName.replace(/\.dxf$/i, ''),
    versione: 'v1.0 (Importato AutoCAD)',
    clienteAssociato,
    predefinito: false,
    formatoFoglio: isA4 ? 'A4' : 'A3',
    orientamento: isOrizzontale ? 'orizzontale' : 'verticale',
    larghezzaMm: Math.round(width),
    altezzaMm: Math.round(height),
    layerRilevati: layers.size > 0 ? Array.from(layers) : ['0', 'CARTIGLIO', 'TESTI'],
    blocchiRilevati: blocks.size > 0 ? Array.from(blocks) : ['CARTIGLIO'],
    attributiRilevati: attrList.length > 0 ? attrList : mappatura.map((m) => m.tagAttributoDXF),
    mappatura,
    nomeFileOriginale: fileName,
    rawDxfContent: content.slice(0, 20000),
  };
}

function dxfLine(
  layer: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = 256,
  ltype = 'CONTINUOUS'
): string {
  return [
    '0', 'LINE',
    '8', layer,
    '6', ltype,
    '62', String(color),
    '10', x1.toFixed(2),
    '20', y1.toFixed(2),
    '30', '0.0',
    '11', x2.toFixed(2),
    '21', y2.toFixed(2),
    '31', '0.0',
  ].join('\n');
}

function dxfRect(
  layer: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color = 256,
  ltype = 'CONTINUOUS'
): string {
  return [
    dxfLine(layer, x, y, x + w, y, color, ltype),
    dxfLine(layer, x + w, y, x + w, y + h, color, ltype),
    dxfLine(layer, x + w, y + h, x, y + h, color, ltype),
    dxfLine(layer, x, y + h, x, y, color, ltype),
  ].join('\n');
}

function dxfCircle(layer: string, cx: number, cy: number, r: number, color = 256): string {
  return [
    '0', 'CIRCLE',
    '8', layer,
    '62', String(color),
    '10', cx.toFixed(2),
    '20', cy.toFixed(2),
    '30', '0.0',
    '40', r.toFixed(2),
  ].join('\n');
}

function dxfArc(
  layer: string,
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
  color = 256
): string {
  return [
    '0', 'ARC',
    '8', layer,
    '62', String(color),
    '10', cx.toFixed(2),
    '20', cy.toFixed(2),
    '30', '0.0',
    '40', r.toFixed(2),
    '50', startDeg.toFixed(1),
    '51', endDeg.toFixed(1),
  ].join('\n');
}

function sanitizeDxfText(text: string): string {
  return text
    .replace(/[\r\n]+/g, ' ')
    .replace(/Δ/g, 'd')
    .replace(/φ/g, 'Fi')
    .replace(/²/g, '2')
    .replace(/[^\x20-\x7EÀ-ÿ]/g, ' ')
    .slice(0, 120);
}

function dxfText(
  layer: string,
  x: number,
  y: number,
  height: number,
  text: string,
  color = 256,
  align: 'left' | 'center' | 'right' = 'left',
  rot = 0
): string {
  const safe = sanitizeDxfText(text);
  if (align === 'left') {
    return [
      '0', 'TEXT',
      '8', layer,
      '62', String(color),
      '10', x.toFixed(2),
      '20', y.toFixed(2),
      '30', '0.0',
      '40', height.toFixed(2),
      '50', rot.toFixed(1),
      '1', safe,
    ].join('\n');
  }
  const hAlign = align === 'center' ? '1' : '2';
  return [
    '0', 'TEXT',
    '8', layer,
    '62', String(color),
    '10', x.toFixed(2),
    '20', y.toFixed(2),
    '30', '0.0',
    '40', height.toFixed(2),
    '50', rot.toFixed(1),
    '1', safe,
    '72', hAlign,
    '73', '2',
    '11', x.toFixed(2),
    '21', y.toFixed(2),
    '31', '0.0',
  ].join('\n');
}

function dxfInsert(layer: string, blockName: string, x: number, y: number, scale = 1): string {
  return [
    '0', 'INSERT',
    '8', layer,
    '2', blockName,
    '10', x.toFixed(2),
    '20', y.toFixed(2),
    '30', '0.0',
    '41', scale.toFixed(2),
    '42', scale.toFixed(2),
    '43', scale.toFixed(2),
  ].join('\n');
}

function formatPosaBreve(posa: TipoPosa, tempC: number, nCirc: number): string {
  const cod =
    posa === 'tubo_incassato'
      ? 'B1'
      : posa === 'tubo_a_vista'
      ? 'B2'
      : posa === 'canale_passerella'
      ? 'E'
      : posa === 'interrato'
      ? 'D'
      : 'F';
  return `${cod} · ${tempC}C / ${nCirc} circ.`;
}

function formatPosaCodice(posa: TipoPosa): string {
  switch (posa) {
    case 'tubo_incassato':
      return 'B1 (5)';
    case 'tubo_a_vista':
      return 'B2 (4)';
    case 'canale_passerella':
      return 'E (13)';
    case 'interrato':
      return 'D (71)';
    case 'aria_libera':
      return 'F (15)';
  }
}

function formatPosaDescrizione(posa: TipoPosa): [string, string, string] {
  switch (posa) {
    case 'tubo_incassato':
      return [
        'Cavi in tubi protettivi annegati',
        'nella muratura o sotto traccia',
        '(CEI 64-8 Tab. 52C - Rif. B1)',
      ];
    case 'tubo_a_vista':
      return [
        'Cavi in tubi protettivi fissati',
        'a parete o soffitto in vista',
        '(CEI 64-8 Tab. 52C - Rif. B2)',
      ];
    case 'canale_passerella':
      return [
        'Cavi resistenti al fuoco posati su',
        'passerella forata / canale protetto',
        '(CEI 64-8 Tab. 52C - Rif. E)',
      ];
    case 'interrato':
      return [
        'Cavi in cavidotto interrato protetto',
        'con pozzetti ispezionabili',
        '(CEI 64-8 Tab. 52C - Rif. D)',
      ];
    case 'aria_libera':
      return [
        'Cavi posati in aria libera su',
        'mensole o collari distanziati',
        '(CEI 64-8 Tab. 52C - Rif. F)',
      ];
  }
}

function formatTipologiaProtezione(tipo: ProgettoAntincendio['linee'][number]['tipoProtezione']): string {
  switch (tipo) {
    case 'magnetotermico_differenziale':
      return 'MagnetoTermicoDiff.';
    case 'magnetotermico':
      return 'MagnetoTermico';
    case 'fusibile':
      return 'Fusibile';
    case 'sezionatore':
      return 'Sezionatore';
  }
}

interface SheetGeom {
  margin: number;
  bandW: number;
  bandH: number;
  outerX: number;
  outerR: number;
  outerY: number;
  outerT: number;
  innerX: number;
  innerR: number;
  innerY: number;
  innerT: number;
  innerW: number;
  innerH: number;
}

// Disegna la squadratura identica su tutti gli elaborati DXF:
// cornice esterna/interna, lettere laterali A-F, numeri bianchi 1-8 sopra e sotto, quadrati d'angolo.
function renderDxfTemplateFrame(
  entities: string[],
  ox: number,
  oy: number,
  sheetW: number,
  sheetH: number
): SheetGeom {
  const margin = 8;
  const bandW = 6;
  const bandH = 5;
  const outerX = ox + margin;
  const outerR = ox + sheetW - margin;
  const outerY = oy + margin;
  const outerT = oy + sheetH - margin;

  const innerX = outerX + bandW; // +14
  const innerR = outerR - bandW; // sheetW - 14
  const innerY = outerY + bandH; // +13
  const innerT = outerT - bandH; // sheetH - 13
  const innerW = innerR - innerX; // 392 mm su A3
  const innerH = innerT - innerY; // 271 mm su A3

  entities.push(dxfRect('CARTIGLIO', outerX, outerY, sheetW - 2 * margin, sheetH - 2 * margin, 7));
  entities.push(dxfRect('CARTIGLIO', innerX, innerY, innerW, innerH, 7));
  entities.push(dxfLine('CARTIGLIO', innerX, outerY, innerX, innerY, 7));
  entities.push(dxfLine('CARTIGLIO', innerR, outerY, innerR, innerY, 7));
  entities.push(dxfLine('CARTIGLIO', innerX, innerT, innerX, outerT, 7));
  entities.push(dxfLine('CARTIGLIO', innerR, innerT, innerR, outerT, 7));
  entities.push(dxfLine('CARTIGLIO', outerX, innerY, innerX, innerY, 7));
  entities.push(dxfLine('CARTIGLIO', innerR, innerY, outerR, innerY, 7));
  entities.push(dxfLine('CARTIGLIO', outerX, innerT, innerX, innerT, 7));
  entities.push(dxfLine('CARTIGLIO', innerR, innerT, outerR, innerT, 7));

  const zoneLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const zoneH = innerH / zoneLetters.length;
  zoneLetters.forEach((letter, zIdx) => {
    const yTop = innerT - zIdx * zoneH;
    const yMid = yTop - zoneH / 2;
    if (zIdx > 0) {
      entities.push(dxfLine('CARTIGLIO', outerX, yTop, innerX, yTop, 7));
      entities.push(dxfLine('CARTIGLIO', innerR, yTop, outerR, yTop, 7));
    }
    entities.push(dxfText('CARTIGLIO', outerX + bandW / 2, yMid, 2.3, letter, 7, 'center'));
    entities.push(dxfText('CARTIGLIO', innerR + bandW / 2, yMid, 2.3, letter, 7, 'center'));
  });

  const numColsGrid = 8;
  const gridColW = innerW / numColsGrid;
  const topBandMidY = innerT + bandH / 2;
  const botBandMidY = outerY + bandH / 2;
  for (let g = 0; g < numColsGrid; g++) {
    const gx = innerX + g * gridColW;
    const gMid = gx + gridColW / 2;
    if (g > 0) {
      entities.push(dxfLine('CARTIGLIO', gx, innerT, gx, outerT, 7));
      entities.push(dxfLine('CARTIGLIO', gx, outerY, gx, innerY, 7));
    }
    entities.push(dxfText('CARTIGLIO', gMid, topBandMidY, 2.3, String(g + 1), 7, 'center'));
    entities.push(dxfText('CARTIGLIO', gMid, botBandMidY, 2.3, String(g + 1), 7, 'center'));
  }

  return {
    margin,
    bandW,
    bandH,
    outerX,
    outerR,
    outerY,
    outerT,
    innerX,
    innerR,
    innerY,
    innerT,
    innerW,
    innerH,
  };
}

// Disegna la fascia inferiore condivisa NOTA + Avviso responsabilità + Cartiglio mappato dal template
function renderNotaCartiglioFooter(
  entities: string[],
  geom: SheetGeom,
  progetto: ProgettoAntincendio,
  calcolo: RisultatoCalcoloCompleto,
  template: TemplateTavolaDXF,
  sheetIdx: number,
  numTavole: number,
  titoloOverride?: string
): number {
  const notaY = geom.innerY;
  const notaH = 18;
  entities.push(dxfRect('CARTIGLIO', geom.innerX, notaY, geom.innerW, notaH, 7));

  const cartW = 148;
  const cartX = geom.innerR - cartW;
  entities.push(dxfLine('CARTIGLIO', cartX, notaY, cartX, notaY + notaH, 7));
  entities.push(dxfLine('CARTIGLIO', cartX, notaY + 9, geom.innerR, notaY + 9, 7));
  entities.push(dxfLine('CARTIGLIO', cartX + 95, notaY, cartX + 95, notaY + notaH, 7));

  const noteFoglio = progetto.annotazioni
    .filter((a) => a.foglio === sheetIdx + 1)
    .map((a) => a.testo)
    .join(' | ');
  entities.push(
    dxfText(
      'TESTI',
      geom.innerX + 2,
      notaY + 13.5,
      2.0,
      `NOTA: ${noteFoglio || 'Circuiti di sicurezza conformi CEI 64-8 Cap. 56 e Codice P.I.'}`,
      7,
      'left'
    ),
    dxfText(
      'CARTIGLIO',
      geom.innerX + 2,
      notaY + 7.5,
      1.45,
      AVVISO_RESPONSABILITA_LEGALE.slice(0, 118),
      1,
      'left'
    ),
    dxfText(
      'CARTIGLIO',
      geom.innerX + 2,
      notaY + 3.0,
      1.45,
      AVVISO_RESPONSABILITA_LEGALE.slice(118, 236),
      1,
      'left'
    )
  );

  const getValMappato = (campo: MappaturaCampoDXF['campoProgetto']): string => {
    switch (campo) {
      case 'commessa':
        return progetto.identificativi.commessa;
      case 'cliente':
        return progetto.identificativi.cliente;
      case 'progettista':
        return progetto.identificativi.progettista;
      case 'titoloTavola':
        return titoloOverride ?? progetto.identificativi.titoloTavola;
      case 'scala':
        return progetto.identificativi.scala;
      case 'data':
        return progetto.identificativi.data;
      case 'revisione':
        return progetto.identificativi.revisione;
      case 'numeroTavola':
        return `${sheetIdx + 1}/${numTavole}`;
    }
  };

  const tagCommessa =
    template.mappatura.find((m) => m.campoProgetto === 'commessa')?.tagAttributoDXF ?? 'COMMESSA';
  const tagCliente =
    template.mappatura.find((m) => m.campoProgetto === 'cliente')?.tagAttributoDXF ?? 'CLIENTE';

  entities.push(
    dxfText('CARTIGLIO', cartX + 2.5, notaY + 13.5, 2.0, getValMappato('titoloTavola').slice(0, 38), 7, 'left'),
    dxfText('CARTIGLIO', cartX + 2.5, notaY + 10.0, 1.6, `${tagCliente}: ${getValMappato('cliente').slice(0, 34)}`, 8, 'left'),
    dxfText('CARTIGLIO', cartX + 2.5, notaY + 5.3, 1.6, `Progettista: ${getValMappato('progettista').slice(0, 34)}`, 8, 'left'),
    dxfText('CARTIGLIO', cartX + 2.5, notaY + 1.8, 1.5, `${tagCommessa}: ${getValMappato('commessa')} | Data: ${getValMappato('data')}`, 8, 'left'),
    dxfText('CARTIGLIO', cartX + 97, notaY + 13.5, 1.8, `Rev: ${getValMappato('revisione')}`, 7, 'left'),
    dxfText('CARTIGLIO', cartX + 97, notaY + 10.0, 1.7, `Tavola: ${getValMappato('numeroTavola')}`, 7, 'left'),
    dxfText('CARTIGLIO', cartX + 97, notaY + 5.3, 1.5, `App ${calcolo.versioneApp}`, 8, 'left'),
    dxfText('CARTIGLIO', cartX + 97, notaY + 1.8, 1.5, `Regole ${calcolo.versioneRegole}`, 8, 'left')
  );

  return notaY + notaH;
}

// Intestazione superiore condivisa per Elenco Cavi, Fronte Quadro e Morsettiera (stile allegato ELENCO DEI CAVI)
function renderDocumentTopHeader(
  entities: string[],
  geom: SheetGeom,
  progetto: ProgettoAntincendio,
  titoloDocumento: string,
  iconaDestraBlock: string
): number {
  const hdrTop = geom.innerT - 1;
  const hdrH = 22;
  const hdrBot = hdrTop - hdrH;

  // Box 1: Studio / Logo (width 36mm)
  const logoW = 36;
  const x1 = geom.innerX;
  entities.push(dxfRect('TABELLE', x1, hdrBot, logoW, hdrH, 7));
  entities.push(dxfText('TESTI', x1 + logoW / 2, hdrTop - 3.2, 1.7, progetto.identificativi.logoTestoStudio.slice(0, 18), 7, 'center'));
  entities.push(dxfInsert('TESTI', 'SYM_LOGO_STUDIO', x1 + logoW / 2, hdrBot + 9, 1));

  // Box 2: Dati della Fornitura (width 84mm)
  const fornW = 84;
  const x2 = x1 + logoW;
  entities.push(dxfRect('TABELLE', x2, hdrBot, fornW, hdrH, 7));
  entities.push(dxfLine('TABELLE', x2, hdrTop - 5.5, x2 + 64, hdrTop - 5.5, 7));
  entities.push(dxfLine('TABELLE', x2, hdrTop - 11.0, x2 + fornW, hdrTop - 11.0, 7));
  entities.push(dxfLine('TABELLE', x2 + 21, hdrBot, x2 + 21, hdrTop - 5.5, 8));
  entities.push(dxfLine('TABELLE', x2 + 39, hdrBot, x2 + 39, hdrTop - 5.5, 8));
  entities.push(dxfLine('TABELLE', x2 + 64, hdrBot, x2 + 64, hdrTop, 7));

  entities.push(dxfText('TESTI', x2 + 32, hdrTop - 2.8, 1.75, 'DATI DELLA FORNITURA', 7, 'center'));
  entities.push(dxfText('TESTI', x2 + 10.5, hdrTop - 8.2, 1.5, 'Sistema/UT', 7, 'center'));
  entities.push(dxfText('TESTI', x2 + 30.0, hdrTop - 8.2, 1.5, 'Fasi', 7, 'center'));
  entities.push(dxfText('TESTI', x2 + 51.5, hdrTop - 8.2, 1.5, 'Tensione [V]', 7, 'center'));
  entities.push(
    dxfText(
      'TESTI',
      x2 + 74.0,
      hdrTop - 5.5,
      1.5,
      progetto.fornitura.sistemaDistribuzione === 'TT' ? 'Rterra [ohm]' : 'Zs [ohm]',
      7,
      'center'
    )
  );

  entities.push(
    dxfText('TESTI', x2 + 10.5, hdrBot + 6.5, 1.8, progetto.fornitura.sistemaDistribuzione, 7, 'center'),
    dxfText('TESTI', x2 + 10.5, hdrBot + 2.8, 1.6, `${progetto.fornitura.frequenzaHz} Hz`, 7, 'center'),
    dxfText(
      'TESTI',
      x2 + 30.0,
      hdrBot + 5.2,
      1.8,
      progetto.fornitura.tipoFornitura === 'trifase' ? '3F+N' : 'F+N',
      7,
      'center'
    ),
    dxfText('TESTI', x2 + 51.5, hdrBot + 5.2, 1.8, String(progetto.fornitura.tensioneNominaleV), 7, 'center'),
    dxfText(
      'TESTI',
      x2 + 74.0,
      hdrBot + 5.2,
      1.8,
      progetto.fornitura.sistemaDistribuzione === 'TT'
        ? String(progetto.fornitura.resistenzaTerraReOhm ?? 'N.D.')
        : String(progetto.fornitura.impedenzaAnelloGuastoOhm ?? 'N.D.'),
      7,
      'center'
    )
  );

  // Box 3: Titolo Elaborato centrato
  const iconBoxW = 44;
  const x3 = x2 + fornW + 2;
  const titleW = geom.innerR - iconBoxW - 2 - x3;
  entities.push(dxfRect('TABELLE', x3, hdrBot + 1, titleW, hdrH - 2, 7));
  entities.push(dxfText('TESTI', x3 + titleW / 2, hdrBot + hdrH / 2, 5.0, titoloDocumento, 7, 'center'));

  // Box 4: Icona tecnica in alto a destra
  const x4 = geom.innerR - iconBoxW;
  entities.push(dxfInsert('TESTI', iconaDestraBlock, x4 + iconBoxW / 2, hdrBot + hdrH / 2, 1));

  return hdrBot - 1;
}

function getCommonLayers(): Array<{ name: string; color: number }> {
  return [
    { name: '0', color: 7 },
    { name: 'QUADRI', color: 7 },
    { name: 'BARRE', color: 5 },
    { name: 'PROTEZIONI', color: 3 },
    { name: 'LINEE', color: 7 },
    { name: 'SIMBOLI_DM83', color: 1 },
    { name: 'SIMBOLI_ISO7010', color: 1 },
    { name: 'TABELLE', color: 8 },
    { name: 'CARTIGLIO', color: 7 },
    { name: 'TESTI', color: 7 },
    { name: 'ANNOTAZIONI', color: 4 },
  ];
}

function getCommonBlocksSection(): string {
  return [
    // 1. Sezionatore (es. QS0)
    '0', 'BLOCK', '8', 'PROTEZIONI', '2', 'SYM_SEZ', '70', '0', '10', '0', '20', '0', '30', '0',
    dxfLine('PROTEZIONI', 0, 14, 0, 5, 7),
    dxfLine('PROTEZIONI', -1.8, 5, 1.8, 5, 7),
    dxfLine('PROTEZIONI', 0, -5, -3.4, 4.4, 7),
    dxfLine('PROTEZIONI', 0, -5, 0, -14, 7),
    '0', 'ENDBLK',

    // 2. Sezionatore con Fusibile (es. QS1)
    '0', 'BLOCK', '8', 'PROTEZIONI', '2', 'SYM_FUS', '70', '0', '10', '0', '20', '0', '30', '0',
    dxfLine('PROTEZIONI', 0, 14, 0, 5, 7),
    dxfLine('PROTEZIONI', -1.6, 5, 1.6, 5, 7),
    dxfLine('PROTEZIONI', 0, -5, -3.6, 4.5, 7),
    dxfLine('PROTEZIONI', -4.2, 2.5, -1.8, 3.6, 7),
    dxfLine('PROTEZIONI', -2.6, -2.5, -0.2, -1.4, 7),
    dxfLine('PROTEZIONI', -4.2, 2.5, -2.6, -2.5, 7),
    dxfLine('PROTEZIONI', -1.8, 3.6, -0.2, -1.4, 7),
    dxfLine('PROTEZIONI', 0, -5, 0, -14, 7),
    '0', 'ENDBLK',

    // 3. Interruttore Magnetotermico
    '0', 'BLOCK', '8', 'PROTEZIONI', '2', 'SYM_MT', '70', '0', '10', '0', '20', '0', '30', '0',
    dxfLine('PROTEZIONI', 0, 14, 0, 8.5, 7),
    dxfLine('PROTEZIONI', -1.3, 7.2, 1.3, 9.8, 7),
    dxfLine('PROTEZIONI', -1.3, 9.8, 1.3, 7.2, 7),
    dxfLine('PROTEZIONI', 0, 2.0, -3.2, 8.2, 7),
    dxfLine('PROTEZIONI', -1.6, 5.1, -3.8, 5.1, 7, 'DASHED'),
    dxfRect('PROTEZIONI', -3.8, -6.5, 7.6, 8.5, 3),
    dxfLine('PROTEZIONI', 0, 2.0, 0, -6.5, 7),
    dxfLine('PROTEZIONI', -3.8, -0.8, -1.8, -0.8, 3),
    dxfLine('PROTEZIONI', -1.8, -0.8, -1.8, 1.0, 3),
    dxfLine('PROTEZIONI', -1.8, 1.0, 0.0, 1.0, 3),
    dxfArc('PROTEZIONI', 0.0, -4.0, 2.1, -90, 90, 3),
    dxfLine('PROTEZIONI', 0, -6.5, 0, -14, 7),
    '0', 'ENDBLK',

    // 4. Interruttore Magnetotermico Differenziale (Id)
    '0', 'BLOCK', '8', 'PROTEZIONI', '2', 'SYM_MTD', '70', '0', '10', '0', '20', '0', '30', '0',
    dxfLine('PROTEZIONI', 0, 14, 0, 9.5, 7),
    dxfLine('PROTEZIONI', -1.2, 8.3, 1.2, 10.7, 7),
    dxfLine('PROTEZIONI', -1.2, 10.7, 1.2, 8.3, 7),
    dxfLine('PROTEZIONI', 0, 3.5, -3.0, 9.2, 7),
    dxfRect('PROTEZIONI', -3.8, -4.5, 7.6, 8.0, 3),
    dxfLine('PROTEZIONI', 0, 3.5, 0, -4.5, 7),
    dxfLine('PROTEZIONI', -3.8, 0.5, -1.8, 0.5, 3),
    dxfLine('PROTEZIONI', -1.8, 0.5, -1.8, 2.3, 3),
    dxfLine('PROTEZIONI', -1.8, 2.3, 0.0, 2.3, 3),
    dxfArc('PROTEZIONI', 0.0, -2.0, 2.0, -90, 90, 3),
    dxfRect('PROTEZIONI', -3.8, -10.5, 7.6, 5.2, 5),
    dxfText('PROTEZIONI', 0.0, -8.0, 2.2, 'Id', 5, 'center'),
    dxfLine('PROTEZIONI', 0, -10.5, 0, -14, 7),
    '0', 'ENDBLK',

    // 5. Morsetto CBD + freccia triangolare
    '0', 'BLOCK', '8', 'LINEE', '2', 'SYM_MORSETTO', '70', '0', '10', '0', '20', '0', '30', '0',
    dxfLine('LINEE', 0, 4.0, 0, 0.9, 7),
    dxfCircle('LINEE', 0, 0, 0.9, 7),
    dxfLine('LINEE', 0, -0.9, 0, -3.2, 7),
    dxfLine('LINEE', -1.8, -3.2, 1.8, -3.2, 7),
    dxfLine('LINEE', 1.8, -3.2, 0, -6.2, 7),
    dxfLine('LINEE', 0, -6.2, -1.8, -3.2, 7),
    '0', 'ENDBLK',

    // 6. Simbolo messa a terra barra PE
    '0', 'BLOCK', '8', 'LINEE', '2', 'SYM_TERRA', '70', '0', '10', '0', '20', '0', '30', '0',
    dxfCircle('LINEE', 0, 0, 2.4, 7),
    dxfLine('LINEE', 0, 1.6, 0, 0.3, 7),
    dxfLine('LINEE', -1.6, 0.3, 1.6, 0.3, 7),
    dxfLine('LINEE', -1.1, -0.5, 1.1, -0.5, 7),
    dxfLine('LINEE', -0.5, -1.3, 0.5, -1.3, 7),
    '0', 'ENDBLK',

    // 7. Spia presenza tensione
    '0', 'BLOCK', '8', 'PROTEZIONI', '2', 'SYM_SPIA', '70', '0', '10', '0', '20', '0', '30', '0',
    dxfCircle('PROTEZIONI', 0, 0, 2.8, 7),
    dxfLine('PROTEZIONI', -2.0, -2.0, 2.0, 2.0, 7),
    dxfLine('PROTEZIONI', -2.0, 2.0, 2.0, -2.0, 7),
    '0', 'ENDBLK',

    // 8. Simboli Antincendio D.M. 30/11/1983 & ISO 7010 & UPS
    '0', 'BLOCK', '8', 'SIMBOLI_DM83', '2', 'SYM_DM83_CENTRALE', '70', '0', '10', '0', '20', '0', '30', '0',
    dxfRect('SIMBOLI_DM83', -6.5, -2.8, 13, 5.6, 1),
    dxfText('SIMBOLI_DM83', 0, 0, 2.1, 'IRAI', 1, 'center'),
    '0', 'ENDBLK',

    '0', 'BLOCK', '8', 'SIMBOLI_DM83', '2', 'SYM_DM83_RIVELATORE', '70', '0', '10', '0', '20', '0', '30', '0',
    dxfCircle('SIMBOLI_DM83', 0, 0, 2.8, 1),
    dxfCircle('SIMBOLI_DM83', 0, 0, 0.9, 1),
    '0', 'ENDBLK',

    '0', 'BLOCK', '8', 'SIMBOLI_ISO7010', '2', 'SYM_EVAC', '70', '0', '10', '0', '20', '0', '30', '0',
    dxfRect('SIMBOLI_ISO7010', -6.5, -2.8, 13, 5.6, 1),
    dxfText('SIMBOLI_ISO7010', 0, 0, 2.1, 'EVAC', 1, 'center'),
    '0', 'ENDBLK',

    '0', 'BLOCK', '8', 'PROTEZIONI', '2', 'SYM_UPS', '70', '0', '10', '0', '20', '0', '30', '0',
    dxfRect('PROTEZIONI', -6.5, -2.8, 13, 5.6, 5),
    dxfLine('PROTEZIONI', -6.5, -2.8, 6.5, 2.8, 5),
    dxfText('PROTEZIONI', 0, 0, 2.0, 'UPS', 5, 'center'),
    '0', 'ENDBLK',

    // 9. Logo Studio (squadra + compasso schematico stile intestazione CAD)
    '0', 'BLOCK', '8', 'TESTI', '2', 'SYM_LOGO_STUDIO', '70', '0', '10', '0', '20', '0', '30', '0',
    dxfRect('TESTI', -7, -6, 14, 12, 7),
    dxfLine('TESTI', -5, -4, 5, -4, 7),
    dxfLine('TESTI', -5, -4, -5, 4, 7),
    dxfLine('TESTI', -5, 4, 5, -4, 7),
    dxfCircle('TESTI', 2, 1.5, 2.2, 5),
    '0', 'ENDBLK',

    // 10. Simboli Posa Cavi (Elenco Cavi)
    '0', 'BLOCK', '8', 'LINEE', '2', 'SYM_POSA_INCASSATO', '70', '0', '10', '0', '20', '0', '30', '0',
    dxfRect('LINEE', -9, -7, 18, 14, 8),
    dxfLine('LINEE', -9, -3, -5, -7, 8),
    dxfLine('LINEE', -9, 1, -1, -7, 8),
    dxfLine('LINEE', -9, 5, 3, -7, 8),
    dxfLine('LINEE', -6, 7, 7, -6, 8),
    dxfLine('LINEE', -2, 7, 9, -4, 8),
    dxfLine('LINEE', 2, 7, 9, 0, 8),
    dxfLine('LINEE', 6, 7, 9, 4, 8),
    dxfCircle('LINEE', 0, 0, 4.5, 7),
    dxfCircle('LINEE', -1.5, -1.2, 1.0, 5),
    dxfCircle('LINEE', 1.5, -1.2, 1.0, 5),
    dxfCircle('LINEE', 0, 1.3, 1.0, 5),
    '0', 'ENDBLK',

    '0', 'BLOCK', '8', 'LINEE', '2', 'SYM_POSA_VISTA', '70', '0', '10', '0', '20', '0', '30', '0',
    dxfLine('LINEE', -9, -5, 9, -5, 7),
    dxfLine('LINEE', -7, -5, -9, -7, 8),
    dxfLine('LINEE', -3, -5, -5, -7, 8),
    dxfLine('LINEE', 1, -5, -1, -7, 8),
    dxfLine('LINEE', 5, -5, 3, -7, 8),
    dxfCircle('LINEE', 0, 0, 4.4, 7),
    dxfCircle('LINEE', -1.4, -1.0, 0.9, 5),
    dxfCircle('LINEE', 1.4, -1.0, 0.9, 5),
    dxfCircle('LINEE', 0, 1.4, 0.9, 5),
    '0', 'ENDBLK',

    '0', 'BLOCK', '8', 'LINEE', '2', 'SYM_POSA_PASSERELLA', '70', '0', '10', '0', '20', '0', '30', '0',
    dxfLine('LINEE', -8, 2, -8, -4, 7),
    dxfLine('LINEE', -8, -4, 8, -4, 7),
    dxfLine('LINEE', 8, -4, 8, 2, 7),
    dxfLine('LINEE', -6, -4, -6, -6, 8),
    dxfLine('LINEE', 6, -4, 6, -6, 8),
    dxfCircle('LINEE', -4.2, -1.5, 1.5, 5),
    dxfCircle('LINEE', 0, -1.5, 1.5, 5),
    dxfCircle('LINEE', 4.2, -1.5, 1.5, 5),
    '0', 'ENDBLK',

    '0', 'BLOCK', '8', 'LINEE', '2', 'SYM_POSA_INTERRATO', '70', '0', '10', '0', '20', '0', '30', '0',
    dxfLine('LINEE', -9, 5, 9, 5, 8),
    dxfLine('LINEE', -5, 5, -5, -5, 8),
    dxfLine('LINEE', -5, -5, 5, -5, 8),
    dxfLine('LINEE', 5, -5, 5, 5, 8),
    dxfCircle('LINEE', 0, -1.2, 2.8, 7),
    dxfCircle('LINEE', -1.0, -1.2, 0.7, 5),
    dxfCircle('LINEE', 1.0, -1.2, 0.7, 5),
    '0', 'ENDBLK',

    '0', 'BLOCK', '8', 'LINEE', '2', 'SYM_POSA_ARIA', '70', '0', '10', '0', '20', '0', '30', '0',
    dxfLine('LINEE', -8, -4, -8, 5, 7),
    dxfLine('LINEE', -8, 0, 6, 0, 7),
    dxfCircle('LINEE', 1, 2.0, 1.6, 5),
    dxfCircle('LINEE', 4.5, 2.0, 1.6, 5),
    '0', 'ENDBLK',

    // 11. Icone intestazione destra (Elenco cavi, Fronte quadro, Morsettiera)
    '0', 'BLOCK', '8', 'TESTI', '2', 'SYM_HDR_CAVI', '70', '0', '10', '0', '20', '0', '30', '0',
    dxfRect('TESTI', -16, -8, 32, 16, 8),
    dxfCircle('LINEE', -8, 2, 4.5, 7),
    dxfCircle('LINEE', -8, 2, 1.4, 5),
    dxfLine('LINEE', 0, -4, 13, -4, 7),
    dxfCircle('LINEE', 3, -2, 1.5, 5),
    dxfCircle('LINEE', 7, -2, 1.5, 5),
    dxfCircle('LINEE', 11, -2, 1.5, 5),
    '0', 'ENDBLK',

    '0', 'BLOCK', '8', 'QUADRI', '2', 'SYM_HDR_QUADRO', '70', '0', '10', '0', '20', '0', '30', '0',
    dxfRect('QUADRI', -12, -8, 24, 16, 7),
    dxfLine('QUADRI', -9, 3, 9, 3, 8),
    dxfLine('QUADRI', -9, -3, 9, -3, 8),
    dxfRect('PROTEZIONI', -7, 0.5, 4, 5, 3),
    dxfRect('PROTEZIONI', -2, 0.5, 4, 5, 3),
    dxfRect('PROTEZIONI', 3, 0.5, 4, 5, 3),
    dxfRect('PROTEZIONI', -7, -5.5, 5, 5, 5),
    '0', 'ENDBLK',

    '0', 'BLOCK', '8', 'LINEE', '2', 'SYM_HDR_MORSETTI', '70', '0', '10', '0', '20', '0', '30', '0',
    dxfRect('LINEE', -12, -5, 24, 10, 7),
    dxfLine('LINEE', -4, -5, -4, 5, 8),
    dxfLine('LINEE', 4, -5, 4, 5, 8),
    dxfCircle('LINEE', -8, 0, 1.6, 5),
    dxfCircle('LINEE', 0, 0, 1.6, 5),
    dxfCircle('LINEE', 8, 0, 1.6, 3),
    '0', 'ENDBLK',
  ].join('\n');
}

function finalizeDxfString(
  numTavole: number,
  sheetW: number,
  sheetH: number,
  entities: string[]
): string {
  const layers = getCommonLayers();
  const layerTable = [
    '0', 'TABLE', '2', 'LAYER', '70', String(layers.length),
    ...layers.flatMap((l) => [
      '0', 'LAYER',
      '2', l.name,
      '70', '0',
      '62', String(l.color),
      '6', 'CONTINUOUS',
    ]),
    '0', 'ENDTAB',
  ].join('\n');

  return [
    '0', 'SECTION', '2', 'HEADER',
    '9', '$ACADVER', '1', 'AC1015',
    '9', '$INSUNITS', '70', '4',
    '9', '$LTSCALE', '40', '1.0',
    '9', '$EXTMIN', '10', '0.0', '20', '0.0', '30', '0.0',
    '9', '$EXTMAX', '10', String(numTavole * (sheetW + 30)), '20', String(sheetH), '30', '0.0',
    '0', 'ENDSEC',

    '0', 'SECTION', '2', 'TABLES',
    '0', 'TABLE', '2', 'LTYPE', '70', '2',
    '0', 'LTYPE', '2', 'CONTINUOUS', '70', '0', '3', 'Solid line', '72', '65', '73', '0', '40', '0.0',
    '0', 'LTYPE', '2', 'DASHED', '70', '0', '3', 'Dashed __ __ __', '72', '65', '73', '2', '40', '4.0', '49', '2.5', '49', '-1.5',
    '0', 'ENDTAB',
    layerTable,
    '0', 'TABLE', '2', 'STYLE', '70', '1',
    '0', 'STYLE', '2', 'STANDARD', '70', '0', '40', '0.0', '41', '1.0', '50', '0.0', '71', '0', '42', '2.5', '3', 'txt', '4', '',
    '0', 'ENDTAB',
    '0', 'ENDSEC',

    '0', 'SECTION', '2', 'BLOCKS',
    getCommonBlocksSection(),
    '0', 'ENDSEC',

    '0', 'SECTION', '2', 'ENTITIES',
    entities.join('\n'),
    '0', 'ENDSEC',
    '0', 'EOF',
  ].join('\n');
}

// ============================================================================
// 1. SCHEMA UNIFILARE DXF
// ============================================================================
export function generaDxfSchema(
  progetto: ProgettoAntincendio,
  calcolo: RisultatoCalcoloCompleto,
  template: TemplateTavolaDXF
): string {
  const sheetW =
    template.orientamento === 'orizzontale' ? Math.max(template.larghezzaMm, 420) : 297;
  const sheetH =
    template.orientamento === 'orizzontale' ? Math.max(template.altezzaMm, 297) : 420;
  const quadro = progetto.quadri[0];
  const sorgente =
    progetto.sorgenti.find((s) => s.id === quadro?.sorgenteId) ?? progetto.sorgenti[0];
  const linee = progetto.linee;
  const numTavole = Math.max(1, Math.ceil(linee.length / LINEE_PER_TAVOLA));

  const entities: string[] = [];

  for (let sheetIdx = 0; sheetIdx < numTavole; sheetIdx++) {
    const ox = sheetIdx * (sheetW + 30);
    const oy = 0;

    const geom = renderDxfTemplateFrame(entities, ox, oy, sheetW, sheetH);
    const tableBottomY = renderNotaCartiglioFooter(
      entities,
      geom,
      progetto,
      calcolo,
      template,
      sheetIdx,
      numTavole
    ) + 1;

    const rowH = 4.0;
    const numTableRows = 25;
    const tableTopY = tableBottomY + numTableRows * rowH; // 132
    const peBarY = tableTopY + 17; // 149
    const busY = geom.innerT - 11; // 273

    const leftPanelX = geom.innerX;
    const leftPanelW = 88;
    const colAreaX = leftPanelX + leftPanelW + 2;
    const colAreaW = geom.innerR - colAreaX;

    const slice = linee.slice(sheetIdx * LINEE_PER_TAVOLA, (sheetIdx + 1) * LINEE_PER_TAVOLA);
    const totalCols = Math.max(7, slice.length + 1);
    const colW = colAreaW / totalCols;
    const colCenter = (cIdx: number) => colAreaX + cIdx * colW + colW / 2;

    // Tabella Top-Left "Da Quadro"
    const daQuadroRowH = 4.1;
    const daQuadroRows: Array<[string, string]> = [
      ['Da Quadro:', sorgente?.sigla ?? 'AL-PREF'],
      ['Partenza:', sorgente?.derivataAMonteInterruttoreGenerale ? 'A monte I.G.' : 'Quadro Gen.'],
      ['Cavo [mm2]:', quadro?.tipoFornitura === 'trifase' ? '1(4x10)+(1PE10)' : '1(2x6)+(1PE6)'],
      ['Lunghezza [m]:', '15'],
      ['Tensione [V]:', String(progetto.fornitura.tensioneNominaleV)],
      ['Frequenza [Hz]:', String(progetto.fornitura.frequenzaHz)],
      [
        'Polarita:',
        progetto.fornitura.tipoFornitura === 'trifase' ? 'Trifase 3F+N+PE' : 'Monofase L1+N',
      ],
      ['Tipo morsetto:', 'CBD.10'],
      ['Numerazione morsetto:', '1.2.T'],
    ];
    const daQuadroTop = geom.innerT - 2;
    const daQuadroBottom = daQuadroTop - daQuadroRows.length * daQuadroRowH;
    entities.push(dxfRect('TABELLE', leftPanelX, daQuadroBottom, leftPanelW, daQuadroRows.length * daQuadroRowH, 7));
    daQuadroRows.forEach(([lbl, val], idx) => {
      const yBot = daQuadroTop - (idx + 1) * daQuadroRowH;
      if (idx < daQuadroRows.length - 1) {
        entities.push(dxfLine('TABELLE', leftPanelX, yBot, leftPanelX + leftPanelW, yBot, 8));
      }
      entities.push(dxfText('TESTI', leftPanelX + 1.5, yBot + 1.3, 1.7, lbl, 7, 'left'));
      entities.push(dxfText('TESTI', leftPanelX + leftPanelW - 1.5, yBot + 2.1, 1.7, val, 7, 'right'));
    });

    const arrowY = daQuadroTop - daQuadroRowH / 2;
    entities.push(dxfLine('LINEE', leftPanelX + leftPanelW, arrowY + 2, leftPanelX + leftPanelW + 3, arrowY + 2, 7));
    entities.push(dxfLine('LINEE', leftPanelX + leftPanelW + 3, arrowY + 2, leftPanelX + leftPanelW + 5.5, arrowY, 7));
    entities.push(dxfLine('LINEE', leftPanelX + leftPanelW + 5.5, arrowY, leftPanelX + leftPanelW + 3, arrowY - 2, 7));
    entities.push(dxfLine('LINEE', leftPanelX + leftPanelW + 3, arrowY - 2, leftPanelX + leftPanelW, arrowY - 2, 7));

    // Tabella Middle-Left "Prefisso quadro"
    const infoQuadroRowH = 4.1;
    const infoQuadroBottom = peBarY + 3.5;
    const infoQuadroRows: Array<[string, string]> = [
      ['Prefisso quadro:', quadro?.sigla ?? 'Q.ANT-01'],
      [
        'Alimentazione:',
        quadro?.tipoFornitura === 'trifase' ? 'Trifase 3F+N' : 'Monofase L1+N',
      ],
      [
        'Ik Max [kA]:',
        String(quadro?.iccQuadroKa ?? progetto.fornitura.iccPuntoConsegnaKa ?? 'N.D.'),
      ],
      ['Tensione nominale di impiego [V]:', String(quadro?.tensioneV ?? progetto.fornitura.tensioneNominaleV)],
      ['Tensione di isolamento nominale [V]:', '500'],
      ['Frequenza [Hz]:', String(progetto.fornitura.frequenzaHz)],
      ['Corrente ammissibile 1 s [kA]:', String(quadro?.interruttoreGeneraleIcuKa ?? 10)],
      ['Grado di protezione IP:', quadro?.gradoIP ?? 'IP54'],
      ['Codice:', quadro?.formaSegregazione ?? 'Forma 2b'],
    ];
    const infoQuadroTop = infoQuadroBottom + infoQuadroRows.length * infoQuadroRowH;
    entities.push(dxfRect('TABELLE', leftPanelX, infoQuadroBottom, leftPanelW, infoQuadroRows.length * infoQuadroRowH, 7));
    infoQuadroRows.forEach(([lbl, val], idx) => {
      const yBot = infoQuadroTop - (idx + 1) * infoQuadroRowH;
      if (idx < infoQuadroRows.length - 1) {
        entities.push(dxfLine('TABELLE', leftPanelX, yBot, leftPanelX + leftPanelW, yBot, 8));
      }
      entities.push(dxfText('TESTI', leftPanelX + 1.5, yBot + 1.3, 1.65, lbl, 7, 'left'));
      entities.push(dxfText('TESTI', leftPanelX + leftPanelW - 1.5, yBot + 2.1, 1.65, val, 7, 'right'));
    });

    // Intestazione Barratura & Sbarra Principale
    const iccTxt = quadro?.iccQuadroKa ?? progetto.fornitura.iccPuntoConsegnaKa ?? 10;
    entities.push(
      dxfText(
        'BARRE',
        colAreaX + colAreaW * 0.42,
        busY + 4.2,
        2.6,
        `Dati barratura: ${progetto.fornitura.tensioneNominaleV}V - ${progetto.fornitura.frequenzaHz}Hz - Icc = ${iccTxt} kA`,
        7,
        'center'
      )
    );

    const col0X = colCenter(0);
    entities.push(dxfLine('BARRE', leftPanelX + leftPanelW + 5.5, arrowY, col0X, arrowY, 7));
    entities.push(dxfLine('BARRE', col0X, arrowY, col0X, busY, 7));
    entities.push(dxfLine('BARRE', col0X, busY, geom.innerR - 6, busY, 5));
    entities.push(dxfLine('BARRE', col0X, busY - 0.5, geom.innerR - 6, busY - 0.5, 5));

    entities.push(dxfLine('BARRE', geom.innerR - 6, busY + 1.6, geom.innerR - 1.5, busY, 5));
    entities.push(dxfLine('BARRE', geom.innerR - 1.5, busY, geom.innerR - 6, busY - 1.6, 5));
    entities.push(dxfLine('BARRE', geom.innerR - 6, busY - 1.6, geom.innerR - 6, busY + 1.6, 5));
    if (sheetIdx + 1 < numTavole) {
      entities.push(dxfText('TESTI', geom.innerR - 18, busY + 3.0, 1.9, `AL FG ${sheetIdx + 2}`, 7, 'left'));
    }

    entities.push(dxfLine('LINEE', col0X - 18, peBarY, geom.innerR - 6, peBarY, 7, 'DASHED'));
    entities.push(dxfInsert('LINEE', 'SYM_TERRA', col0X - 20.5, peBarY, 1));

    // Colonna 0: Generale QS0
    const symY = (busY + peBarY) / 2 + 12;
    const protTopY = symY + 14;
    const protBotY = symY - 14;
    entities.push(dxfCircle('BARRE', col0X, busY, 0.9, 5));
    entities.push(dxfLine('LINEE', col0X, busY, col0X, protTopY, 7));
    entities.push(dxfInsert('PROTEZIONI', 'SYM_SEZ', col0X, symY, 1));
    entities.push(dxfText('TESTI', col0X + 2.5, symY + 0.5, 1.8, 'QS0', 7, 'left'));
    entities.push(
      dxfText(
        'TESTI',
        col0X + 1.5,
        busY - 16,
        1.5,
        quadro?.tipoFornitura === 'trifase' ? '3FN.Q.0' : 'L1N.Q.0',
        7,
        'left'
      )
    );
    entities.push(dxfLine('LINEE', col0X, protBotY, col0X, peBarY + 2, 7));
    entities.push(dxfLine('LINEE', col0X - 2, peBarY + 12, col0X + 2, peBarY + 15, 7));

    // Colonne Linee in Partenza
    const resQuadro = quadro ? calcolo.quadri[quadro.id] : undefined;

    slice.forEach((linea, idx) => {
      const colIdx = idx + 1;
      const ov = progetto.layoutOverrides[linea.id] ?? { dx: 0, dy: 0 };
      const baseX = colCenter(colIdx);
      const cx = baseX + Math.max(-6, Math.min(6, ov.dx * 0.1));
      const res = calcolo.linee[linea.id];

      entities.push(dxfCircle('BARRE', cx, busY, 0.9, 5));
      entities.push(dxfLine('LINEE', cx, busY, cx, protTopY, 7));
      entities.push(
        dxfText(
          'TESTI',
          cx + 1.5,
          busY - 16,
          1.5,
          `${linea.tipoFornitura === 'trifase' ? '3FN' : 'L1N'}.${quadro?.sigla ?? 'Q'}.0`,
          7,
          'left'
        )
      );

      const blockProt =
        linea.tipoProtezione === 'magnetotermico_differenziale'
          ? 'SYM_MTD'
          : linea.tipoProtezione === 'magnetotermico'
          ? 'SYM_MT'
          : linea.tipoProtezione === 'fusibile'
          ? 'SYM_FUS'
          : 'SYM_SEZ';
      entities.push(dxfInsert('PROTEZIONI', blockProt, cx, symY, 1));
      entities.push(dxfText('TESTI', cx + 4.8, symY + 4.5, 1.8, `Q${colIdx}`, 7, 'left'));

      entities.push(dxfLine('LINEE', cx, protBotY, cx, peBarY + 4, 7));
      entities.push(dxfLine('LINEE', cx - 2.0, peBarY + 13, cx + 2.0, peBarY + 16, 7));
      entities.push(dxfLine('LINEE', cx - 2.0, peBarY + 11.5, cx + 2.0, peBarY + 14.5, 7));
      entities.push(
        dxfText(
          'TESTI',
          cx + 1.5,
          peBarY + 5.5,
          1.45,
          `${linea.tipoFornitura === 'trifase' ? '3FN' : 'L1N'}.${linea.sigla}`,
          7,
          'left'
        )
      );

      const termY = peBarY - 3.5;
      entities.push(dxfLine('LINEE', cx, peBarY + 4, cx, termY + 4, 7));
      entities.push(dxfInsert('LINEE', 'SYM_MORSETTO', cx, termY, 1));
      entities.push(
        dxfText(
          'TESTI',
          cx + 2.2,
          termY - 0.5,
          1.45,
          res && res.sezioneSceltaMm2 >= 6 ? 'CBD.6' : 'CBD.4',
          7,
          'left'
        )
      );
      entities.push(
        dxfText('TESTI', cx, termY - 8.2, 1.45, `${colIdx * 2 - 1}.${colIdx * 2}.T`, 7, 'center')
      );
      entities.push(dxfText('TESTI', cx, termY - 11.5, 1.55, `Utenza ${linea.sigla}`, 7, 'center'));

      const fireSym =
        linea.tipoUtenza === 'centrale_irai' || linea.tipoUtenza === 'alimentatore_irai'
          ? 'SYM_DM83_CENTRALE'
          : linea.tipoUtenza === 'centrale_evac' || linea.tipoUtenza === 'amplificatore_evac'
          ? 'SYM_EVAC'
          : linea.tipoUtenza === 'ups_sicurezza'
          ? 'SYM_UPS'
          : 'SYM_DM83_RIVELATORE';
      entities.push(dxfInsert('SIMBOLI_DM83', fireSym, cx - 10.5, peBarY + 24, 0.85));
    });

    // Tabella inferiore 25 righe
    entities.push(dxfRect('TABELLE', leftPanelX, tableBottomY, geom.innerW, numTableRows * rowH, 7));
    const grpSplitX = leftPanelX + 31;
    entities.push(dxfLine('TABELLE', leftPanelX + leftPanelW, tableBottomY, leftPanelX + leftPanelW, tableTopY, 7));
    for (let c = 1; c < totalCols; c++) {
      const vx = colAreaX + c * colW;
      entities.push(dxfLine('TABELLE', vx, tableBottomY, vx, tableTopY, 8));
    }

    interface RowDef {
      mainLabel: string;
      subLabel?: string;
      unit?: string;
      group?: 'PROTEZIONE' | 'LINEA';
    }

    const rowDefs: RowDef[] = [
      { mainLabel: 'Sigla utenza' },
      { mainLabel: 'Descrizione' },
      { mainLabel: 'POTENZA CONTEMPORANEA', unit: '[kW]' },
      { mainLabel: 'CORRENTE (Ib)', unit: '[A]' },
      { mainLabel: 'CosFi' },
      { mainLabel: "COEFF. DI CONTEMPORANEITA'", unit: '[%]' },
      { mainLabel: 'SCHEMA FUNZIONALE' },
      { mainLabel: 'PROTEZIONE', subLabel: 'MARCA', group: 'PROTEZIONE' },
      { mainLabel: '', subLabel: 'MODELLO', group: 'PROTEZIONE' },
      { mainLabel: '', subLabel: 'ESECUZIONE', group: 'PROTEZIONE' },
      { mainLabel: '', subLabel: 'TIPOLOGIA', group: 'PROTEZIONE' },
      { mainLabel: '', subLabel: 'In max/min/Reg.', unit: '[A]', group: 'PROTEZIONE' },
      { mainLabel: '', subLabel: 'Im max/min/Reg.', unit: '[A]', group: 'PROTEZIONE' },
      { mainLabel: '', subLabel: 'P.d.I. / Curva', unit: '[kA]', group: 'PROTEZIONE' },
      { mainLabel: '', subLabel: 'Id max/min/Reg./Classe', unit: '[A]', group: 'PROTEZIONE' },
      { mainLabel: 'DISTRIBUZIONE' },
      { mainLabel: 'CADUTA DI TENSIONE PERCENTUALE', unit: '[%]' },
      { mainLabel: 'VOLTMETRO / AMPEROMETRO' },
      { mainLabel: 'LINEA', subLabel: 'SIGLA', group: 'LINEA' },
      { mainLabel: '', subLabel: 'LUNGHEZZA', unit: '[m]', group: 'LINEA' },
      { mainLabel: '', subLabel: 'POSA', group: 'LINEA' },
      { mainLabel: '', subLabel: 'K CORRETTIVI (K1,K2,K3,K4)', group: 'LINEA' },
      { mainLabel: '', subLabel: 'Sezione', unit: '[mmq]', group: 'LINEA' },
      { mainLabel: '', subLabel: 'Portata (Iz)', unit: '[A]', group: 'LINEA' },
      { mainLabel: 'RESISTENZA FUOCO / CPR' },
    ];

    const protTop = tableTopY - 7 * rowH;
    const protBot = tableTopY - 15 * rowH;
    const lineaTop = tableTopY - 18 * rowH;
    const lineaBot = tableTopY - 24 * rowH;
    entities.push(dxfLine('TABELLE', grpSplitX, protBot, grpSplitX, protTop, 8));
    entities.push(dxfLine('TABELLE', grpSplitX, lineaBot, grpSplitX, lineaTop, 8));
    entities.push(dxfText('TESTI', leftPanelX + 15.5, (protTop + protBot) / 2, 2.0, 'PROTEZIONE', 7, 'center'));
    entities.push(dxfText('TESTI', leftPanelX + 15.5, (lineaTop + lineaBot) / 2, 2.0, 'LINEA', 7, 'center'));

    rowDefs.forEach((rd, rIdx) => {
      const yBot = tableTopY - (rIdx + 1) * rowH;
      const yMid = yBot + rowH / 2;

      if (rIdx < rowDefs.length - 1) {
        const lineStartX =
          rd.group && rowDefs[rIdx + 1]?.group === rd.group ? grpSplitX : leftPanelX;
        entities.push(dxfLine('TABELLE', lineStartX, yBot, geom.innerR, yBot, 8));
      }

      if (rd.group) {
        if (rd.subLabel) {
          entities.push(dxfText('TESTI', grpSplitX + 1.5, yMid, 1.55, rd.subLabel, 7, 'left'));
        }
      } else if (rd.mainLabel) {
        entities.push(dxfText('TESTI', leftPanelX + 1.5, yMid, 1.65, rd.mainLabel, 7, 'left'));
      }
      if (rd.unit) {
        entities.push(dxfText('TESTI', leftPanelX + leftPanelW - 1.5, yMid, 1.55, rd.unit, 7, 'right'));
      }
    });

    const genVals: string[] = [
      `${quadro?.sigla ?? 'Q.ANT'}.0`,
      `GENERALE ${quadro?.sigla ?? 'QUADRO'}`,
      String(resQuadro?.potenzaContemporaneaKw ?? 0),
      String(resQuadro?.correnteTotaleImpiegoA ?? 0),
      '0.90',
      '100',
      quadro?.alimentazionePreferenzialeAMonte ? 'MONTE I.G.' : 'ORDINARIA',
      'Serie Normata',
      `GEN-${quadro?.interruttoreGeneraleInA ?? 40}A`,
      'Esecuzione Fissa',
      'Sezionatore',
      `---/---/${quadro?.interruttoreGeneraleInA ?? 40}`,
      '---/---/---',
      `${quadro?.interruttoreGeneraleIcuKa ?? 16} / Selett.`,
      '---',
      quadro?.tipoFornitura === 'trifase' ? 'Trifase 3F+N' : 'Monofase L1+N',
      '---',
      '---',
      'FTG18OM16',
      '15',
      'Passerella / E',
      '1.000',
      quadro?.tipoFornitura === 'trifase' ? '1(4x10)+(1PE10)' : '1(2x6)+(1PE6)',
      '---',
      'PH120 / B2ca',
    ];
    genVals.forEach((v, rIdx) => {
      const yMid = tableTopY - (rIdx + 0.5) * rowH;
      entities.push(dxfText('TESTI', col0X, yMid, 1.45, v.slice(0, 24), 7, 'center'));
    });

    slice.forEach((linea, idx) => {
      const colX = colCenter(idx + 1);
      const res = calcolo.linee[linea.id];
      const multIm =
        linea.curvaProtezione === 'B' ? 5 : linea.curvaProtezione === 'C' ? 10 : 20;
      const inVal = res?.protezioneSceltaInA ?? linea.protezioneInManualeA ?? 16;
      const sez = res?.sezioneSceltaMm2 ?? linea.sezioneManualeMm2 ?? 2.5;
      const sezText =
        linea.tipoFornitura === 'trifase'
          ? `1(3x${sez})+(1N${sez})+(1PE${sez})`
          : `2(1x${sez})+(1PE${sez})`;

      const colVals: string[] = [
        linea.sigla,
        linea.descrizione.slice(0, 24),
        res ? (res.potenzaContemporaneaW / 1000).toFixed(3) : '0',
        res ? res.correnteImpiegoIbA.toFixed(2) : '0',
        linea.cosPhi.toFixed(2),
        String(Math.round(linea.coefficienteContemporaneitaKc * 100)),
        linea.simboloCodice,
        'Serie Normata',
        res ? res.siglaProtezioneCompleta.slice(0, 24) : 'MTD',
        'Esecuzione Fissa',
        formatTipologiaProtezione(linea.tipoProtezione),
        `---/---/${inVal}`,
        `---/---/${inVal * multIm}`,
        `${linea.protezioneIcuKa} / ${linea.curvaProtezione}`,
        linea.differenzialeIdnMa
          ? `${(linea.differenzialeIdnMa / 1000).toFixed(2)} - Cl. A`
          : '---',
        linea.tipoFornitura === 'trifase' ? 'Trifase 3F+N' : 'Monofase L1+N',
        res ? res.cadutaTensionePct.toFixed(2) : '0.00',
        '---',
        linea.resistenzaFuocoCavoScelto !== 'nessuna' ? 'FTG18OM16' : 'FG16OM16',
        String(linea.lunghezzaM),
        formatPosaBreve(
          linea.tipoPosa,
          linea.temperaturaPosaC,
          linea.circuitiRaggruppati
        ),
        res ? (res.fattoreKt * res.fattoreKg).toFixed(3) : '1.000',
        sezText,
        res ? res.portataCorrettaIzA.toFixed(1) : '0',
        `${linea.resistenzaFuocoCavoScelto} / ${linea.classeCPR.split('-')[0]}`,
      ];

      colVals.forEach((v, rIdx) => {
        const yMid = tableTopY - (rIdx + 0.5) * rowH;
        entities.push(dxfText('TESTI', colX, yMid, 1.4, v, 7, 'center'));
      });
    });
  }

  return finalizeDxfString(numTavole, sheetW, sheetH, entities);
}

// ============================================================================
// 2. ELENCO DEI CAVI DXF (conforme all'allegato ELENCO DEI CAVI)
// ============================================================================
export function generaDxfElencoCavi(
  progetto: ProgettoAntincendio,
  calcolo: RisultatoCalcoloCompleto,
  template: TemplateTavolaDXF
): string {
  const sheetW =
    template.orientamento === 'orizzontale' ? Math.max(template.larghezzaMm, 420) : 297;
  const sheetH =
    template.orientamento === 'orizzontale' ? Math.max(template.altezzaMm, 297) : 420;
  const quadro = progetto.quadri[0];
  const linee = progetto.linee;
  const numTavole = Math.max(1, Math.ceil(linee.length / CAVI_PER_TAVOLA));
  const entities: string[] = [];

  for (let sheetIdx = 0; sheetIdx < numTavole; sheetIdx++) {
    const ox = sheetIdx * (sheetW + 30);
    const oy = 0;
    const geom = renderDxfTemplateFrame(entities, ox, oy, sheetW, sheetH);
    const footerTopY = renderNotaCartiglioFooter(
      entities,
      geom,
      progetto,
      calcolo,
      template,
      sheetIdx,
      numTavole,
      `Elenco Cavi — ${quadro?.sigla ?? 'Quadro'}`
    );
    const bodyTopY = renderDocumentTopHeader(
      entities,
      geom,
      progetto,
      'ELENCO DEI CAVI',
      'SYM_HDR_CAVI'
    );

    const tblTop = bodyTopY - 1;
    const hdrH = 22;
    const rowH = 32;
    const tblBot = footerTopY + 2;
    const slice = linee.slice(sheetIdx * CAVI_PER_TAVOLA, (sheetIdx + 1) * CAVI_PER_TAVOLA);

    // Larghezze colonne (totale = 392 mm su A3)
    const wCol1 = 68; // Descrizione
    const wCol2 = 76; // Tipo - Isolante / Codifica Posa / Formazione
    const wCol3 = 104; // Posa (simbolo 28 + testo 76)
    const wCol4 = 44; // Ib / In F/N / Iz F/N
    const wCol5 = 24; // Lungh. / K
    const wCol6 = geom.innerW - (wCol1 + wCol2 + wCol3 + wCol4 + wCol5); // Estremi del cavo

    const x1 = geom.innerX;
    const x2 = x1 + wCol1;
    const x3 = x2 + wCol2;
    const x4 = x3 + wCol3;
    const x5 = x4 + wCol4;
    const x6 = x5 + wCol5;

    // Intestazione tabella
    const hdrBot = tblTop - hdrH;
    entities.push(dxfRect('TABELLE', geom.innerX, hdrBot, geom.innerW, hdrH, 7));
    [x2, x3, x4, x5, x6].forEach((vx) =>
      entities.push(dxfLine('TABELLE', vx, hdrBot, vx, tblTop, 7))
    );

    entities.push(dxfText('TESTI', x1 + wCol1 / 2, hdrBot + hdrH / 2, 2.4, 'Descrizione', 7, 'center'));
    entities.push(
      dxfText('TESTI', x2 + wCol2 / 2, hdrBot + 15.5, 2.1, 'Tipo - Isolante', 7, 'center'),
      dxfText('TESTI', x2 + wCol2 / 2, hdrBot + 10.5, 2.1, 'Codifica Posa CEI 64-8', 7, 'center'),
      dxfText('TESTI', x2 + wCol2 / 2, hdrBot + 5.5, 2.1, 'Formazione - Norma riferimento', 7, 'center')
    );
    entities.push(dxfText('TESTI', x3 + wCol3 / 2, hdrBot + hdrH / 2, 2.4, 'Posa', 7, 'center'));
    entities.push(
      dxfText('TESTI', x4 + wCol4 / 2, hdrBot + 17.5, 2.0, 'Ib', 7, 'center'),
      dxfText('TESTI', x4 + wCol4 / 2, hdrBot + 13.0, 2.0, 'In F/N', 7, 'center'),
      dxfText('TESTI', x4 + wCol4 / 2, hdrBot + 8.5, 2.0, 'Iz F/N', 7, 'center'),
      dxfText('TESTI', x4 + wCol4 / 2, hdrBot + 4.0, 2.0, '[A]', 7, 'center')
    );
    entities.push(
      dxfText('TESTI', x5 + wCol5 / 2, hdrBot + 16.5, 2.0, 'Lungh.', 7, 'center'),
      dxfText('TESTI', x5 + wCol5 / 2, hdrBot + 12.2, 2.0, '[m]', 7, 'center'),
      dxfText('TESTI', x5 + wCol5 / 2, hdrBot + 7.2, 1.9, 'K', 7, 'center'),
      dxfText('TESTI', x5 + wCol5 / 2, hdrBot + 3.2, 1.7, '(posa)', 7, 'center')
    );
    entities.push(
      dxfText('TESTI', x6 + wCol6 / 2, hdrBot + 15.5, 2.2, 'Estremi del cavo', 7, 'center'),
      dxfText('TESTI', x6 + wCol6 / 2, hdrBot + 9.5, 2.0, 'da:', 7, 'center'),
      dxfText('TESTI', x6 + wCol6 / 2, hdrBot + 4.8, 2.0, 'a:', 7, 'center')
    );

    // Righe cavi
    slice.forEach((linea, idx) => {
      const rTop = hdrBot - idx * rowH;
      const rBot = rTop - rowH;
      if (rBot < tblBot) return;

      const res = calcolo.linee[linea.id];
      const subH = rowH / 3;
      const halfH = rowH / 2;

      entities.push(dxfRect('TABELLE', geom.innerX, rBot, geom.innerW, rowH, 7));
      [x2, x3, x4, x5, x6].forEach((vx) =>
        entities.push(dxfLine('TABELLE', vx, rBot, vx, rTop, 7))
      );

      // Col 1: Descrizione
      entities.push(
        dxfText('TESTI', x1 + 2.5, rTop - 6.0, 2.2, linea.sigla, 7, 'left'),
        dxfText('TESTI', x1 + 2.5, rTop - 13.0, 1.9, linea.descrizione.slice(0, 30), 7, 'left'),
        dxfText('TESTI', x1 + 2.5, rTop - 19.5, 1.8, linea.descrizione.slice(30, 60), 7, 'left'),
        dxfText(
          'TESTI',
          x1 + 2.5,
          rBot + 4.0,
          1.7,
          `CPR: ${linea.classeCPR} (${linea.resistenzaFuocoCavoScelto})`,
          8,
          'left'
        )
      );

      // Col 2: Tipo / Codifica Posa CEI / Formazione
      entities.push(dxfLine('TABELLE', x2, rTop - subH, x3, rTop - subH, 8));
      entities.push(dxfLine('TABELLE', x2, rTop - 2 * subH, x3, rTop - 2 * subH, 8));
      entities.push(dxfLine('TABELLE', x2 + 22, rTop - 2 * subH, x2 + 22, rTop - subH, 8));
      entities.push(dxfLine('TABELLE', x2 + 48, rTop - 2 * subH, x2 + 48, rTop - subH, 8));
      entities.push(dxfLine('TABELLE', x2 + 46, rBot, x2 + 46, rTop - 2 * subH, 8));

      const tipoCavo =
        linea.resistenzaFuocoCavoScelto !== 'nessuna'
          ? `FTG18OM16 (${linea.resistenzaFuocoCavoScelto})`
          : 'FG16OM16';
      const sez = res?.sezioneSceltaMm2 ?? linea.sezioneManualeMm2 ?? 2.5;
      const formazione =
        linea.tipoFornitura === 'trifase'
          ? `1(3x${sez})+(1N${sez})+(1PE${sez})`
          : `2(1x${sez})+(1PE${sez})`;

      entities.push(
        dxfText('TESTI', x2 + 2.5, rTop - subH / 2, 1.9, tipoCavo, 7, 'left'),
        dxfText('TESTI', x2 + 11, rTop - 1.5 * subH, 1.7, formatPosaCodice(linea.tipoPosa), 7, 'center'),
        dxfText('TESTI', x2 + 35, rTop - 1.5 * subH, 1.7, 'Multipolare', 7, 'center'),
        dxfText('TESTI', x2 + 62, rTop - 1.5 * subH, 1.7, 'EPR / LS0H', 7, 'center'),
        dxfText('TESTI', x2 + 2.5, rBot + subH / 2, 1.75, formazione, 7, 'left'),
        dxfText('TESTI', x2 + 61, rBot + subH / 2, 1.7, 'CEI 20-105', 7, 'center')
      );

      // Col 3: Simbolo posa grafico + descrizione
      const posaSymW = 28;
      entities.push(dxfLine('TABELLE', x3 + posaSymW, rBot, x3 + posaSymW, rTop, 8));
      const posaBlock =
        linea.tipoPosa === 'tubo_incassato'
          ? 'SYM_POSA_INCASSATO'
          : linea.tipoPosa === 'tubo_a_vista'
          ? 'SYM_POSA_VISTA'
          : linea.tipoPosa === 'canale_passerella'
          ? 'SYM_POSA_PASSERELLA'
          : linea.tipoPosa === 'interrato'
          ? 'SYM_POSA_INTERRATO'
          : 'SYM_POSA_ARIA';
      entities.push(dxfInsert('LINEE', posaBlock, x3 + posaSymW / 2, rBot + rowH / 2, 1));

      const [d1, d2, d3] = formatPosaDescrizione(linea.tipoPosa);
      const txtCenter = x3 + posaSymW + (wCol3 - posaSymW) / 2;
      entities.push(
        dxfText('TESTI', txtCenter, rTop - 9.0, 1.75, d1, 7, 'center'),
        dxfText('TESTI', txtCenter, rTop - 16.0, 1.75, d2, 7, 'center'),
        dxfText('TESTI', txtCenter, rTop - 23.0, 1.65, d3, 8, 'center')
      );

      // Col 4: Ib / In F/N / Iz F/N
      entities.push(dxfLine('TABELLE', x4, rTop - subH, x5, rTop - subH, 8));
      entities.push(dxfLine('TABELLE', x4, rTop - 2 * subH, x5, rTop - 2 * subH, 8));
      entities.push(dxfLine('TABELLE', x4 + wCol4 / 2, rBot, x4 + wCol4 / 2, rTop - subH, 8));

      const ibVal = res ? res.correnteImpiegoIbA.toFixed(2) : '0.00';
      const inVal = String(res?.protezioneSceltaInA ?? linea.protezioneInManualeA ?? 16);
      const izVal = res ? res.portataCorrettaIzA.toFixed(1) : '0.0';
      entities.push(
        dxfText('TESTI', x4 + wCol4 / 2, rTop - subH / 2, 1.9, ibVal, 7, 'center'),
        dxfText('TESTI', x4 + wCol4 * 0.25, rTop - 1.5 * subH, 1.8, inVal, 7, 'center'),
        dxfText('TESTI', x4 + wCol4 * 0.75, rTop - 1.5 * subH, 1.8, inVal, 7, 'center'),
        dxfText('TESTI', x4 + wCol4 * 0.25, rBot + subH / 2, 1.8, izVal, 7, 'center'),
        dxfText('TESTI', x4 + wCol4 * 0.75, rBot + subH / 2, 1.8, izVal, 7, 'center')
      );

      // Col 5: Lunghezza / K posa
      entities.push(dxfLine('TABELLE', x5, rBot + halfH, x6, rBot + halfH, 8));
      const kTot = res ? (res.fattoreKt * res.fattoreKg).toFixed(3) : '1.000';
      entities.push(
        dxfText('TESTI', x5 + wCol5 / 2, rTop - halfH / 2, 1.9, String(linea.lunghezzaM), 7, 'center'),
        dxfText('TESTI', x5 + wCol5 / 2, rBot + halfH / 2, 1.8, kTot, 7, 'center')
      );

      // Col 6: Estremi del cavo (da / a)
      entities.push(dxfLine('TABELLE', x6, rBot + halfH, geom.innerR, rBot + halfH, 8));
      entities.push(
        dxfText(
          'TESTI',
          x6 + 2.5,
          rTop - 6.0,
          1.8,
          `QUADRO ${quadro?.sigla ?? 'Q.ANT-01'} - ${quadro?.nome.slice(0, 22) ?? ''}`,
          7,
          'left'
        ),
        dxfText(
          'TESTI',
          x6 + 2.5,
          rTop - 11.5,
          1.65,
          progetto.identificativi.sito.slice(0, 34),
          8,
          'left'
        ),
        dxfText('TESTI', x6 + 2.5, rBot + halfH / 2, 1.85, `Utenza ${linea.sigla} - ${linea.descrizione.slice(0, 24)}`, 7, 'left')
      );
    });
  }

  return finalizeDxfString(numTavole, sheetW, sheetH, entities);
}

// ============================================================================
// 3. SCHEMA FRONTE QUADRO DXF (Carpenteria DIN + Distinta Apparecchiature)
// ============================================================================
export function generaDxfFronteQuadro(
  progetto: ProgettoAntincendio,
  calcolo: RisultatoCalcoloCompleto,
  template: TemplateTavolaDXF
): string {
  const sheetW =
    template.orientamento === 'orizzontale' ? Math.max(template.larghezzaMm, 420) : 297;
  const sheetH =
    template.orientamento === 'orizzontale' ? Math.max(template.altezzaMm, 297) : 420;
  const quadro = progetto.quadri[0];
  const linee = progetto.linee;
  const numTavole = 1;
  const entities: string[] = [];

  const geom = renderDxfTemplateFrame(entities, 0, 0, sheetW, sheetH);
  const footerTopY = renderNotaCartiglioFooter(
    entities,
    geom,
    progetto,
    calcolo,
    template,
    0,
    numTavole,
    `Schema Fronte Quadro — ${quadro?.sigla ?? 'Q.ANT-01'}`
  );
  const bodyTopY = renderDocumentTopHeader(
    entities,
    geom,
    progetto,
    `SCHEMA FRONTE QUADRO — ${quadro?.sigla ?? 'Q.ANT-01'}`,
    'SYM_HDR_QUADRO'
  );

  // Area Sinistra: Disegno fronte quadro con 3 file DIN da 24 moduli
  const cabX = geom.innerX + 6;
  const cabW = 192;
  const cabBot = footerTopY + 8;
  const cabTop = bodyTopY - 8;
  const cabH = cabTop - cabBot;

  // Carpenteria esterna + telaio porta interno
  entities.push(dxfRect('QUADRI', cabX, cabBot, cabW, cabH, 7));
  entities.push(dxfRect('QUADRI', cabX + 8, cabBot + 8, cabW - 16, cabH - 16, 8));
  // Cerniere laterali e serratura frontale
  entities.push(dxfRect('QUADRI', cabX - 2, cabTop - 32, 2, 10, 7));
  entities.push(dxfRect('QUADRI', cabX - 2, cabBot + 22, 2, 10, 7));
  entities.push(dxfCircle('QUADRI', cabX + cabW - 5, cabBot + cabH / 2, 2.5, 7));

  // Targa identificativa antincendio sul fronte quadro
  entities.push(dxfRect('SIMBOLI_DM83', cabX + 16, cabTop - 22, cabW - 32, 11, 1));
  entities.push(
    dxfText(
      'SIMBOLI_DM83',
      cabX + cabW / 2,
      cabTop - 14.5,
      2.4,
      `${quadro?.sigla ?? 'Q.ANT-01'} - SERVIZI ANTINCENDIO (${quadro?.gradoIP ?? 'IP54'})`,
      1,
      'center'
    ),
    dxfText(
      'SIMBOLI_DM83',
      cabX + cabW / 2,
      cabTop - 19.2,
      1.7,
      `${quadro?.formaSegregazione ?? 'Forma 2b'} · ${quadro?.alimentazionePreferenzialeAMonte ? 'ALIMENTAZIONE A MONTE I.G.' : 'ALIMENTAZIONE ORDINARIA'}`,
      1,
      'center'
    )
  );

  // Calcolo apparecchiature modulari DIN
  interface DinDevice {
    fila: number;
    sigla: string;
    label: string;
    moduli: number;
    color: number;
    calibro: string;
    descrizione: string;
  }

  const devices: DinDevice[] = [
    {
      fila: 1,
      sigla: 'QS0',
      label: `GEN ${quadro?.interruttoreGeneraleInA ?? 40}A`,
      moduli: quadro?.tipoFornitura === 'trifase' ? 4 : 2,
      color: 1,
      calibro: `${quadro?.interruttoreGeneraleInA ?? 40}A (${quadro?.interruttoreGeneraleIcuKa ?? 16}kA)`,
      descrizione: `Generale ${quadro?.sigla ?? 'Quadro'}`,
    },
    {
      fila: 1,
      sigla: 'H1',
      label: 'SPIA RETE',
      moduli: 1,
      color: 5,
      calibro: '230V AC',
      descrizione: 'Spia presenza rete antincendio',
    },
    {
      fila: 1,
      sigla: 'SPD',
      label: 'SCARIC.',
      moduli: quadro?.tipoFornitura === 'trifase' ? 4 : 2,
      color: 4,
      calibro: 'Tipo 2 40kA',
      descrizione: 'Limitatore sovratensioni SPD',
    },
  ];

  // Distribuzione partenze sulle file DIN 2 e 3 (max 24 moduli per fila)
  let currentFila = 2;
  let usedInFila = 0;
  linee.forEach((linea, idx) => {
    const res = calcolo.linee[linea.id];
    const mod =
      linea.tipoFornitura === 'trifase'
        ? linea.tipoProtezione === 'magnetotermico_differenziale'
          ? 6
          : 4
        : linea.tipoProtezione === 'magnetotermico_differenziale'
        ? 3
        : 2;
    if (usedInFila + mod > 22 && currentFila < 3) {
      currentFila += 1;
      usedInFila = 0;
    }
    usedInFila += mod;
    devices.push({
      fila: currentFila,
      sigla: `Q${idx + 1}`,
      label: `${linea.sigla} ${res?.protezioneSceltaInA ?? 16}A`,
      moduli: mod,
      color: 3,
      calibro: res?.siglaProtezioneCompleta ?? 'MTD',
      descrizione: `${linea.sigla} - ${linea.descrizione.slice(0, 26)}`,
    });
  });

  // Disegno 3 guide DIN dentro la carpenteria
  const maxModuliPerFila = 24;
  const railW = cabW - 36;
  const railX = cabX + 18;
  const modW = railW / maxModuliPerFila;
  const modH = 34;

  [1, 2, 3].forEach((fila) => {
    const railCenterY = cabTop - 44 - (fila - 1) * 56;
    // Guida DIN e apertura pannello frontale
    entities.push(dxfRect('QUADRI', railX - 2, railCenterY - modH / 2 - 2, railW + 4, modH + 4, 8));
    entities.push(dxfLine('QUADRI', railX, railCenterY, railX + railW, railCenterY, 8, 'DASHED'));
    entities.push(dxfText('TESTI', railX - 7, railCenterY, 2.0, `F${fila}`, 7, 'center'));

    const filaDevs = devices.filter((d) => d.fila === fila);
    let cursorMod = 0;
    filaDevs.forEach((dev) => {
      if (cursorMod + dev.moduli > maxModuliPerFila) return;
      const dx = railX + cursorMod * modW;
      const dw = dev.moduli * modW;
      const dy = railCenterY - modH / 2;

      entities.push(dxfRect('PROTEZIONI', dx + 0.3, dy, dw - 0.6, modH, dev.color));
      // Leva di manovra centrale
      entities.push(dxfRect('PROTEZIONI', dx + dw * 0.25, railCenterY - 3, dw * 0.5, 6, dev.color));
      // Sigla sopra e targhetta utenza sotto il modulo
      entities.push(dxfText('TESTI', dx + dw / 2, dy + modH + 3.0, 1.7, dev.sigla, 7, 'center'));
      entities.push(dxfText('TESTI', dx + dw / 2, dy - 3.5, 1.5, dev.label.slice(0, 11), 7, 'center'));

      cursorMod += dev.moduli;
    });

    // Moduli di riserva ciechi sulla parte rimanente della guida
    if (cursorMod < maxModuliPerFila) {
      const rx = railX + cursorMod * modW;
      const rw = (maxModuliPerFila - cursorMod) * modW;
      entities.push(dxfRect('QUADRI', rx + 0.3, railCenterY - modH / 2, rw - 0.6, modH, 8, 'DASHED'));
      entities.push(
        dxfText(
          'TESTI',
          rx + rw / 2,
          railCenterY,
          1.7,
          `RISERVA (${maxModuliPerFila - cursorMod}M)`,
          8,
          'center'
        )
      );
    }
  });

  // Area Destra: Distinta Apparecchiature a Fronte Quadro
  const listX = cabX + cabW + 8;
  const listW = geom.innerR - listX;
  const listTop = cabTop;
  const listRowH = 7.2;
  const maxRowsList = Math.floor((cabH - 22) / listRowH);

  entities.push(dxfRect('TABELLE', listX, listTop - 9, listW, 9, 7));
  entities.push(
    dxfText('TESTI', listX + listW / 2, listTop - 4.5, 2.3, 'DISTINTA APPARECCHIATURE FRONTE QUADRO', 7, 'center')
  );

  const lCol1 = 12; // Fila
  const lCol2 = 18; // Sigla
  const lCol3 = 72; // Descrizione
  const lCol4 = 18; // Moduli
  // Col 5 = rimanente (Caratteristiche)
  const lhY = listTop - 9 - listRowH;
  entities.push(dxfRect('TABELLE', listX, lhY, listW, listRowH, 7));
  [lCol1, lCol1 + lCol2, lCol1 + lCol2 + lCol3, lCol1 + lCol2 + lCol3 + lCol4].forEach((off) =>
    entities.push(dxfLine('TABELLE', listX + off, lhY, listX + off, listTop - 9, 7))
  );
  entities.push(
    dxfText('TESTI', listX + lCol1 / 2, lhY + listRowH / 2, 1.8, 'Fila', 7, 'center'),
    dxfText('TESTI', listX + lCol1 + lCol2 / 2, lhY + listRowH / 2, 1.8, 'Sigla', 7, 'center'),
    dxfText('TESTI', listX + lCol1 + lCol2 + lCol3 / 2, lhY + listRowH / 2, 1.8, 'Descrizione Utenza', 7, 'center'),
    dxfText('TESTI', listX + lCol1 + lCol2 + lCol3 + lCol4 / 2, lhY + listRowH / 2, 1.8, 'Mod.DIN', 7, 'center'),
    dxfText(
      'TESTI',
      listX + lCol1 + lCol2 + lCol3 + lCol4 + (listW - (lCol1 + lCol2 + lCol3 + lCol4)) / 2,
      lhY + listRowH / 2,
      1.8,
      'Apparecchio / Calibro',
      7,
      'center'
    )
  );

  devices.slice(0, maxRowsList).forEach((dev, i) => {
    const ry = lhY - (i + 1) * listRowH;
    entities.push(dxfRect('TABELLE', listX, ry, listW, listRowH, 8));
    [lCol1, lCol1 + lCol2, lCol1 + lCol2 + lCol3, lCol1 + lCol2 + lCol3 + lCol4].forEach((off) =>
      entities.push(dxfLine('TABELLE', listX + off, ry, listX + off, ry + listRowH, 8))
    );
    entities.push(
      dxfText('TESTI', listX + lCol1 / 2, ry + listRowH / 2, 1.75, `F${dev.fila}`, 7, 'center'),
      dxfText('TESTI', listX + lCol1 + lCol2 / 2, ry + listRowH / 2, 1.75, dev.sigla, 7, 'center'),
      dxfText('TESTI', listX + lCol1 + lCol2 + 2, ry + listRowH / 2 - 0.8, 1.65, dev.descrizione.slice(0, 32), 7, 'left'),
      dxfText('TESTI', listX + lCol1 + lCol2 + lCol3 + lCol4 / 2, ry + listRowH / 2, 1.75, `${dev.moduli}M`, 7, 'center'),
      dxfText(
        'TESTI',
        listX + lCol1 + lCol2 + lCol3 + lCol4 + 2,
        ry + listRowH / 2 - 0.8,
        1.6,
        dev.calibro.slice(0, 28),
        7,
        'left'
      )
    );
  });

  // Riepilogo occupazione moduli DIN in basso a destra
  const totModuli = devices.reduce((acc, d) => acc + d.moduli, 0);
  const totDisp = 3 * maxModuliPerFila;
  const riservaPct = Math.max(0, Math.round(((totDisp - totModuli) / totDisp) * 100));
  entities.push(dxfRect('TABELLE', listX, cabBot, listW, 13, 7));
  entities.push(
    dxfText(
      'TESTI',
      listX + 3,
      cabBot + 8.5,
      1.85,
      `Totale Moduli DIN Occupati: ${totModuli} / ${totDisp} moduli (Riserva libera: ${riservaPct}%)`,
      7,
      'left'
    ),
    dxfText(
      'TESTI',
      listX + 3,
      cabBot + 3.0,
      1.7,
      `Quadro: ${quadro?.nome ?? ''} · IP ${quadro?.gradoIP ?? 'IP54'} · Segregazione ${quadro?.formaSegregazione ?? 'Forma 2b'}`,
      8,
      'left'
    )
  );

  return finalizeDxfString(numTavole, sheetW, sheetH, entities);
}

// ============================================================================
// 4. SCHEMA MORSETTIERA DXF (Morsettiera X1 + Collegamenti Lato Quadro / Campo)
// ============================================================================
export function generaDxfMorsettiera(
  progetto: ProgettoAntincendio,
  calcolo: RisultatoCalcoloCompleto,
  template: TemplateTavolaDXF
): string {
  const sheetW =
    template.orientamento === 'orizzontale' ? Math.max(template.larghezzaMm, 420) : 297;
  const sheetH =
    template.orientamento === 'orizzontale' ? Math.max(template.altezzaMm, 297) : 420;
  const quadro = progetto.quadri[0];
  const linee = progetto.linee;
  const numTavole = Math.max(1, Math.ceil(linee.length / MORSETTI_PER_TAVOLA));
  const entities: string[] = [];

  for (let sheetIdx = 0; sheetIdx < numTavole; sheetIdx++) {
    const ox = sheetIdx * (sheetW + 30);
    const oy = 0;
    const geom = renderDxfTemplateFrame(entities, ox, oy, sheetW, sheetH);
    const footerTopY = renderNotaCartiglioFooter(
      entities,
      geom,
      progetto,
      calcolo,
      template,
      sheetIdx,
      numTavole,
      `Schema Morsettiera X1 — ${quadro?.sigla ?? 'Q.ANT-01'}`
    );
    const bodyTopY = renderDocumentTopHeader(
      entities,
      geom,
      progetto,
      `SCHEMA MORSETTIERA X1 — ${quadro?.sigla ?? 'Q.ANT-01'}`,
      'SYM_HDR_MORSETTI'
    );

    const tblTop = bodyTopY - 1;
    const hdrH = 12;
    const hdrBot = tblTop - hdrH;
    const rowH = 29;
    const tblBot = footerTopY + 2;

    const wLatoInt = 112;
    const wMors = 108;
    const wLatoEst = geom.innerW - wLatoInt - wMors;

    const xInt = geom.innerX;
    const xMors = xInt + wLatoInt;
    const xEst = xMors + wMors;

    entities.push(dxfRect('TABELLE', geom.innerX, hdrBot, geom.innerW, hdrH, 7));
    entities.push(dxfLine('TABELLE', xMors, hdrBot, xMors, tblTop, 7));
    entities.push(dxfLine('TABELLE', xEst, hdrBot, xEst, tblTop, 7));

    entities.push(
      dxfText('TESTI', xInt + wLatoInt / 2, hdrBot + hdrH / 2, 2.2, 'LATO INTERNO QUADRO (Apparecchio / Filo)', 7, 'center'),
      dxfText('TESTI', xMors + wMors / 2, hdrBot + hdrH / 2, 2.2, 'MORSETTIERA X1 (Morsetti Potenza & PE)', 7, 'center'),
      dxfText('TESTI', xEst + wLatoEst / 2, hdrBot + hdrH / 2, 2.2, 'LATO ESTERNO CAMPO (Cavo / Utenza / Segnali)', 7, 'center')
    );

    const slice = linee.slice(
      sheetIdx * MORSETTI_PER_TAVOLA,
      (sheetIdx + 1) * MORSETTI_PER_TAVOLA
    );

    slice.forEach((linea, idx) => {
      const rTop = hdrBot - idx * rowH;
      const rBot = rTop - rowH;
      if (rBot < tblBot) return;

      const globalIdx = sheetIdx * MORSETTI_PER_TAVOLA + idx;
      const res = calcolo.linee[linea.id];
      const sez = res?.sezioneSceltaMm2 ?? linea.sezioneManualeMm2 ?? 2.5;
      const cbdType = sez >= 6 ? 'CBD.6' : 'CBD.4';
      const poles =
        linea.tipoFornitura === 'trifase'
          ? ['L1', 'L2', 'L3', 'N', 'PE']
          : ['L1', 'N', 'PE'];

      entities.push(dxfRect('TABELLE', geom.innerX, rBot, geom.innerW, rowH, 7));
      entities.push(dxfLine('TABELLE', xMors, rBot, xMors, rTop, 7));
      entities.push(dxfLine('TABELLE', xEst, rBot, xEst, rTop, 7));

      // Lato interno quadro
      entities.push(
        dxfText('TESTI', xInt + 3, rTop - 5.5, 2.0, `Partenza ${linea.sigla} (da Q${globalIdx + 1})`, 7, 'left'),
        dxfText('TESTI', xInt + 3, rTop - 11.5, 1.7, res?.siglaProtezioneCompleta ?? 'MTD', 8, 'left'),
        dxfText(
          'TESTI',
          xInt + 3,
          rBot + 5.0,
          1.65,
          `Cordicella N07V-K ${sez} mmq · ${linea.tipoFornitura === 'trifase' ? '3F+N+PE' : '1F+N+PE'}`,
          7,
          'left'
        )
      );

      // Disegno morsetti singoli al centro
      const stripW = poles.length * 16;
      const stripX = xMors + (wMors - stripW) / 2;
      const stripY = rBot + 6.5;
      const cellW = 16;
      const cellH = 14;

      entities.push(
        dxfText(
          'TESTI',
          xMors + wMors / 2,
          rTop - 4.0,
          1.75,
          `Morsettiera X1-${linea.sigla} (${cbdType})`,
          7,
          'center'
        )
      );

      poles.forEach((pole, pIdx) => {
        const mx = stripX + pIdx * cellW;
        const mCenter = mx + cellW / 2;
        const termNum =
          pole === 'PE' ? 'T' : String(globalIdx * 4 + pIdx + 1);
        const col = pole === 'PE' ? 3 : pole === 'N' ? 5 : 7;

        entities.push(dxfRect('LINEE', mx, stripY, cellW, cellH, col));
        entities.push(dxfCircle('LINEE', mCenter, stripY + cellH / 2, 2.0, col));
        // Conduttore entrante (sx -> sopra) e uscente (sotto)
        entities.push(dxfLine('LINEE', xInt + wLatoInt - 8, stripY + cellH + 2, mCenter, stripY + cellH, col));
        entities.push(dxfLine('LINEE', mCenter, stripY, mCenter, stripY - 3.5, col));

        entities.push(dxfText('TESTI', mCenter, stripY + cellH - 2.4, 1.45, pole, col, 'center'));
        entities.push(dxfText('TESTI', mCenter, stripY + 2.2, 1.5, termNum, 7, 'center'));
      });

      // Lato esterno campo + segnali ausiliari antincendio
      const segnaliAttivi = [
        linea.segnali.allarme ? 'ALLARME' : null,
        linea.segnali.guasto ? 'GUASTO' : null,
        linea.segnali.marcia ? 'MARCIA' : null,
        linea.segnali.mancanzaRete ? 'MANC.RETE' : null,
        linea.segnali.comandiRemoti ? 'COMANDI' : null,
      ].filter(Boolean);

      entities.push(
        dxfText(
          'TESTI',
          xEst + 3,
          rTop - 5.5,
          1.9,
          `Verso Utenza ${linea.sigla} — ${linea.descrizione.slice(0, 34)}`,
          7,
          'left'
        ),
        dxfText(
          'TESTI',
          xEst + 3,
          rTop - 11.5,
          1.7,
          `Cavo: ${res?.siglaCavoCompleta.slice(0, 44) ?? ''} · L=${linea.lunghezzaM} m`,
          7,
          'left'
        ),
        dxfText(
          'TESTI',
          xEst + 3,
          rBot + 5.0,
          1.6,
          segnaliAttivi.length > 0
            ? `Morsetti Segnali Ausiliari (X2-${linea.sigla}): ${segnaliAttivi.join(', ')}`
            : `Nessun contatto ausiliario su X2-${linea.sigla}`,
          segnaliAttivi.length > 0 ? 1 : 8,
          'left'
        )
      );
    });
  }

  return finalizeDxfString(numTavole, sheetW, sheetH, entities);
}
