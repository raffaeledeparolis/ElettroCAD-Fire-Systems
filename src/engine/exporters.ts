import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { AVVISO_RESPONSABILITA_LEGALE } from '../data/rulesAndLibrary';
import {
  EsitoVerifica,
  LineaUtenza,
  ProgettoAntincendio,
  RisultatoCalcoloCompleto,
  RisultatoCalcoloIRAI,
  SistemaIRAI,
  TemplateTavolaDXF,
} from '../types/elettrocad';
import { LINEE_PER_TAVOLA } from './dxfEngine';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function esportaDxfDocumento(
  dxfContent: string,
  commessa: string,
  suffissoFile: string
) {
  const blob = new Blob([dxfContent], { type: 'application/dxf;charset=utf-8' });
  downloadBlob(blob, `${commessa || 'ElettroCAD'}_${suffissoFile}.dxf`);
}

export function esportaDxfFile(dxfContent: string, commessa: string) {
  esportaDxfDocumento(dxfContent, commessa, 'Schema_Unifilare');
}

export function esportaJsonProgetto(progetto: ProgettoAntincendio) {
  const blob = new Blob([JSON.stringify(progetto, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  downloadBlob(blob, `${progetto.identificativi.commessa}_Progetto_ElettroCAD.json`);
}

export function esportaPdfMultiFoglio(
  progetto: ProgettoAntincendio,
  calcolo: RisultatoCalcoloCompleto,
  esiti: EsitoVerifica[],
  template: TemplateTavolaDXF,
  formato: 'A3' | 'A4' = 'A3'
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: formato.toLowerCase() as 'a3' | 'a4',
  });

  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const quadro = progetto.quadri[0];
  const linee = progetto.linee;
  const numTavole = Math.max(1, Math.ceil(linee.length / LINEE_PER_TAVOLA));

  for (let sheet = 0; sheet < numTavole; sheet++) {
    if (sheet > 0) doc.addPage();

    // Cornice esterna e interna
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.rect(8, 8, w - 16, h - 16);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.rect(12, 12, w - 24, h - 42);

    // Titolo quadro
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `${quadro ? `${quadro.sigla} — ${quadro.nome}` : 'Quadro Antincendio'} (Tavola ${sheet + 1}/${numTavole})`,
      16,
      20
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Fornitura: ${progetto.fornitura.tensioneNominaleV}V ${progetto.fornitura.tipoFornitura.toUpperCase()} ${progetto.fornitura.sistemaDistribuzione} | Icc: ${progetto.fornitura.iccPuntoConsegnaKa ?? 'N.D.'} kA | Grado IP: ${quadro?.gradoIP ?? 'IP54'} | Livello Prestazione: ${progetto.livelloPrestazione}`,
      16,
      26
    );

    // Sbarra
    const busY = 42;
    doc.setDrawColor(29, 78, 216);
    doc.setLineWidth(1.1);
    doc.line(22, busY, w - 22, busY);
    doc.setFontSize(8);
    doc.setTextColor(29, 78, 216);
    if (quadro) {
      doc.text(
        `SBARRA ${quadro.sigla} · In=${quadro.correnteNominaleBarraA} A · I.G. ${quadro.interruttoreGeneraleInA} A (${quadro.interruttoreGeneraleIcuKa} kA)`,
        24,
        busY - 2.5
      );
    }

    // Righe utenze
    const slice = linee.slice(sheet * LINEE_PER_TAVOLA, (sheet + 1) * LINEE_PER_TAVOLA);
    const colStart = 28;
    const colGap = Math.max(36, (w - 56) / Math.max(1, slice.length));

    slice.forEach((linea, idx) => {
      const cx = colStart + idx * colGap;
      const res = calcolo.linee[linea.id];

      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.35);
      doc.line(cx, busY, cx, busY + 14);

      // Simbolo protezione
      doc.setDrawColor(21, 128, 61);
      doc.rect(cx - 4, busY + 14, 8, 12);
      doc.line(cx - 3, busY + 18, cx + 3, busY + 22);

      doc.setDrawColor(15, 23, 42);
      doc.line(cx, busY + 26, cx, busY + 52);

      // Simbolo D.M. 83 rosso
      doc.setDrawColor(185, 28, 28);
      doc.rect(cx - 9, busY + 52, 18, 11);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(185, 28, 28);
      doc.text(linea.sigla, cx, busY + 59, { align: 'center' });

      if (res) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`${res.protezioneSceltaInA}A ${linea.curvaProtezione}`, cx + 5.5, busY + 21);
        doc.text(`${res.correnteImpiegoIbA} A`, cx + 5.5, busY + 34);
        doc.text(`${res.sezioneSceltaMm2}mm² ${linea.resistenzaFuocoCavoScelto}`, cx + 5.5, busY + 39);
        doc.text(`ΔV ${res.cadutaTensionePct}%`, cx + 5.5, busY + 44);
      }
    });

    // Tabella Dati
    const tableY = h - 98;
    const rowH = 6.2;
    const rows = [
      'SIGLA',
      'DESCRIZIONE',
      'POTENZA (W)',
      'CORRENTE Ib (A)',
      'COS PHI',
      'PROTEZIONE',
      'CADUTA ΔV (%)',
      'CAVO / RESISTENZA',
      'POSA / PORTATA Iz',
    ];
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.2);
    rows.forEach((lbl, rIdx) => {
      const y = tableY + rIdx * rowH;
      doc.rect(12, y, w - 24, rowH);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(51, 65, 85);
      doc.text(lbl, 14, y + 4.2);

      slice.forEach((linea, idx) => {
        const res = calcolo.linee[linea.id];
        if (!res) return;
        const cx = colStart + idx * colGap;
        const val = [
          linea.sigla,
          linea.descrizione.slice(0, 20),
          `${linea.potenzaNominaleW} W`,
          `${res.correnteImpiegoIbA.toFixed(2)} A`,
          `${linea.cosPhi.toFixed(2)}`,
          `${res.protezioneSceltaInA}A ${linea.curvaProtezione}`,
          `${res.cadutaTensionePct.toFixed(2)}%`,
          `${res.sezioneSceltaMm2}mm² ${linea.resistenzaFuocoCavoScelto}`,
          `${res.portataCorrettaIzA} A`,
        ][rIdx];
        doc.setFont('helvetica', rIdx === 0 ? 'bold' : 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(val, cx - 10, y + 4.2);
      });
    });

    // Cartiglio
    const cartW = 135;
    const cartH = 26;
    const cartX = w - 8 - cartW;
    const cartY = h - 8 - cartH;
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.35);
    doc.rect(cartX, cartY, cartW, cartH);
    doc.line(cartX, cartY + 13, cartX + cartW, cartY + 13);
    doc.line(cartX + 88, cartY, cartX + 88, cartY + cartH);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(progetto.identificativi.titoloTavola.slice(0, 48), cartX + 3, cartY + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(`Cliente: ${progetto.identificativi.cliente}`, cartX + 3, cartY + 10.5);
    doc.text(`Progettista: ${progetto.identificativi.progettista.slice(0, 44)}`, cartX + 3, cartY + 18);
    doc.text(`Commessa: ${progetto.identificativi.commessa} · Data: ${progetto.identificativi.data}`, cartX + 3, cartY + 23);
    doc.text(`Rev: ${progetto.identificativi.revisione}`, cartX + 91, cartY + 6.5);
    doc.text(`Tavola: ${sheet + 1}/${numTavole} (${template.formatoFoglio})`, cartX + 91, cartY + 11.5);
    doc.text(`App ${calcolo.versioneApp}`, cartX + 91, cartY + 18);
    doc.text(`Regole ${calcolo.versioneRegole}`, cartX + 91, cartY + 23);

    // Avviso responsabilità
    doc.setFontSize(5.8);
    doc.setTextColor(185, 28, 28);
    doc.text(AVVISO_RESPONSABILITA_LEGALE, 12, h - 18, { maxWidth: w - cartW - 26 });
  }

  // Pagina riepilogo IRAI Causa-Effetto & Verifiche
  doc.addPage();
  doc.setDrawColor(15, 23, 42);
  doc.rect(8, 8, w - 16, h - 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Matrice Causa-Effetto IRAI & Riepilogo Verifiche Antincendio', 14, 18);

  let yPos = 28;
  progetto.sistemiIrai.forEach((sys) => {
    doc.setFontSize(9);
    doc.text(`Sistema ${sys.sigla} — ${sys.nome}`, 14, yPos);
    yPos += 6;
    sys.causaEffetto.forEach((ce) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(
        `• ${ce.causaDescrizione}  =>  Targhe: ${ce.attivaTargheOtticoAcustiche ? 'Sì' : 'No'} | EVAC: ${ce.attivaEvac ? ce.messaggioEvac : 'No'} | Sgancio imp.: ${ce.sgancioImpiantiTecnologici ? 'Sì' : 'No'} | Ritardo: ${ce.ritardoSecondi}s`,
        16,
        yPos
      );
      yPos += 5.5;
    });
    yPos += 4;
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Esiti Verifiche Normative:', 14, yPos + 4);
  yPos += 10;
  esiti.slice(0, 22).forEach((es) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(
      `[${es.stato.toUpperCase()}] ${es.codice} (${es.targetLabel}) — ${es.valoreCalcolato} (Soglia: ${es.sogliaAttesa})`,
      14,
      yPos
    );
    yPos += 5;
  });

  doc.setFontSize(6.5);
  doc.setTextColor(185, 28, 28);
  doc.text(AVVISO_RESPONSABILITA_LEGALE, 14, h - 14, { maxWidth: w - 28 });

  doc.save(`${progetto.identificativi.commessa}_Elaborati_${formato}.pdf`);
}

export function esportaComputoXlsx(
  progetto: ProgettoAntincendio,
  calcolo: RisultatoCalcoloCompleto,
  esiti: EsitoVerifica[],
  formato: 'xlsx' | 'csv' = 'xlsx'
) {
  const elencoCavi = progetto.linee.map((l) => {
    const r = calcolo.linee[l.id];
    return {
      Sigla: l.sigla,
      Descrizione: l.descrizione,
      Potenza_W: l.potenzaNominaleW,
      Tensione_V: l.tensioneV,
      Corrente_Ib_A: r?.correnteImpiegoIbA ?? 0,
      Cavo: r?.siglaCavoCompleta ?? '',
      Sezione_mm2: r?.sezioneSceltaMm2 ?? 0,
      Lunghezza_m: l.lunghezzaM,
      Resistenza_Fuoco: l.resistenzaFuocoCavoScelto,
      Classe_CPR: l.classeCPR,
      Caduta_Tensione_Pct: r?.cadutaTensionePct ?? 0,
      Portata_Iz_A: r?.portataCorrettaIzA ?? 0,
    };
  });

  const elencoProtezioni = progetto.linee.map((l) => {
    const r = calcolo.linee[l.id];
    return {
      Sigla_Linea: l.sigla,
      Dispositivo: r?.siglaProtezioneCompleta ?? '',
      Tipo: l.tipoProtezione,
      Calibro_In_A: r?.protezioneSceltaInA ?? 0,
      Curva: l.curvaProtezione,
      Potere_Interruzione_Icu_kA: l.protezioneIcuKa,
      Differenziale_mA: l.differenzialeIdnMa ?? 'N/A',
      Coordinamento_OK: r?.verificaCoordinamentoOk ? 'Conforme' : 'Non conforme',
    };
  });

  const causaEffetto = progetto.sistemiIrai.flatMap((sys) =>
    sys.causaEffetto.map((ce) => ({
      Sistema: sys.sigla,
      Causa: ce.causaDescrizione,
      Attiva_Targhe: ce.attivaTargheOtticoAcustiche ? 'Sì' : 'No',
      Attiva_EVAC: ce.attivaEvac ? 'Sì' : 'No',
      Messaggio_EVAC: ce.messaggioEvac,
      Sgancio_Impianti: ce.sgancioImpiantiTecnologici ? 'Sì' : 'No',
      Chiusura_Porte_Tagliafuoco: ce.chiusuraPorteTagliafuoco ? 'Sì' : 'No',
      Ritardo_s: ce.ritardoSecondi,
    }))
  );

  const verifiche = esiti.map((e) => ({
    Codice: e.codice,
    Oggetto: e.targetLabel,
    Stato: e.stato,
    Valore_Calcolato: e.valoreCalcolato,
    Soglia_Attesa: e.sogliaAttesa,
    Norma: e.normaRiferimento,
    Deroga_Motivazione: e.motivazioneDeroga ?? '',
  }));

  if (formato === 'csv') {
    const ws = XLSX.utils.json_to_sheet(elencoCavi);
    const csv = XLSX.utils.sheet_to_csv(ws, { FS: ';' });
    downloadBlob(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      `${progetto.identificativi.commessa}_Elenco_Cavi_Protezioni.csv`
    );
    return;
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(elencoCavi), 'Elenco Cavi');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(elencoProtezioni), 'Elenco Protezioni');
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(causaEffetto.length ? causaEffetto : [{ Nota: 'Nessuna riga causa-effetto' }]),
    'Causa-Effetto IRAI'
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(verifiche), 'Verifiche Normative');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${progetto.identificativi.commessa}_Computo_Materiali.xlsx`
  );
}

export function esportaRelazioneTecnicaModificabile(
  progetto: ProgettoAntincendio,
  calcolo: RisultatoCalcoloCompleto,
  esiti: EsitoVerifica[]
) {
  const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8" />
<title>Relazione Tecnica di Calcolo - ${progetto.identificativi.commessa}</title>
<style>
  body { font-family: Arial, sans-serif; color: #0f172a; margin: 36px; line-height: 1.5; }
  h1 { font-size: 20px; border-bottom: 2px solid #1d4ed8; padding-bottom: 6px; }
  h2 { font-size: 15px; margin-top: 24px; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
  th { background: #f1f5f9; }
  .avviso { border: 1px solid #b91c1c; background: #fef2f2; color: #7f1d1d; padding: 10px 12px; font-size: 12px; margin-bottom: 18px; }
  .formula { font-family: Consolas, monospace; font-size: 11px; color: #334155; }
</style>
</head>
<body>
  <div class="avviso"><strong>${AVVISO_RESPONSABILITA_LEGALE}</strong></div>
  <h1>RELAZIONE TECNICA SPECIALISTICA DI CALCOLO — IMPIANTI ELETTRICI ANTINCENDIO</h1>
  <p><strong>Commessa:</strong> ${progetto.identificativi.commessa} | <strong>Cliente:</strong> ${progetto.identificativi.cliente}<br/>
  <strong>Sito:</strong> ${progetto.identificativi.sito} | <strong>Attività:</strong> ${progetto.attivitaNome} (Livello Prestazione: ${progetto.livelloPrestazione})<br/>
  <strong>Progettista:</strong> ${progetto.identificativi.progettista} | <strong>Revisione:</strong> ${progetto.identificativi.revisione} del ${progetto.identificativi.data}<br/>
  <strong>Tracciabilità Software:</strong> ElettroCAD Fire Systems ${calcolo.versioneApp} · Regole ${calcolo.versioneRegole} · Libreria ${calcolo.versioneLibreria}</p>

  <h2>1. Dati Generali di Fornitura e Riferimenti Normativi</h2>
  <p>Sistema di distribuzione: <strong>${progetto.fornitura.sistemaDistribuzione}</strong> · Tensione: <strong>${progetto.fornitura.tensioneNominaleV} V</strong> (${progetto.fornitura.tipoFornitura}) · Icc presunta al punto di consegna: <strong>${progetto.fornitura.iccPuntoConsegnaKa ?? 'Non inserita'} kA</strong> · Ambiente Ma.R.C.I.: <strong>${progetto.ambiente.ambienteMarci ? 'Sì' : 'No'}</strong> · IP richiesto: <strong>${progetto.ambiente.gradoIPRichiesto}</strong></p>
  <ul>
    ${progetto.norme.filter((n) => n.attivo).map((n) => `<li><strong>${n.codice}</strong> (${n.edizione}) — ${n.titolo}</li>`).join('')}
  </ul>

  <h2>2. Dimensionamento Linee Elettriche di Sicurezza e Formule Applicate</h2>
  <table>
    <thead>
      <tr><th>Sigla</th><th>Utenza</th><th>Ib (A)</th><th>Protezione</th><th>Cavo</th><th>Iz (A)</th><th>ΔV (%)</th></tr>
    </thead>
    <tbody>
      ${progetto.linee
        .map((l) => {
          const r = calcolo.linee[l.id];
          return `<tr>
            <td>${l.sigla}</td>
            <td>${l.descrizione}</td>
            <td>${r?.correnteImpiegoIbA ?? ''}</td>
            <td>${r?.siglaProtezioneCompleta ?? ''}</td>
            <td>${r?.siglaCavoCompleta ?? ''}</td>
            <td>${r?.portataCorrettaIzA ?? ''}</td>
            <td>${r?.cadutaTensionePct ?? ''}%</td>
          </tr>
          <tr><td colspan="7" class="formula">${r?.formuleDettaglio.join(' | ') ?? ''}</td></tr>`;
        })
        .join('')}
    </tbody>
  </table>

  <h2>3. Dimensionamento Sistemi IRAI (Autonomia Batterie e Loop)</h2>
  ${progetto.sistemiIrai
    .map((sys) => {
      const r = calcolo.irai[sys.id];
      return `<p><strong>${sys.sigla} — ${sys.nome}</strong>: Batteria installata ${sys.capacitaBatterieInstallataAh} Ah vs minima richiesta ${r?.capacitaBatterieMinimaAh ?? 0} Ah.<br/><span class="formula">${r?.formulaBatterie ?? ''}</span></p>`;
    })
    .join('')}

  <h2>4. Dimensionamento Sistemi EVAC (Amplificatori, Linee 100V e Batterie)</h2>
  ${progetto.sistemiEvac
    .map((sys) => {
      const r = calcolo.evac[sys.id];
      return `<p><strong>${sys.sigla} — ${sys.nome}</strong>: Amplificatori attivi ${r?.potenzaAmplificatoriAttiviW ?? 0} W vs richiesta con margine ${r?.potenzaRichiestaConMargineW ?? 0} W · Batteria installata ${sys.capacitaBatterieInstallataAh} Ah vs minima ${r?.capacitaBatterieMinimaAh ?? 0} Ah.<br/><span class="formula">${r?.formulaBatterie ?? ''}</span></p>`;
    })
    .join('')}

  <h2>5. Registro Verifiche Normative e Deroghe Motivate</h2>
  <table>
    <thead>
      <tr><th>Codice</th><th>Oggetto</th><th>Esito</th><th>Valore</th><th>Soglia</th><th>Norma / Motivazione Deroga</th></tr>
    </thead>
    <tbody>
      ${esiti
        .map(
          (e) => `<tr>
            <td>${e.codice}</td>
            <td>${e.targetLabel}</td>
            <td><strong>${e.stato.toUpperCase()}</strong></td>
            <td>${e.valoreCalcolato}</td>
            <td>${e.sogliaAttesa}</td>
            <td>${e.normaRiferimento}${e.derogata ? `<br/><em>DEROGA MOTIVATA: ${e.motivazioneDeroga}</em>` : ''}</td>
          </tr>`
        )
        .join('')}
    </tbody>
  </table>
</body>
</html>`;

  downloadBlob(
    new Blob([html], { type: 'application/msword;charset=utf-8' }),
    `${progetto.identificativi.commessa}_Relazione_Tecnica_Calcolo.doc`
  );
}

export async function importaLineeDaFoglio(
  file: File,
  quadroIdDefault: string
): Promise<LineaUtenza[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  return rows.map((row, idx) => {
    const pW = Number(row['Potenza_W'] ?? row['potenza'] ?? row['W'] ?? 500) || 500;
    const v = Number(row['Tensione_V'] ?? row['tensione'] ?? 230) || 230;
    const len = Number(row['Lunghezza_m'] ?? row['lunghezza'] ?? 25) || 25;
    return {
      id: `ln-imp-${Date.now()}-${idx}`,
      quadroId: quadroIdDefault,
      sigla: String(row['Sigla'] ?? row['sigla'] ?? `L${idx + 10}`),
      descrizione: String(row['Descrizione'] ?? row['descrizione'] ?? 'Utenza importata da foglio'),
      tipoUtenza: 'altro',
      potenzaNominaleW: pW,
      tensioneV: v,
      tipoFornitura: v >= 380 ? 'trifase' : 'monofase',
      cosPhi: Number(row['CosPhi'] ?? 0.9) || 0.9,
      rendimento: 0.9,
      tipoAvviamento: 'statico',
      rapportoIaIn: 1,
      coefficienteUtilizzoKu: 1,
      coefficienteContemporaneitaKc: 1,
      lunghezzaM: len,
      tipoPosa: 'canale_passerella',
      circuitiRaggruppati: 2,
      temperaturaPosaC: 30,
      resistenzaFuocoRichiesta: 'PH120',
      resistenzaFuocoCavoScelto: 'PH120',
      classeCPR: 'B2ca-s1a,d1,a1',
      percorsoProtetto: true,
      separataDaAltriImpianti: true,
      tipoProtezione: 'magnetotermico_differenziale',
      curvaProtezione: 'C',
      protezioneInManualeA: null,
      protezioneIcuKa: 10,
      differenzialeIdnMa: 30,
      sezioneManualeMm2: null,
      autonomiaBatterieOre: 24,
      tempoInterventoEmergenzaSec: 0,
      segnali: { allarme: true, guasto: true, marcia: false, mancanzaRete: true, comandiRemoti: false },
      simboloCodice: 'DM83-CENTRALE',
    };
  });
}

export function esportaPdfRiepilogoSistemaIrai(
  progetto: ProgettoAntincendio,
  sistema: SistemaIRAI,
  calcoloSistema: RisultatoCalcoloIRAI | undefined,
  calcoloCompleto: RisultatoCalcoloCompleto,
  esiti: EsitoVerifica[]
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  let y = 18;

  const drawFrame = () => {
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.35);
    doc.rect(8, 8, w - 16, h - 16);
    doc.setFontSize(6);
    doc.setTextColor(185, 28, 28);
    doc.text(AVVISO_RESPONSABILITA_LEGALE, 12, h - 14, { maxWidth: w - 24 });
  };

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > h - 24) {
      doc.addPage();
      drawFrame();
      y = 18;
    }
  };

  drawFrame();

  // Intestazione
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(`RIEPILOGO SISTEMA IRAI — ${sistema.sigla}`, 14, y);
  y += 6;
  doc.setFontSize(10.5);
  doc.setTextColor(29, 78, 216);
  doc.text(sistema.nome, 14, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Commessa: ${progetto.identificativi.commessa} · Cliente: ${progetto.identificativi.cliente}`,
    14,
    y
  );
  y += 4.5;
  doc.text(
    `Centrale: ${sistema.modelloCentrale} (${sistema.tensioneSistemaV}V CC) · Rev. ${progetto.identificativi.revisione} · Data ${progetto.identificativi.data}`,
    14,
    y
  );
  y += 4.5;
  doc.text(
    `App ${calcoloCompleto.versioneApp} · Regole ${calcoloCompleto.versioneRegole} · Libreria ${calcoloCompleto.versioneLibreria}`,
    14,
    y
  );
  y += 7;

  // 1. Anagrafica Zone
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`1. Anagrafica Zone (${sistema.zone.length})`, 14, y);
  y += 5;
  sistema.zone.forEach((z) => {
    ensureSpace(6);
    const nDisp = sistema.loop.reduce(
      (acc, l) => acc + l.dispositivi.filter((d) => d.zonaId === z.id).length,
      0
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`• ${z.codice} — ${z.nome} (${nDisp} dispositivi assegnati)`, 16, y);
    y += 4.8;
  });
  y += 3;

  // 2. Riepilogo Loop e Dispositivi
  ensureSpace(14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`2. Riepilogo Loop & Dispositivi (${sistema.loop.length} loop)`, 14, y);
  y += 5.5;

  sistema.loop.forEach((lp) => {
    ensureSpace(16);
    const lpRes = calcoloSistema?.loopRisultati.find((r) => r.loopId === lp.id);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(29, 78, 216);
    doc.text(
      `${lp.sigla} — ${lp.nome} (${lp.lunghezzaM} m, ${lp.sezioneCavoMm2} mm², ${lp.resistenzaFuoco})`,
      16,
      y
    );
    y += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(
      `Dispositivi: ${lp.dispositivi.length}/${lp.maxDispositiviConsentiti} · Iq=${lpRes?.correnteQuieteMa ?? 0} mA · Ia=${lpRes?.correnteAllarmeMa ?? 0} mA · ΔV=${lpRes?.cadutaTensioneLoopV ?? 0} V`,
      18,
      y
    );
    y += 4.5;

    lp.dispositivi.forEach((d) => {
      ensureSpace(5.5);
      const zCodice = sistema.zone.find((z) => z.id === d.zonaId)?.codice ?? '—';
      doc.setFontSize(7.2);
      doc.setTextColor(15, 23, 42);
      doc.text(
        `  #${String(d.indirizzo).padStart(2, '0')} [${d.sigla}] (${d.tipo.replace(/_/g, ' ')}) · Zona ${zCodice} · ${d.descrizione} · Iq/Ia: ${d.correnteQuieteMa}/${d.correnteAllarmeMa} mA`,
        18,
        y
      );
      y += 4.2;
    });
    y += 2.5;
  });

  // 3. Matrice Causa-Effetto
  ensureSpace(16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`3. Matrice Causa-Effetto (${sistema.causaEffetto.length} regole)`, 14, y);
  y += 5;
  if (sistema.causaEffetto.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Nessuna regola causa-effetto configurata.', 16, y);
    y += 5;
  } else {
    sistema.causaEffetto.forEach((ce) => {
      ensureSpace(8);
      const zCod = sistema.zone.find((z) => z.id === ce.causaZonaId)?.codice ?? '—';
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(
        `• [${zCod}] ${ce.causaDescrizione} => Targhe: ${ce.attivaTargheOtticoAcustiche ? 'Sì' : 'No'} | EVAC: ${ce.attivaEvac ? ce.messaggioEvac : 'No'} | Sgancio: ${ce.sgancioImpiantiTecnologici ? 'Sì' : 'No'} | Porte: ${ce.chiusuraPorteTagliafuoco ? 'Sì' : 'No'} | Ritardo: ${ce.ritardoSecondi}s`,
        16,
        y,
        { maxWidth: w - 30 }
      );
      y += 6.5;
    });
  }
  y += 2;

  // 4. Autonomia Batterie, Alimentatore & Verifiche
  ensureSpace(26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('4. Dimensionamento Batterie, Alimentatore & Verifiche', 14, y);
  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `Autonomia richiesta: ${sistema.autonomiaQuieteRichiestaOre}h quiete + ${sistema.autonomiaAllarmeRichiestaMin}min allarme · Batteria installata: ${sistema.capacitaBatterieInstallataAh} Ah (minima: ${calcoloSistema?.capacitaBatterieMinimaAh ?? 0} Ah)`,
    16,
    y
  );
  y += 4.5;
  doc.text(
    `Alimentatore installato: ${sistema.correnteAlimentatoreMaxA} A (minimo: ${calcoloSistema?.correnteAlimentatoreMinimaA ?? 0} A)`,
    16,
    y
  );
  y += 4.5;
  if (calcoloSistema?.formulaBatterie) {
    doc.setFontSize(7.2);
    doc.text(`Formula: ${calcoloSistema.formulaBatterie}`, 16, y);
    y += 5.5;
  }

  const esitiIrai = esiti.filter(
    (e) =>
      e.targetId === sistema.id ||
      sistema.loop.some((lp) => lp.id === e.targetId)
  );
  esitiIrai.forEach((es) => {
    ensureSpace(6);
    doc.setFontSize(7.5);
    doc.text(
      `[${es.stato.toUpperCase()}] ${es.codice} (${es.targetLabel}) — ${es.valoreCalcolato}`,
      16,
      y
    );
    y += 4.5;
  });

  doc.save(
    `${progetto.identificativi.commessa}_${sistema.sigla}_Riepilogo_IRAI.pdf`
  );
}

export function esportaExcelRiepilogoSistemaIrai(
  progetto: ProgettoAntincendio,
  sistema: SistemaIRAI,
  calcoloSistema: RisultatoCalcoloIRAI | undefined,
  esiti: EsitoVerifica[]
) {
  const wb = XLSX.utils.book_new();

  const riepilogoCentrale = [
    {
      Commessa: progetto.identificativi.commessa,
      Cliente: progetto.identificativi.cliente,
      Sigla_Sistema: sistema.sigla,
      Nome_Centrale: sistema.nome,
      Modello: sistema.modelloCentrale,
      Tensione_V: sistema.tensioneSistemaV,
      Numero_Loop: sistema.loop.length,
      Numero_Zone: sistema.zone.length,
      Corrente_Tot_Quiete_A: calcoloSistema?.correnteTotaleQuieteA ?? 0,
      Corrente_Tot_Allarme_A: calcoloSistema?.correnteTotaleAllarmeA ?? 0,
      Autonomia_Quiete_h: sistema.autonomiaQuieteRichiestaOre,
      Autonomia_Allarme_min: sistema.autonomiaAllarmeRichiestaMin,
      Batteria_Installata_Ah: sistema.capacitaBatterieInstallataAh,
      Batteria_Minima_Ah: calcoloSistema?.capacitaBatterieMinimaAh ?? 0,
      Alimentatore_Max_A: sistema.correnteAlimentatoreMaxA,
      Alimentatore_Min_A: calcoloSistema?.correnteAlimentatoreMinimaA ?? 0,
      Formula_Batterie: calcoloSistema?.formulaBatterie ?? '',
    },
  ];

  const anagraficaZone = sistema.zone.map((z) => ({
    Codice_Zona: z.codice,
    Nome_Zona: z.nome,
    Dispositivi_Assegnati: sistema.loop.reduce(
      (acc, l) => acc + l.dispositivi.filter((d) => d.zonaId === z.id).length,
      0
    ),
  }));

  const riepilogoLoop = sistema.loop.map((lp) => {
    const res = calcoloSistema?.loopRisultati.find((r) => r.loopId === lp.id);
    return {
      Sigla_Loop: lp.sigla,
      Nome_Loop: lp.nome,
      Lunghezza_m: lp.lunghezzaM,
      Sezione_mm2: lp.sezioneCavoMm2,
      Resistenza_Fuoco: lp.resistenzaFuoco,
      Dispositivi_Installati: lp.dispositivi.length,
      Max_Consentiti: lp.maxDispositiviConsentiti,
      Corrente_Quiete_mA: res?.correnteQuieteMa ?? 0,
      Corrente_Allarme_mA: res?.correnteAllarmeMa ?? 0,
      Caduta_Tensione_V: res?.cadutaTensioneLoopV ?? 0,
    };
  });

  const elencoDispositivi = sistema.loop.flatMap((lp) =>
    lp.dispositivi.map((d) => ({
      Loop: lp.sigla,
      Indirizzo: d.indirizzo,
      Sigla: d.sigla,
      Tipo_Componente: d.tipo,
      Zona: sistema.zone.find((z) => z.id === d.zonaId)?.codice ?? '—',
      Descrizione: d.descrizione,
      Iq_mA: d.correnteQuieteMa,
      Ia_mA: d.correnteAllarmeMa,
      Simbolo: d.simboloCodice,
    }))
  );

  const matriceCausaEffetto = sistema.causaEffetto.map((ce) => ({
    Zona_Causa: sistema.zone.find((z) => z.id === ce.causaZonaId)?.codice ?? '—',
    Descrizione_Causa: ce.causaDescrizione,
    Attiva_Targhe: ce.attivaTargheOtticoAcustiche ? 'Sì' : 'No',
    Attiva_EVAC: ce.attivaEvac ? 'Sì' : 'No',
    Messaggio_EVAC: ce.messaggioEvac,
    Sgancio_Impianti: ce.sgancioImpiantiTecnologici ? 'Sì' : 'No',
    Chiusura_Porte_Tagliafuoco: ce.chiusuraPorteTagliafuoco ? 'Sì' : 'No',
    Ritardo_s: ce.ritardoSecondi,
  }));

  const verificheSistema = esiti
    .filter(
      (e) =>
        e.targetId === sistema.id ||
        sistema.loop.some((lp) => lp.id === e.targetId)
    )
    .map((e) => ({
      Codice: e.codice,
      Oggetto: e.targetLabel,
      Stato: e.stato,
      Valore: e.valoreCalcolato,
      Soglia: e.sogliaAttesa,
      Norma: e.normaRiferimento,
    }));

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(riepilogoCentrale), 'Centrale & Batterie');
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(anagraficaZone.length ? anagraficaZone : [{ Nota: 'Nessuna zona' }]),
    'Anagrafica Zone'
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(riepilogoLoop), 'Riepilogo Loop');
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(elencoDispositivi.length ? elencoDispositivi : [{ Nota: 'Nessun dispositivo' }]),
    'Dispositivi IRAI'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(matriceCausaEffetto.length ? matriceCausaEffetto : [{ Nota: 'Nessuna regola' }]),
    'Causa-Effetto'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(verificheSistema.length ? verificheSistema : [{ Nota: 'Nessuna verifica' }]),
    'Verifiche IRAI'
  );

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${progetto.identificativi.commessa}_${sistema.sigla}_Riepilogo_IRAI.xlsx`
  );
}

