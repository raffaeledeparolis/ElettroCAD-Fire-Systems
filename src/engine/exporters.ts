import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import {
  ANAGRAFICA_COMPONENTI_IRAI_DEFAULT,
  AVVISO_RESPONSABILITA_LEGALE,
} from '../data/rulesAndLibrary';
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

  const lineeEvac = progetto.sistemiEvac.flatMap((sys) => {
    const rSys = calcolo.evac[sys.id];
    return sys.lineeAltoparlanti.map((ln) => {
      const rLn = rSys?.lineeRisultati.find((r) => r.lineaId === ln.id);
      return {
        Sistema: sys.sigla,
        Linea: ln.sigla,
        Zona: ln.zonaNome,
        Topologia: ln.topologia,
        Distribuzione: ln.distribuzioneCarico ?? 'concentrato',
        Tensione_V: ln.tensioneLineaV,
        Diffusori_pz: ln.numeroAltoparlanti,
        Potenza_W: ln.potenzaTotaleAltoparlantiW,
        Lunghezza_m: ln.lunghezzaM,
        Sezione_mm2: ln.sezioneMm2,
        Corrente_A: rLn?.correnteLineaA ?? 0,
        Caduta_V: rLn?.cadutaTensioneV ?? 0,
        Caduta_Pct: rLn?.cadutaTensionePct ?? 0,
        Soglia_Max_Pct: rLn?.sogliaMaxPct ?? 10,
        Attenuazione_dB: rLn?.attenuazioneDb ?? 0,
        Lunghezza_Max_m: rLn?.lunghezzaMassimaAmmissibileM ?? 0,
        Sezione_Consigliata_mm2: rLn?.sezioneMinimaConsigliataMm2 ?? ln.sezioneMm2,
        Esito: rLn?.conformeCadutaTensione ? 'Conforme' : 'Non conforme',
      };
    });
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(elencoCavi), 'Elenco Cavi');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(elencoProtezioni), 'Elenco Protezioni');
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(causaEffetto.length ? causaEffetto : [{ Nota: 'Nessuna riga causa-effetto' }]),
    'Causa-Effetto IRAI'
  );
  if (lineeEvac.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lineeEvac), 'Linee EVAC (ΔV)');
  }
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

  <h2>4. Dimensionamento Sistemi EVAC (Amplificatori, Linee 100V/70V e Batterie)</h2>
  ${progetto.sistemiEvac
    .map((sys) => {
      const r = calcolo.evac[sys.id];
      const righeLinee = sys.lineeAltoparlanti
        .map((ln) => {
          const rl = r?.lineeRisultati.find((x) => x.lineaId === ln.id);
          return `<tr>
            <td>${ln.sigla}</td>
            <td>${ln.zonaNome}</td>
            <td>${ln.topologia} / ${ln.distribuzioneCarico ?? 'concentrato'}</td>
            <td>${ln.tensioneLineaV} V</td>
            <td>${ln.potenzaTotaleAltoparlantiW} W (${ln.numeroAltoparlanti} pz)</td>
            <td>${ln.lunghezzaM} m · ${ln.sezioneMm2} mm²</td>
            <td>${rl?.correnteLineaA ?? 0} A</td>
            <td>${rl?.cadutaTensioneV ?? 0} V (${rl?.cadutaTensionePct ?? 0}% <= ${rl?.sogliaMaxPct ?? 10}%)</td>
            <td>${rl?.attenuazioneDb ?? 0} dB · Lmax ${rl?.lunghezzaMassimaAmmissibileM ?? 0} m</td>
            <td><strong>${rl?.conformeCadutaTensione ? 'CONFORME' : `NON CONFORME (min ${rl?.sezioneMinimaConsigliataMm2} mm²)`}</strong></td>
          </tr>
          <tr><td colspan="10" class="formula">${rl?.formulaDettaglio ?? ''}</td></tr>`;
        })
        .join('');
      return `<p><strong>${sys.sigla} — ${sys.nome}</strong>: Amplificatori attivi ${r?.potenzaAmplificatoriAttiviW ?? 0} W vs richiesta con margine ${r?.potenzaRichiestaConMargineW ?? 0} W · Batteria installata ${sys.capacitaBatterieInstallataAh} Ah vs minima ${r?.capacitaBatterieMinimaAh ?? 0} Ah.<br/><span class="formula">${r?.formulaBatterie ?? ''}</span></p>
      <table>
        <thead>
          <tr><th>Linea</th><th>Zona</th><th>Topologia / Carico</th><th>U</th><th>Potenza</th><th>L / Sez.</th><th>I</th><th>ΔV (V / %)</th><th>Att. / Lmax</th><th>Esito</th></tr>
        </thead>
        <tbody>${righeLinee}</tbody>
      </table>`;
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
    const totDispLp = lp.dispositivi.reduce((s, d) => s + Math.max(1, d.quantita ?? 1), 0);
    doc.text(
      `Dispositivi: ${totDispLp}/${lp.maxDispositiviConsentiti} · Iq=${lpRes?.correnteQuieteMa ?? 0} mA · Ia=${lpRes?.correnteAllarmeMa ?? 0} mA · ΔV=${lpRes?.cadutaTensioneLoopV ?? 0} V`,
      18,
      y
    );
    y += 4.5;

    lp.dispositivi.forEach((d) => {
      ensureSpace(5.5);
      const zCodice = sistema.zone.find((z) => z.id === d.zonaId)?.codice ?? '—';
      const qta = Math.max(1, d.quantita ?? 1);
      doc.setFontSize(7.2);
      doc.setTextColor(15, 23, 42);
      doc.text(
        `  #${String(d.indirizzo).padStart(2, '0')} [${d.sigla}] ×${qta} (${d.tipo.replace(/_/g, ' ')}) · Zona ${zCodice} · ${d.descrizione} · Iq/Ia unit.: ${d.correnteQuieteMa}/${d.correnteAllarmeMa} mA`,
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
      (acc, l) =>
        acc +
        l.dispositivi
          .filter((d) => d.zonaId === z.id)
          .reduce((s, d) => s + Math.max(1, d.quantita ?? 1), 0),
      0
    ),
  }));

  const riepilogoLoop = sistema.loop.map((lp) => {
    const res = calcoloSistema?.loopRisultati.find((r) => r.loopId === lp.id);
    const totDisp = lp.dispositivi.reduce((s, d) => s + Math.max(1, d.quantita ?? 1), 0);
    return {
      Sigla_Loop: lp.sigla,
      Nome_Loop: lp.nome,
      Lunghezza_m: lp.lunghezzaM,
      Sezione_mm2: lp.sezioneCavoMm2,
      Resistenza_Fuoco: lp.resistenzaFuoco,
      Dispositivi_Installati: totDisp,
      Max_Consentiti: lp.maxDispositiviConsentiti,
      Corrente_Quiete_mA: res?.correnteQuieteMa ?? 0,
      Corrente_Allarme_mA: res?.correnteAllarmeMa ?? 0,
      Caduta_Tensione_V: res?.cadutaTensioneLoopV ?? 0,
    };
  });

  const elencoDispositivi = sistema.loop.flatMap((lp) =>
    lp.dispositivi.map((d) => {
      const qta = Math.max(1, d.quantita ?? 1);
      return {
        Loop: lp.sigla,
        Indirizzo: d.indirizzo,
        Sigla: d.sigla,
        Codice_Articolo: d.codiceArticolo ?? '',
        Costruttore: d.costruttore ?? '',
        Modello: d.modello ?? '',
        Tipo_Componente: d.tipo,
        Zona: sistema.zone.find((z) => z.id === d.zonaId)?.codice ?? '—',
        Descrizione: d.descrizione,
        Quantita: qta,
        Iq_Unit_mA: d.correnteQuieteMa,
        Ia_Unit_mA: d.correnteAllarmeMa,
        Iq_Tot_mA: Number((d.correnteQuieteMa * qta).toFixed(2)),
        Ia_Tot_mA: Number((d.correnteAllarmeMa * qta).toFixed(2)),
        Simbolo: d.simboloCodice,
      };
    })
  );

  const anagraficaComponenti = (
    sistema.anagraficaComponenti ?? ANAGRAFICA_COMPONENTI_IRAI_DEFAULT
  ).map((c) => {
    const qtaInstallata = sistema.loop.reduce(
      (acc, lp) =>
        acc +
        lp.dispositivi
          .filter(
            (d) =>
              d.anagraficaComponenteId === c.id ||
              (d.codiceArticolo && d.codiceArticolo === c.codice)
          )
          .reduce((s, d) => s + Math.max(1, d.quantita ?? 1), 0),
      0
    );
    return {
      Codice_Articolo: c.codice,
      Costruttore: c.costruttore,
      Modello: c.modello,
      Tipologia: c.tipo,
      Norma_Riferimento: c.normaRiferimento,
      Iq_Unit_mA: c.correnteQuieteMa,
      Ia_Unit_mA: c.correnteAllarmeMa,
      Descrizione: c.descrizione,
      Quantita_Installata_Loop: qtaInstallata,
    };
  });

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
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      anagraficaComponenti.length ? anagraficaComponenti : [{ Nota: 'Nessun articolo in anagrafica' }]
    ),
    'Anagrafica Componenti'
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

// ============================================================================
// APPENDICE A (NORMATIVA) UNI 9795 — DOCUMENTAZIONE DI PROGETTO
// ============================================================================

interface VoceRegistroElaborato {
  codice: string;
  riferimentoAppendiceA: string;
  titolo: string;
  emissione: string;
  data: string;
  formato: string;
}

function costruisciRegistroElaboratiAppendiceA(
  progetto: ProgettoAntincendio
): VoceRegistroElaborato[] {
  const comm = progetto.identificativi.commessa || 'PRJ';
  const rev = progetto.identificativi.revisione || '00';
  const data = progetto.identificativi.data || '';
  return [
    {
      codice: `${comm}-A2-REL`,
      riferimentoAppendiceA: 'UNI 9795 App. A.2 (a, b, c)',
      titolo: 'Relazione Tecnico-Descrittiva Preliminare, Schema a Blocchi e Dichiarazione di Conformità',
      emissione: rev,
      data,
      formato: 'DOC / PDF',
    },
    {
      codice: `${comm}-A32-SCH`,
      riferimentoAppendiceA: 'UNI 9795 App. A.3.2 (a ÷ i)',
      titolo: 'Scheda Riassuntiva di Progetto, Registro Elaborati e Elenco Completo Componenti',
      emissione: rev,
      data,
      formato: 'DOC / PDF / XLSX',
    },
    {
      codice: `${comm}-A33-REL`,
      riferimentoAppendiceA: 'UNI 9795 App. A.3.3',
      titolo: 'Relazione Tecnico-Descrittiva Esecutiva, Calcolo Autonomie e Dimensionamento Cavi',
      emissione: rev,
      data,
      formato: 'DOC / PDF',
    },
    {
      codice: `${comm}-A34-BLK`,
      riferimentoAppendiceA: 'UNI 9795 App. A.3.4',
      titolo: 'Schema a Blocchi di Sistema e Schema Funzionale Particolareggiato (Matrice Causa-Effetto)',
      emissione: rev,
      data,
      formato: 'DXF R2000',
    },
    {
      codice: `${comm}-A35-UNI`,
      riferimentoAppendiceA: 'UNI 9795 App. A.3.5 / CEI 0-2',
      titolo: 'Schema Unifilare Quadro Antincendio, Fronte Quadro, Morsettiera ed Elenco Cavi',
      emissione: rev,
      data,
      formato: 'DXF R2000 / PDF',
    },
    {
      codice: `${comm}-A36-ALM`,
      riferimentoAppendiceA: 'UNI 9795 App. A.3.6.1 & A.3.6.2',
      titolo: 'Schemi Alimentazione Elettrica Primaria (Origine/Protezioni) e Secondaria (UPS/Batterie)',
      emissione: rev,
      data,
      formato: 'DXF R2000',
    },
  ];
}

function buildAppendiceAHtmlShell(titolo: string, commessa: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8" />
<title>${titolo} - ${commessa}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 28px; line-height: 1.45; font-size: 12px; }
  h1 { font-size: 18px; border-bottom: 2px solid #1d4ed8; padding-bottom: 6px; margin-bottom: 8px; }
  h2 { font-size: 13.5px; margin-top: 20px; color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; }
  h3 { font-size: 12px; margin-top: 12px; color: #0f172a; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; font-weight: bold; }
  .avviso { border: 1px solid #b91c1c; background: #fef2f2; color: #7f1d1d; padding: 8px 10px; font-size: 10.5px; margin-bottom: 14px; }
  .meta { background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px 12px; margin-bottom: 14px; font-size: 11.5px; }
  .box { border: 1px solid #94a3b8; background: #ffffff; padding: 10px 12px; margin-top: 8px; }
  .mono { font-family: Consolas, monospace; font-size: 10.5px; }
  .ok { color: #15803d; font-weight: bold; }
  .warn { color: #b91c1c; font-weight: bold; }
</style>
</head>
<body>
  <div class="avviso"><strong>${AVVISO_RESPONSABILITA_LEGALE}</strong></div>
  ${bodyHtml}
</body>
</html>`;
}

function creaPdfAppendiceABuilder(
  progetto: ProgettoAntincendio,
  calcolo: RisultatoCalcoloCompleto,
  titoloPrincipale: string,
  riferimentoNorma: string
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  let y = 20;
  let pageNum = 1;

  const drawFrame = () => {
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.35);
    doc.rect(8, 8, w - 16, h - 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `${progetto.identificativi.commessa} | ${riferimentoNorma} | Rev. ${progetto.identificativi.revisione} (${progetto.identificativi.data}) | App ${calcolo.versioneApp}`,
      12,
      12.5
    );
    doc.text(`Pag. ${pageNum}`, w - 12, 12.5, { align: 'right' });
    doc.setFontSize(5.8);
    doc.setTextColor(185, 28, 28);
    doc.text(AVVISO_RESPONSABILITA_LEGALE, 12, h - 13.5, { maxWidth: w - 24 });
  };

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > h - 22) {
      doc.addPage();
      pageNum += 1;
      drawFrame();
      y = 19;
    }
  };

  const addHeading = (title: string) => {
    ensureSpace(12);
    y += 2;
    doc.setFillColor(241, 245, 249);
    doc.rect(12, y - 4.2, w - 24, 6.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 58, 138);
    doc.text(title, 14, y);
    y += 5.5;
  };

  const addParagraph = (text: string, bold = false, fontSize = 8, indent = 14) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(15, 23, 42);
    const maxW = w - indent - 12;
    const lines = doc.splitTextToSize(text, maxW) as string[];
    const step = fontSize * 0.48 + 0.5;
    lines.forEach((ln) => {
      ensureSpace(step + 1);
      doc.text(ln, indent, y);
      y += step;
    });
    y += 1.2;
  };

  const addBullets = (items: string[], fontSize = 7.8) => {
    items.forEach((it) => addParagraph(`• ${it}`, false, fontSize, 16));
  };

  drawFrame();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(15, 23, 42);
  doc.text(titoloPrincipale, 12, y, { maxWidth: w - 24 });
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Commessa: ${progetto.identificativi.commessa} | Cliente: ${progetto.identificativi.cliente} | Sito: ${progetto.identificativi.sito}`,
    12,
    y
  );
  y += 4.5;
  doc.text(
    `Progettista: ${progetto.identificativi.progettista} | Attività: ${progetto.attivitaNome} (Livello Prestazione: ${progetto.livelloPrestazione})`,
    12,
    y
  );
  y += 6;

  return { doc, addHeading, addParagraph, addBullets };
}

export function esportaAppendiceA_RelazionePreliminareA2(
  progetto: ProgettoAntincendio,
  calcolo: RisultatoCalcoloCompleto,
  esiti: EsitoVerifica[],
  formato: 'doc' | 'pdf' = 'doc'
) {
  const nonConformi = esiti.filter((e) => e.stato === 'non_conforme' && !e.derogata);
  const deroghe = progetto.deroghe.filter((d) => d.disattivata || d.motivazione.trim().length > 0);
  const haScostamenti = nonConformi.length > 0 || deroghe.length > 0;
  const totSensoriIrai = progetto.sistemiIrai.reduce(
    (acc, s) =>
      acc +
      s.loop.reduce(
        (a, l) =>
          a + l.dispositivi.reduce((sd, d) => sd + Math.max(1, d.quantita ?? 1), 0),
        0
      ),
    0
  );
  const totDiffEvac = progetto.sistemiEvac.reduce(
    (acc, s) => acc + s.lineeAltoparlanti.reduce((a, l) => a + l.numeroAltoparlanti, 0),
    0
  );

  if (formato === 'pdf') {
    const { doc, addHeading, addParagraph, addBullets } = creaPdfAppendiceABuilder(
      progetto,
      calcolo,
      'RELAZIONE TECNICO-DESCRITTIVA PRELIMINARE (UNI 9795 — APPENDICE A.2)',
      'UNI 9795 Appendice A.2 (a, b, c)'
    );

    addHeading('A.2 a) Tipologia, Consistenza degli Impianti e Schema a Blocchi Preliminare');
    addParagraph(
      `Il presente progetto preliminare / di massima riguarda gli impianti elettrici di sicurezza e rivelazione incendio presso "${progetto.identificativi.sito}" (${progetto.attivitaNome}), dimensionati per Livello di Prestazione ${progetto.livelloPrestazione} (D.M. 03/08/2015 e s.m.i. / UNI 9795).`
    );
    addBullets([
      `Sistemi IRAI (Rivelazione e Allarme Incendio): ${progetto.sistemiIrai.length} centrale/i (${progetto.sistemiIrai.map((s) => `${s.sigla} ${s.modelloCentrale}`).join(', ') || 'Nessuna'}), ${progetto.sistemiIrai.reduce((a, s) => a + s.zone.length, 0)} zone di rivelazione, ${progetto.sistemiIrai.reduce((a, s) => a + s.loop.length, 0)} loop indirizzati, ${totSensoriIrai} dispositivi di campo complessivi.`,
      `Sistemi EVAC (Evacuazione Vocale EN 54-16): ${progetto.sistemiEvac.length} centrale/i (${progetto.sistemiEvac.map((s) => `${s.sigla} ${s.modelloCentrale}`).join(', ') || 'Nessuna'}), ${totDiffEvac} diffusori su linee a tensione costante 100V/70V.`,
      `Alimentazioni Elettriche di Sicurezza (CEI 64-8 Cap. 56): ${progetto.sorgenti.length} sorgente/i (${progetto.sorgenti.map((s) => `${s.sigla} ${s.tipo}`).join(', ')}), ${progetto.quadri.length} quadro/i antincendio (${progetto.quadri.map((q) => q.sigla).join(', ')}), ${progetto.linee.length} linee dedicate resistenti al fuoco (UPS consigliato ${calcolo.upsKvaConsigliato} kVA).`,
    ]);

    addParagraph('Schema a Blocchi Funzionale-Logico Preliminare:', true);
    addBullets([
      '[Campo Rivelazione: Rivelatori Ottici/Termici + Pulsanti Manuali + Moduli Ingresso] ===(Loop PH30/PH120)===> [Centrale IRAI EN 54-2 / EN 54-4 + Batterie 24h+30m]',
      '[Alimentazione Primaria: Derivazione a Monte I.G. + Quadro Antincendio + UPS Sicurezza] ===(Linee PH120)===> [Centrali IRAI, EVAC e Apparati Ausiliari]',
      '[Centrale IRAI] ===(Matrice Causa-Effetto / Cavi PH120)===> [Targhe Ottico-Acustiche | Centrale EVAC & Diffusori | Sgancio Impianti Tecnologici | Porte REI]',
    ]);

    addHeading('A.2 b) Quadro di Inquadramento del Fabbricato (Dati per Tavole Grafiche)');
    addBullets([
      `Tipo di installazione prevalente e ambiente: ${progetto.ambiente.tipoLocale.replace(/_/g, ' ')} — Temperatura ambiente ${progetto.ambiente.temperaturaAmbienteC} °C — Grado protezione min. ${progetto.ambiente.gradoIPRichiesto} — Ambiente Ma.R.C.I.: ${progetto.ambiente.ambienteMarci ? 'SI' : 'NO'}.`,
      `Estensione del sistema ed eventuali aree non protette: sorveglianza estesa alle zone configurate (${progetto.sistemiIrai.flatMap((s) => s.zone.map((z) => `${z.codice} ${z.nome}`)).join('; ') || 'da definire in planimetria'}); eventuali spazi esclusi ai sensi UNI 9795 (es. vani tecnici non combustibili < limite normativo) dovranno essere campiti graficamente nelle tavole di layout A.3.5.`,
      `Destinazione d'uso delle aree servite (Zone IRAI & EVAC): ${[...progetto.sistemiIrai.flatMap((s) => s.zone.map((z) => `${z.codice}: ${z.nome}`)), ...progetto.sistemiEvac.flatMap((s) => s.lineeAltoparlanti.map((l) => `${l.sigla}: ${l.zonaNome}`))].join(' | ') || 'Da specificare'}.`,
      `Indicazioni per sezione trasversale esemplificativa: verificare nelle tavole architettoniche le quote di installazione rivelatori a soffitto, l'eventuale presenza di controsoffitti > 800 mm o pavimenti sopraelevati con rivelazione dedicata, e la posa protetta dei cavi resistenti al fuoco (CEI 20-105).`,
    ]);

    addHeading('A.2 c) Dichiarazione di Conformità Progettuale alla UNI 9795 / Eventuali Scostamenti');
    if (!haScostamenti) {
      addParagraph(
        `DICHIARAZIONE DI CONFORMITÀ PROGETTUALE: Sulla base dei dati di progetto inseriti in fase preliminare, l'impianto risulta progettato in conformità ai requisiti applicabili della norma UNI 9795 (non risultano scostamenti o deroghe attive). Resta fermo l'obbligo di validazione finale a firma del professionista abilitato.`
      );
    } else {
      addParagraph(
        `CRITERI DI SCOSTAMENTO E MOTIVAZIONI: Sono rilevati scostamenti / deroghe rispetto alle verifiche automatiche o ai criteri standard UNI 9795:`
      );
      deroghe.forEach((d) =>
        addParagraph(`• Deroga regola ${d.regolaId} (${d.targetId}): ${d.motivazione} [Autore: ${d.autore} - ${d.data}]`, false, 7.6, 16)
      );
      nonConformi.forEach((nc) =>
        addParagraph(`• Non conformità aperta ${nc.codice} (${nc.targetLabel}): ${nc.messaggio} [Calcolato: ${nc.valoreCalcolato} vs ${nc.sogliaAttesa}]`, false, 7.6, 16)
      );
    }

    doc.save(`${progetto.identificativi.commessa}_A2_Relazione_Preliminare.pdf`);
    return;
  }

  const body = `
    <h1>RELAZIONE TECNICO-DESCRITTIVA PRELIMINARE (UNI 9795 — APPENDICE A.2)</h1>
    <div class="meta">
      <strong>Commessa:</strong> ${progetto.identificativi.commessa} | <strong>Cliente:</strong> ${progetto.identificativi.cliente}<br/>
      <strong>Sito / Attività:</strong> ${progetto.identificativi.sito} — ${progetto.attivitaNome} (Livello Prestazione: <strong>${progetto.livelloPrestazione}</strong>)<br/>
      <strong>Progettista:</strong> ${progetto.identificativi.progettista} | <strong>Rev.:</strong> ${progetto.identificativi.revisione} del ${progetto.identificativi.data}
    </div>

    <h2>A.2 a) Tipologia, Consistenza degli Impianti e Schema a Blocchi Preliminare</h2>
    <p>Il progetto preliminare definisce l'architettura degli impianti di rivelazione automatica incendi (IRAI), evacuazione vocale (EVAC) e relative alimentazioni elettriche di sicurezza secondo UNI 9795 e Codice di Prevenzione Incendi.</p>
    <ul>
      <li><strong>Sistemi IRAI:</strong> ${progetto.sistemiIrai.length} centrale/i (${progetto.sistemiIrai.map((s) => `${s.sigla} — ${s.modelloCentrale}`).join(', ')}), ${progetto.sistemiIrai.reduce((a, s) => a + s.zone.length, 0)} zone di rivelazione, ${progetto.sistemiIrai.reduce((a, s) => a + s.loop.length, 0)} loop e ${totSensoriIrai} dispositivi di campo.</li>
      <li><strong>Sistemi EVAC:</strong> ${progetto.sistemiEvac.length} centrale/i (${progetto.sistemiEvac.map((s) => `${s.sigla} — ${s.modelloCentrale}`).join(', ')}), ${totDiffEvac} diffusori su linee 100V/70V.</li>
      <li><strong>Alimentazioni Elettriche:</strong> ${progetto.sorgenti.length} sorgente/i (${progetto.sorgenti.map((s) => s.sigla).join(', ')}), ${progetto.quadri.length} quadro/i antincendio (${progetto.quadri.map((q) => q.sigla).join(', ')}), ${progetto.linee.length} linee dedicate (UPS consigliato: ${calcolo.upsKvaConsigliato} kVA).</li>
    </ul>
    <div class="box mono">
      <strong>SCHEMA A BLOCCHI PRELIMINARE:</strong><br/>
      [Rivelatori + Pulsanti + Moduli IN] ==(Loop PH30/PH120)==&gt; [Centrale IRAI EN 54-2/4 + Batterie]<br/>
      [Fornitura a Monte I.G. + Quadro Antincendio + UPS] ==(Linee PH120)==&gt; [Centrali IRAI / EVAC]<br/>
      [Centrale IRAI] ==(Matrice Causa-Effetto)==&gt; [Targhe O/A | Sistema EVAC | Sganci Tecnologici | Porte REI]
    </div>

    <h2>A.2 b) Dati per Tavole Grafiche di Inquadramento del Fabbricato</h2>
    <table>
      <tr><th>Parametro UNI 9795 A.2 b)</th><th>Specifica di Progetto</th></tr>
      <tr><td>Tipi di installazione e ambiente</td><td>Locale ${progetto.ambiente.tipoLocale.replace(/_/g, ' ')}, T<sub>amb</sub> = ${progetto.ambiente.temperaturaAmbienteC} °C, IP min. ${progetto.ambiente.gradoIPRichiesto}, Ambiente Ma.R.C.I.: ${progetto.ambiente.ambienteMarci ? 'Sì' : 'No'}</td></tr>
      <tr><td>Estensione del sistema ed eventuali aree non protette</td><td>Estensione alle zone configurate (${progetto.sistemiIrai.flatMap((s) => s.zone.map((z) => `${z.codice} ${z.nome}`)).join('; ') || 'N.D.'}). Eventuali aree escluse ai sensi UNI 9795 devono essere chiaramente delimitate sulle planimetrie di inquadramento.</td></tr>
      <tr><td>Destinazione d'uso delle aree</td><td>Zone IRAI: ${progetto.sistemiIrai.flatMap((s) => s.zone.map((z) => `${z.codice} (${z.nome})`)).join(', ') || '—'}<br/>Zone EVAC: ${progetto.sistemiEvac.flatMap((s) => s.lineeAltoparlanti.map((l) => `${l.sigla} (${l.zonaNome})`)).join(', ') || '—'}</td></tr>
      <tr><td>Sezione trasversale esemplificativa</td><td>Da allegare tavola grafica con quote soffitto, intercapedini/controsoffitti e pavimenti sopraelevati, altezza utile posa rivelatori e percorsi cavi protetti.</td></tr>
    </table>

    <h2>A.2 c) Dichiarazione di Conformità Progettuale alla UNI 9795 o Scostamenti</h2>
    ${
      !haScostamenti
        ? `<div class="box ok">DICHIARAZIONE DI CONFORMITÀ PROGETTUALE: L'impianto preliminare risulta progettato in conformità ai criteri della norma UNI 9795 e alle verifiche normative di riferimento. Non risultano scostamenti o deroghe attive.</div>`
        : `<div class="box warn">CRITERI DI SCOSTAMENTO / DEROGHE RILEVATE:</div>
           <ul>
             ${deroghe.map((d) => `<li><strong>Deroga ${d.regolaId} (${d.targetId}):</strong> ${d.motivazione} (${d.autore}, ${d.data})</li>`).join('')}
             ${nonConformi.map((nc) => `<li><strong>Scostamento ${nc.codice} (${nc.targetLabel}):</strong> ${nc.messaggio} [${nc.valoreCalcolato} vs ${nc.sogliaAttesa}]</li>`).join('')}
           </ul>`
    }
  `;

  downloadBlob(
    new Blob(
      [buildAppendiceAHtmlShell('Relazione Preliminare UNI 9795 A.2', progetto.identificativi.commessa, body)],
      { type: 'application/msword;charset=utf-8' }
    ),
    `${progetto.identificativi.commessa}_A2_Relazione_Preliminare.doc`
  );
}

export function esportaAppendiceA_SchedaRiassuntivaA32(
  progetto: ProgettoAntincendio,
  calcolo: RisultatoCalcoloCompleto,
  esiti: EsitoVerifica[],
  formato: 'doc' | 'pdf' = 'doc'
) {
  const registro = costruisciRegistroElaboratiAppendiceA(progetto);
  const nonConformi = esiti.filter((e) => e.stato === 'non_conforme' && !e.derogata);
  const deroghe = progetto.deroghe.filter((d) => d.disattivata || d.motivazione.trim().length > 0);

  if (formato === 'pdf') {
    const { doc, addHeading, addParagraph, addBullets } = creaPdfAppendiceABuilder(
      progetto,
      calcolo,
      'SCHEDA RIASSUNTIVA DI PROGETTO (UNI 9795 — APPENDICE A.3.2)',
      'UNI 9795 Appendice A.3.2 (a ÷ i)'
    );

    addHeading('A.3.2 a) Identificazione Progetto e Progettista');
    addBullets([
      `Nome progetto / Titolo: ${progetto.identificativi.titoloTavola} (${progetto.attivitaNome})`,
      `Commessa: ${progetto.identificativi.commessa} | Cliente: ${progetto.identificativi.cliente} | Sito: ${progetto.identificativi.sito}`,
      `Progettista: ${progetto.identificativi.progettista} | Studio: ${progetto.identificativi.logoTestoStudio}`,
    ]);

    addHeading('A.3.2 b÷e) Registro Numeri di Riferimento, Emissione, Date e Titoli Elaborati');
    addBullets(
      registro.map(
        (r) => `[${r.codice}] Rev. ${r.emissione} (${r.data}) — ${r.titolo} [${r.riferimentoAppendiceA} · ${r.formato}]`
      ),
      7.5
    );

    addHeading('A.3.2 f÷g) Tipi di Impianto, Modelli e Riferimenti delle Centrali');
    progetto.sistemiIrai.forEach((s) => {
      const r = calcolo.irai[s.id];
      addParagraph(
        `• IRAI [${s.sigla}] "${s.nome}" — Modello: ${s.modelloCentrale} (${s.tensioneSistemaV}V CC) · ${s.loop.length} loop, ${s.zone.length} zone · Batt. ${s.capacitaBatterieInstallataAh}Ah (min ${r?.capacitaBatterieMinimaAh ?? 0}Ah)`,
        false,
        7.8,
        16
      );
    });
    progetto.sistemiEvac.forEach((s) => {
      const r = calcolo.evac[s.id];
      addParagraph(
        `• EVAC [${s.sigla}] "${s.nome}" — Modello: ${s.modelloCentrale} · Amplificatori attivi ${r?.potenzaAmplificatoriAttiviW ?? 0}W (${s.lineeAltoparlanti.length} linee) · Batt. ${s.capacitaBatterieInstallataAh}Ah (min ${r?.capacitaBatterieMinimaAh ?? 0}Ah)`,
        false,
        7.8,
        16
      );
    });
    progetto.quadri.forEach((q) => {
      addParagraph(
        `• Quadro Elettrico [${q.sigla}] "${q.nome}" — ${q.tensioneV}V ${q.tipoFornitura}, ${q.gradoIP}, ${q.formaSegregazione}, I.G. ${q.interruttoreGeneraleInA}A (${q.interruttoreGeneraleIcuKa}kA)`,
        false,
        7.8,
        16
      );
    });

    addHeading('A.3.2 h/k) Dichiarazione di Conformità alla UNI 9795 / Informazioni sugli Scostamenti');
    if (nonConformi.length === 0 && deroghe.length === 0) {
      addParagraph(
        'DICHIARAZIONE DI CONFORMITÀ: Il progetto definitivo/esecutivo soddisfa integralmente tutte le verifiche normative UNI 9795 / CEI 64-8 configurate senza scostamenti.'
      );
    } else {
      addParagraph('SCOSTAMENTI / DEROGHE MOTIVATE:');
      deroghe.forEach((d) =>
        addParagraph(`• Deroga ${d.regolaId} su ${d.targetId}: ${d.motivazione} (${d.autore}, ${d.data})`, false, 7.6, 16)
      );
      nonConformi.forEach((nc) =>
        addParagraph(`• Non conforme ${nc.codice} (${nc.targetLabel}): ${nc.messaggio}`, false, 7.6, 16)
      );
    }

    addHeading('A.3.2 i) Elenco Completo dei Componenti Inclusi nel Sistema');
    progetto.linee.forEach((l) => {
      const res = calcolo.linee[l.id];
      addParagraph(
        `• Linea [${l.sigla}] ${l.descrizione}: Protezione ${res?.siglaProtezioneCompleta ?? ''} | Cavo ${res?.siglaCavoCompleta ?? ''} (${l.lunghezzaM} m)`,
        false,
        7.4,
        16
      );
    });
    progetto.sistemiIrai.forEach((s) =>
      s.loop.forEach((lp) => {
        addParagraph(
          `• IRAI ${s.sigla} / ${lp.sigla} (${lp.lunghezzaM}m, ${lp.sezioneCavoMm2}mm², ${lp.resistenzaFuoco}): ${lp.dispositivi.map((d) => `#${d.indirizzo} ${d.sigla} ×${Math.max(1, d.quantita ?? 1)} (${d.tipo.replace(/_/g, ' ')})`).join(', ') || 'Nessun dispositivo'}`,
          false,
          7.2,
          16
        );
      })
    );
    progetto.sistemiEvac.forEach((s) => {
      s.amplificatori.forEach((a) =>
        addParagraph(
          `• EVAC ${s.sigla} Amplificatore [${a.sigla}] ${a.modello}: ${a.potenzaNominaleW} W (${a.diRiserva ? 'Riserva' : 'Attivo'})`,
          false,
          7.4,
          16
        )
      );
    });

    doc.save(`${progetto.identificativi.commessa}_A32_Scheda_Riassuntiva.pdf`);
    return;
  }

  const body = `
    <h1>SCHEDA RIASSUNTIVA DI PROGETTO (UNI 9795 — APPENDICE A.3.2)</h1>
    <h2>A.3.2 a) Dati Progetto e Progettista</h2>
    <table>
      <tr><th>Nome Progetto / Titolo</th><td>${progetto.identificativi.titoloTavola} (${progetto.attivitaNome})</td><th>Commessa</th><td>${progetto.identificativi.commessa}</td></tr>
      <tr><th>Cliente / Sito</th><td>${progetto.identificativi.cliente} — ${progetto.identificativi.sito}</td><th>Livello Prestazione</th><td>${progetto.livelloPrestazione}</td></tr>
      <tr><th>Progettista</th><td>${progetto.identificativi.progettista}</td><th>Studio / Rev.</th><td>${progetto.identificativi.logoTestoStudio} · Rev. ${progetto.identificativi.revisione} (${progetto.identificativi.data})</td></tr>
    </table>

    <h2>A.3.2 b÷e) Registro Disegni e Documenti di Progetto</h2>
    <table>
      <thead><tr><th>N. Riferimento</th><th>N. Emissione</th><th>Data</th><th>Titolo Documento / Disegno</th><th>Rif. Appendice A</th><th>Formato</th></tr></thead>
      <tbody>
        ${registro
          .map(
            (r) =>
              `<tr><td class="mono">${r.codice}</td><td>${r.emissione}</td><td>${r.data}</td><td>${r.titolo}</td><td>${r.riferimentoAppendiceA}</td><td>${r.formato}</td></tr>`
          )
          .join('')}
      </tbody>
    </table>

    <h2>A.3.2 f÷g) Centrali di Controllo, Segnalazione e Quadri</h2>
    <table>
      <thead><tr><th>Tipo Impianto</th><th>Sigla / Rif.</th><th>Modello / Denominazione</th><th>Specifiche Principali</th></tr></thead>
      <tbody>
        ${progetto.sistemiIrai
          .map((s) => {
            const r = calcolo.irai[s.id];
            return `<tr><td>IRAI (Rivelazione Incendio)</td><td class="mono">${s.sigla}</td><td>${s.modelloCentrale} — ${s.nome}</td><td>${s.tensioneSistemaV}V CC, ${s.loop.length} loop, ${s.zone.length} zone, Batt. ${s.capacitaBatterieInstallataAh} Ah (min ${r?.capacitaBatterieMinimaAh ?? 0} Ah)</td></tr>`;
          })
          .join('')}
        ${progetto.sistemiEvac
          .map((s) => {
            const r = calcolo.evac[s.id];
            return `<tr><td>EVAC (Evacuazione Vocale)</td><td class="mono">${s.sigla}</td><td>${s.modelloCentrale} — ${s.nome}</td><td>Amplif. attivi ${r?.potenzaAmplificatoriAttiviW ?? 0} W, ${s.lineeAltoparlanti.length} linee 100V/70V, Batt. ${s.capacitaBatterieInstallataAh} Ah</td></tr>`;
          })
          .join('')}
        ${progetto.quadri
          .map(
            (q) =>
              `<tr><td>Quadro Elettrico Sicurezza</td><td class="mono">${q.sigla}</td><td>${q.nome}</td><td>${q.tensioneV}V ${q.tipoFornitura}, ${q.gradoIP}, ${q.formaSegregazione}, I.G. ${q.interruttoreGeneraleInA}A (${q.interruttoreGeneraleIcuKa} kA)</td></tr>`
          )
          .join('')}
      </tbody>
    </table>

    <h2>A.3.2 h/k) Dichiarazione di Conformità Progettuale alla UNI 9795 o Scostamenti</h2>
    ${
      nonConformi.length === 0 && deroghe.length === 0
        ? `<div class="box ok">Il progetto risulta conforme alla norma UNI 9795 e alle verifiche tecniche applicabili senza scostamenti.</div>`
        : `<div class="box warn">Sono presenti scostamenti o deroghe motivate rispetto ai requisiti normativi:</div>
           <ul>
             ${deroghe.map((d) => `<li><strong>Deroga ${d.regolaId} (${d.targetId}):</strong> ${d.motivazione} — ${d.autore} (${d.data})</li>`).join('')}
             ${nonConformi.map((nc) => `<li><strong>Non conforme ${nc.codice} (${nc.targetLabel}):</strong> ${nc.messaggio} (${nc.valoreCalcolato} vs ${nc.sogliaAttesa})</li>`).join('')}
           </ul>`
    }

    <h2>A.3.2 i) Elenco Completo dei Componenti Inclusi nel Sistema</h2>
    <h3>Linee Elettriche, Protezioni e Cavi</h3>
    <table>
      <thead><tr><th>Sigla</th><th>Descrizione</th><th>Protezione</th><th>Cavo / Resistenza Fuoco / CPR</th><th>Lunghezza</th></tr></thead>
      <tbody>
        ${progetto.linee
          .map((l) => {
            const r = calcolo.linee[l.id];
            return `<tr><td class="mono">${l.sigla}</td><td>${l.descrizione}</td><td>${r?.siglaProtezioneCompleta ?? ''}</td><td>${r?.siglaCavoCompleta ?? ''}</td><td>${l.lunghezzaM} m</td></tr>`;
          })
          .join('')}
      </tbody>
    </table>

    <h3>Componenti di Campo IRAI (Rivelatori, Pulsanti, Moduli, Targhe)</h3>
    <table>
      <thead><tr><th>Centrale / Loop</th><th>Indirizzo</th><th>Sigla</th><th>Tipo Componente</th><th>Zona</th><th>Descrizione</th><th>Q.tà</th><th>Iq / Ia Tot (mA)</th></tr></thead>
      <tbody>
        ${progetto.sistemiIrai
          .flatMap((s) =>
            s.loop.flatMap((lp) =>
              lp.dispositivi.map((d) => {
                const zCod = s.zone.find((z) => z.id === d.zonaId)?.codice ?? '—';
                const qta = Math.max(1, d.quantita ?? 1);
                return `<tr><td class="mono">${s.sigla} / ${lp.sigla}</td><td>#${d.indirizzo}</td><td class="mono">${d.sigla}</td><td>${d.tipo.replace(/_/g, ' ')}</td><td>${zCod}</td><td>${d.descrizione}</td><td>${qta}</td><td>${(d.correnteQuieteMa * qta).toFixed(2)} / ${(d.correnteAllarmeMa * qta).toFixed(1)}</td></tr>`;
              })
            )
          )
          .join('')}
      </tbody>
    </table>

    <h3>Componenti EVAC & Sorgenti di Sicurezza</h3>
    <table>
      <thead><tr><th>Sistema</th><th>Sigla</th><th>Modello / Tipologia</th><th>Dati Tecnici</th></tr></thead>
      <tbody>
        ${progetto.sistemiEvac
          .flatMap((s) =>
            s.amplificatori.map(
              (a) =>
                `<tr><td>${s.sigla} (Amplif.)</td><td class="mono">${a.sigla}</td><td>${a.modello}</td><td>${a.potenzaNominaleW} W — ${a.diRiserva ? 'Amplificatore di Riserva' : 'Amplificatore Attivo'}</td></tr>`
            )
          )
          .join('')}
        ${progetto.sorgenti
          .map(
            (src) =>
              `<tr><td>Sorgente</td><td class="mono">${src.sigla}</td><td>${src.nome} (${src.tipo})</td><td>${src.potenzaKva} kVA, ${src.tensioneV}V, Autonomia ${src.autonomiaRichiestaMin} min, t<sub>comm</sub>=${src.tempoCommutazioneSec} s</td></tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;

  downloadBlob(
    new Blob(
      [buildAppendiceAHtmlShell('Scheda Riassuntiva UNI 9795 A.3.2', progetto.identificativi.commessa, body)],
      { type: 'application/msword;charset=utf-8' }
    ),
    `${progetto.identificativi.commessa}_A32_Scheda_Riassuntiva.doc`
  );
}

export function esportaAppendiceA_RelazioneEsecutivaA33(
  progetto: ProgettoAntincendio,
  calcolo: RisultatoCalcoloCompleto,
  esiti: EsitoVerifica[],
  formato: 'doc' | 'pdf' = 'doc'
) {
  const normeAttive = progetto.norme.filter((n) => n.attivo);

  if (formato === 'pdf') {
    const { doc, addHeading, addParagraph, addBullets } = creaPdfAppendiceABuilder(
      progetto,
      calcolo,
      'RELAZIONE TECNICO-DESCRITTIVA ESECUTIVA (UNI 9795 — APPENDICE A.3.3)',
      'UNI 9795 Appendice A.3.3'
    );

    addHeading('1. Consistenza Impianto, Zone Sorvegliate e Sensori Associati');
    progetto.sistemiIrai.forEach((sys) => {
      addParagraph(`Centrale IRAI ${sys.sigla} — ${sys.nome} (${sys.modelloCentrale}):`, true);
      sys.zone.forEach((z) => {
        const dispsZona = sys.loop.flatMap((lp) =>
          lp.dispositivi
            .filter((d) => d.zonaId === z.id)
            .map((d) => ({
              label: `${d.sigla} ×${Math.max(1, d.quantita ?? 1)} [${d.tipo.replace(/_/g, ' ')}, ${lp.sigla}#${d.indirizzo}]`,
              qta: Math.max(1, d.quantita ?? 1),
            }))
        );
        const totZona = dispsZona.reduce((s, item) => s + item.qta, 0);
        addParagraph(
          `• Zona ${z.codice} (${z.nome}): ${totZona} dispositivi -> ${dispsZona.map((item) => item.label).join(', ') || 'Nessun dispositivo associato'}`,
          false,
          7.6,
          16
        );
      });
    });

    addHeading('2. Criteri di Scelta Dispositivi, Limiti di Applicazione Specifica e Normativa');
    addBullets([
      `Livello di Prestazione: ${progetto.livelloPrestazione} · Tipo locale: ${progetto.ambiente.tipoLocale.replace(/_/g, ' ')} · Temperatura ambiente di progetto: ${progetto.ambiente.temperaturaAmbienteC} °C · IP richiesto: ${progetto.ambiente.gradoIPRichiesto} · Ambiente Ma.R.C.I.: ${progetto.ambiente.ambienteMarci ? 'Sì (obbligo CPR B2ca/Cca e protezione meccanica)' : 'No'}.`,
      `Limiti applicazione specifica: separazione fisica dei circuiti di sicurezza dai circuiti ordinari, percorsi protetti antincendio, indirizzamento univoco su loop (<= 128 disp./loop, L <= 2000 m, ΔV <= 2.0 V) e ridondanza amplificatori EVAC secondo UNI ISO 7240-19.`,
    ]);
    addParagraph('Normativa e Legislazione Applicabile:', true);
    addBullets(normeAttive.map((n) => `${n.codice} (${n.edizione}) — ${n.titolo}`), 7.5);

    addHeading('3. Calcolo Analitico delle Autonomie (IRAI, EVAC e UPS)');
    progetto.sistemiIrai.forEach((sys) => {
      const r = calcolo.irai[sys.id];
      addParagraph(
        `• IRAI ${sys.sigla}: Autonomia richiesta ${sys.autonomiaQuieteRichiestaOre}h quiete + ${sys.autonomiaAllarmeRichiestaMin}min allarme | Installata: ${sys.capacitaBatterieInstallataAh} Ah >= Minima: ${r?.capacitaBatterieMinimaAh ?? 0} Ah | ${r?.formulaBatterie ?? ''}`,
        false,
        7.6,
        16
      );
    });
    progetto.sistemiEvac.forEach((sys) => {
      const r = calcolo.evac[sys.id];
      addParagraph(
        `• EVAC ${sys.sigla}: Autonomia richiesta ${sys.autonomiaQuieteRichiestaOre}h quiete + ${sys.autonomiaAllarmeRichiestaMin}min allarme | Installata: ${sys.capacitaBatterieInstallataAh} Ah >= Minima: ${r?.capacitaBatterieMinimaAh ?? 0} Ah | ${r?.formulaBatterie ?? ''}`,
        false,
        7.6,
        16
      );
    });
    addParagraph(`Taglia UPS di sicurezza consigliata sui carichi critici: ${calcolo.upsKvaConsigliato} kVA.`, false, 7.8, 16);

    addHeading('4. Dimensionamento Dettagliato dei Cavi (Loop IRAI, EVAC e Alimentazioni)');
    addParagraph('4.1 Linee di rivelazione e/o loop IRAI:', true);
    progetto.sistemiIrai.forEach((sys) => {
      const r = calcolo.irai[sys.id];
      sys.loop.forEach((lp) => {
        const rl = r?.loopRisultati.find((x) => x.loopId === lp.id);
        addParagraph(
          `• ${sys.sigla}/${lp.sigla} (${lp.nome}): L=${lp.lunghezzaM}m, S=${lp.sezioneCavoMm2}mm², ${lp.resistenzaFuoco} | Iq=${rl?.correnteQuieteMa ?? 0}mA, Ia=${rl?.correnteAllarmeMa ?? 0}mA | ${rl?.formulaDettaglio ?? ''}`,
          false,
          7.4,
          16
        );
      });
    });

    addParagraph('4.2 Linee avvisatori di allarme e linee altoparlanti EVAC (100V/70V):', true);
    progetto.sistemiEvac.forEach((sys) => {
      const r = calcolo.evac[sys.id];
      sys.lineeAltoparlanti.forEach((ln) => {
        const rl = r?.lineeRisultati.find((x) => x.lineaId === ln.id);
        addParagraph(
          `• ${sys.sigla}/${ln.sigla} (${ln.zonaNome}): ${ln.lunghezzaM}m, ${ln.sezioneMm2}mm², ${ln.potenzaTotaleAltoparlantiW}W (${ln.numeroAltoparlanti} diff.) | ${rl?.formulaDettaglio ?? ''}`,
          false,
          7.4,
          16
        );
      });
    });

    addParagraph('4.3 Linee di alimentazione primaria e secondaria:', true);
    progetto.linee.forEach((ln) => {
      const rl = calcolo.linee[ln.id];
      addParagraph(
        `• ${ln.sigla} (${ln.descrizione}): ${rl?.siglaCavoCompleta ?? ''} | L=${ln.lunghezzaM}m | ${rl?.formuleDettaglio.join(' | ') ?? ''}`,
        false,
        7.3,
        16
      );
    });

    addHeading('5. Indicazione Tecnica Precisa dei Cavi Ammessi (CEI 20-105 / CEI 20-45 / CPR)');
    addBullets([
      'Linee di rivelazione automatica / loop IRAI e interconnessioni: cavi schermati resistenti al fuoco conformi CEI 20-105 / EN 50200 (minimo PH30; PH120 per montanti/attraversamenti compartimenti), reazione al fuoco CPR B2ca-s1a,d1,a1 o Cca-s1b,d1,a1 (LS0H), guaina esterna di colore ROSSO.',
      'Linee avvisatori di allarme, targhe ottico-acustiche, comandi ausiliari e linee altoparlanti EVAC: cavi resistenti al fuoco conformi CEI 20-105 / CEI 20-45 (PH30/PH120), isolamento LS0H privo di alogeni, guaina esterna di colore ROSSO o VIOLA per distinzione dai circuiti ordinari.',
      'Linee di alimentazione primaria e secondaria a 230/400 V: cavi tipo FTG18OM16 resistenti al fuoco PH120 secondo CEI 20-45 / EN 50200, classe CPR idonea al rischio incendio del fabbricato, posati in via esclusiva e separati dai cavi energia ordinari.',
    ]);

    doc.save(`${progetto.identificativi.commessa}_A33_Relazione_Esecutiva.pdf`);
    return;
  }

  const body = `
    <h1>RELAZIONE TECNICO-DESCRITTIVA ESECUTIVA (UNI 9795 — APPENDICE A.3.3)</h1>
    <div class="meta">
      <strong>Commessa:</strong> ${progetto.identificativi.commessa} | <strong>Cliente:</strong> ${progetto.identificativi.cliente}<br/>
      <strong>Sito / Attività:</strong> ${progetto.identificativi.sito} — ${progetto.attivitaNome} (Livello Prestazione: <strong>${progetto.livelloPrestazione}</strong>)<br/>
      <strong>Progettista:</strong> ${progetto.identificativi.progettista} | <strong>Rev.:</strong> ${progetto.identificativi.revisione} del ${progetto.identificativi.data} | <strong>Motore:</strong> ElettroCAD ${calcolo.versioneApp}
    </div>

    <h2>1. Consistenza Impianto, Zone Sorvegliate e Sensori Associati</h2>
    ${progetto.sistemiIrai
      .map(
        (sys) => `
      <h3>Centrale IRAI ${sys.sigla} — ${sys.nome} (${sys.modelloCentrale})</h3>
      <table>
        <thead><tr><th>Codice Zona</th><th>Descrizione Zona Sorvegliata</th><th>N. Disp.</th><th>Sensori / Dispositivi Associati (Indirizzo, Sigla, Tipo)</th></tr></thead>
        <tbody>
          ${sys.zone
            .map((z) => {
              const dispsZona = sys.loop.flatMap((lp) =>
                lp.dispositivi
                  .filter((d) => d.zonaId === z.id)
                  .map((d) => ({
                    label: `${lp.sigla}#${d.indirizzo} <strong>${d.sigla}</strong> ×${Math.max(1, d.quantita ?? 1)} (${d.tipo.replace(/_/g, ' ')})`,
                    qta: Math.max(1, d.quantita ?? 1),
                  }))
              );
              const totZona = dispsZona.reduce((s, item) => s + item.qta, 0);
              return `<tr><td class="mono">${z.codice}</td><td>${z.nome}</td><td>${totZona}</td><td>${dispsZona.map((item) => item.label).join(', ') || 'Nessun dispositivo assegnato'}</td></tr>`;
            })
            .join('')}
        </tbody>
      </table>`
      )
      .join('')}

    <h2>2. Criteri di Scelta Dispositivi, Limiti di Applicazione Specifica e Normativa Applicabile</h2>
    <p><strong>Limiti di applicazione specifica:</strong> Ambiente ${progetto.ambiente.tipoLocale.replace(/_/g, ' ')}, T<sub>amb</sub> = ${progetto.ambiente.temperaturaAmbienteC} °C, grado di protezione minimo ${progetto.ambiente.gradoIPRichiesto}, ambiente Ma.R.C.I.: <strong>${progetto.ambiente.ambienteMarci ? 'Sì' : 'No'}</strong>. Tutti i loop rispettano la soglia di caduta di tensione ΔV &le; 2,0 V e il limite dispositivi indirizzati; i quadri e le linee di sicurezza sono segregati e protetti contro il cortocircuito e i contatti indiretti (${progetto.fornitura.sistemaDistribuzione}).</p>
    <ul>
      ${normeAttive.map((n) => `<li><strong>${n.codice}</strong> (${n.edizione}) — ${n.titolo}</li>`).join('')}
    </ul>

    <h2>3. Calcolo Analitico delle Autonomie (Sistemi IRAI, EVAC e UPS)</h2>
    <table>
      <thead><tr><th>Sistema / Sorgente</th><th>Regime Quiete / Allarme</th><th>Capacità Installata</th><th>Capacità Minima Calcolata</th><th>Formula Applicata</th></tr></thead>
      <tbody>
        ${progetto.sistemiIrai
          .map((sys) => {
            const r = calcolo.irai[sys.id];
            return `<tr><td>IRAI ${sys.sigla} — ${sys.nome}</td><td>${sys.autonomiaQuieteRichiestaOre} h + ${sys.autonomiaAllarmeRichiestaMin} min</td><td>${sys.capacitaBatterieInstallataAh} Ah (24V)</td><td>${r?.capacitaBatterieMinimaAh ?? 0} Ah</td><td class="mono">${r?.formulaBatterie ?? ''}</td></tr>`;
          })
          .join('')}
        ${progetto.sistemiEvac
          .map((sys) => {
            const r = calcolo.evac[sys.id];
            return `<tr><td>EVAC ${sys.sigla} — ${sys.nome}</td><td>${sys.autonomiaQuieteRichiestaOre} h + ${sys.autonomiaAllarmeRichiestaMin} min</td><td>${sys.capacitaBatterieInstallataAh} Ah</td><td>${r?.capacitaBatterieMinimaAh ?? 0} Ah</td><td class="mono">${r?.formulaBatterie ?? ''}</td></tr>`;
          })
          .join('')}
        ${progetto.sorgenti
          .map(
            (src) =>
              `<tr><td>${src.sigla} (${src.tipo})</td><td>t<sub>comm</sub> = ${src.tempoCommutazioneSec} s</td><td>${src.potenzaKva} kVA</td><td>UPS cons. ${calcolo.upsKvaConsigliato} kVA</td><td>Autonomia richiesta ${src.autonomiaRichiestaMin} min</td></tr>`
          )
          .join('')}
      </tbody>
    </table>

    <h2>4. Dimensionamento Dettagliato dei Cavi</h2>
    <h3>4.1 Linee di Rivelazione e/o Loop IRAI</h3>
    <table>
      <thead><tr><th>Centrale / Loop</th><th>L (m)</th><th>Sez. (mm²)</th><th>Resistenza Fuoco</th><th>Iq / Ia (mA)</th><th>ΔV Loop (V)</th><th>Formula Verifica</th></tr></thead>
      <tbody>
        ${progetto.sistemiIrai
          .flatMap((sys) => {
            const r = calcolo.irai[sys.id];
            return sys.loop.map((lp) => {
              const rl = r?.loopRisultati.find((x) => x.loopId === lp.id);
              return `<tr><td class="mono">${sys.sigla} / ${lp.sigla}</td><td>${lp.lunghezzaM}</td><td>${lp.sezioneCavoMm2}</td><td>${lp.resistenzaFuoco}</td><td>${rl?.correnteQuieteMa ?? 0} / ${rl?.correnteAllarmeMa ?? 0}</td><td>${rl?.cadutaTensioneLoopV ?? 0} V</td><td class="mono">${rl?.formulaDettaglio ?? ''}</td></tr>`;
            });
          })
          .join('')}
      </tbody>
    </table>

    <h3>4.2 Linee Avvisatori di Allarme e Linee Altoparlanti EVAC (100V / 70V)</h3>
    <table>
      <thead><tr><th>Sistema / Linea</th><th>Zona</th><th>Topologia / Carico</th><th>L / Sez.</th><th>Potenza / I</th><th>ΔV (V / %)</th><th>Att. / Lmax</th><th>Esito</th></tr></thead>
      <tbody>
        ${progetto.sistemiEvac
          .flatMap((sys) => {
            const r = calcolo.evac[sys.id];
            return sys.lineeAltoparlanti.map((ln) => {
              const rl = r?.lineeRisultati.find((x) => x.lineaId === ln.id);
              return `<tr><td class="mono">${sys.sigla} / ${ln.sigla}</td><td>${ln.zonaNome}</td><td>${ln.topologia} / ${ln.distribuzioneCarico ?? 'concentrato'}</td><td>${ln.lunghezzaM} m · ${ln.sezioneMm2} mm² (${ln.resistenzaFuoco})</td><td>${ln.potenzaTotaleAltoparlantiW} W / ${rl?.correnteLineaA ?? 0} A</td><td>${rl?.cadutaTensioneV ?? 0} V (${rl?.cadutaTensionePct ?? 0}%)</td><td>${rl?.attenuazioneDb ?? 0} dB / ${rl?.lunghezzaMassimaAmmissibileM ?? 0} m</td><td><strong>${rl?.conformeCadutaTensione ? 'CONFORME' : `NON CONFORME (min ${rl?.sezioneMinimaConsigliataMm2} mm²)`}</strong></td></tr>`;
            });
          })
          .join('')}
      </tbody>
    </table>

    <h3>4.3 Linee di Alimentazione Primaria e Secondaria</h3>
    <table>
      <thead><tr><th>Linea</th><th>Utenza</th><th>Ib (A)</th><th>Protezione (In)</th><th>Cavo / CPR</th><th>Iz (A)</th><th>ΔV (%)</th></tr></thead>
      <tbody>
        ${progetto.linee
          .map((l) => {
            const r = calcolo.linee[l.id];
            return `<tr><td class="mono">${l.sigla}</td><td>${l.descrizione}</td><td>${r?.correnteImpiegoIbA ?? 0}</td><td>${r?.siglaProtezioneCompleta ?? ''}</td><td>${r?.siglaCavoCompleta ?? ''}</td><td>${r?.portataCorrettaIzA ?? 0}</td><td>${r?.cadutaTensionePct ?? 0}%</td></tr>
            <tr><td colspan="7" class="mono">${r?.formuleDettaglio.join(' | ') ?? ''}</td></tr>`;
          })
          .join('')}
      </tbody>
    </table>

    <h2>5. Specifica Tecnica dei Cavi Ammessi (CEI 20-105 / CEI 20-45 / CPR)</h2>
    <ul>
      <li><strong>Circuiti di rivelazione / loop IRAI:</strong> cavi schermati resistenti al fuoco conformi <strong>CEI 20-105 / EN 50200</strong> (minimo PH30, PH120 su dorsali e attraversamenti), guaina LS0H di colore <strong>ROSSO</strong>, classe CPR &ge; C<sub>ca</sub>-s1b,d1,a1 (B2<sub>ca</sub> in ambienti Ma.R.C.I./vie esodo).</li>
      <li><strong>Circuiti avvisatori di allarme, EVAC 100V/70V e comandi:</strong> cavi resistenti al fuoco conformi <strong>CEI 20-105 / CEI 20-45</strong> (PH30/PH120), twistati/schermati per linee audio, guaina LS0H colore <strong>ROSSO o VIOLA</strong> (colore <strong>BLU</strong> per eventuali circuiti a sicurezza intrinseca Ex-i).</li>
      <li><strong>Linee di alimentazione primaria e secondaria 230/400 V:</strong> cavi tipo <strong>FTG18OM16 PH120</strong> (CEI 20-45 / EN 50200), posa dedicata e separata da qualsiasi impianto ordinario ai sensi CEI 64-8 Art. 560.7.</li>
    </ul>

    <h2>6. Sintesi Esiti Verifiche Normative</h2>
    <p>Verifiche eseguite: ${esiti.length} | Conformi: ${esiti.filter((e) => e.stato === 'conforme').length} | Non conformi: ${esiti.filter((e) => e.stato === 'non_conforme' && !e.derogata).length} | Deroghe motivate: ${esiti.filter((e) => e.derogata).length}.</p>
  `;

  downloadBlob(
    new Blob(
      [buildAppendiceAHtmlShell('Relazione Esecutiva UNI 9795 A.3.3', progetto.identificativi.commessa, body)],
      { type: 'application/msword;charset=utf-8' }
    ),
    `${progetto.identificativi.commessa}_A33_Relazione_Esecutiva.doc`
  );
}

export function esportaAppendiceA_ElencoComponentiA32Xlsx(
  progetto: ProgettoAntincendio,
  calcolo: RisultatoCalcoloCompleto,
  esiti: EsitoVerifica[]
) {
  const wb = XLSX.utils.book_new();
  const registro = costruisciRegistroElaboratiAppendiceA(progetto).map((r) => ({
    Codice_Riferimento: r.codice,
    Rif_UNI_9795: r.riferimentoAppendiceA,
    Titolo_Elaborato: r.titolo,
    Emissione_Rev: r.emissione,
    Data_Emissione: r.data,
    Formato: r.formato,
  }));

  const centraliQuadri = [
    ...progetto.sistemiIrai.map((s) => ({
      Tipo: 'Centrale IRAI',
      Sigla: s.sigla,
      Modello_Denominazione: `${s.modelloCentrale} — ${s.nome}`,
      Tensione_V: s.tensioneSistemaV,
      Capacita_Batt_Ah: s.capacitaBatterieInstallataAh,
      Capacita_Min_Ah: calcolo.irai[s.id]?.capacitaBatterieMinimaAh ?? 0,
      Dettagli: `${s.loop.length} loop, ${s.zone.length} zone`,
    })),
    ...progetto.sistemiEvac.map((s) => ({
      Tipo: 'Centrale EVAC',
      Sigla: s.sigla,
      Modello_Denominazione: `${s.modelloCentrale} — ${s.nome}`,
      Tensione_V: 230,
      Capacita_Batt_Ah: s.capacitaBatterieInstallataAh,
      Capacita_Min_Ah: calcolo.evac[s.id]?.capacitaBatterieMinimaAh ?? 0,
      Dettagli: `${s.lineeAltoparlanti.length} linee, ${calcolo.evac[s.id]?.potenzaAmplificatoriAttiviW ?? 0} W attivi`,
    })),
    ...progetto.quadri.map((q) => ({
      Tipo: 'Quadro Elettrico Sicurezza',
      Sigla: q.sigla,
      Modello_Denominazione: q.nome,
      Tensione_V: q.tensioneV,
      Capacita_Batt_Ah: 0,
      Capacita_Min_Ah: 0,
      Dettagli: `${q.gradoIP}, ${q.formaSegregazione}, I.G. ${q.interruttoreGeneraleInA}A`,
    })),
  ];

  const compIrai = progetto.sistemiIrai.flatMap((s) =>
    s.loop.flatMap((lp) =>
      lp.dispositivi.map((d) => {
        const qta = Math.max(1, d.quantita ?? 1);
        return {
          Centrale: s.sigla,
          Loop: lp.sigla,
          Cavo_Loop: `${lp.sezioneCavoMm2} mm² ${lp.resistenzaFuoco} (${lp.lunghezzaM} m)`,
          Indirizzo: d.indirizzo,
          Sigla: d.sigla,
          Tipo: d.tipo,
          Zona: s.zone.find((z) => z.id === d.zonaId)?.codice ?? '—',
          Descrizione: d.descrizione,
          Quantita: qta,
          Iq_Unit_mA: d.correnteQuieteMa,
          Ia_Unit_mA: d.correnteAllarmeMa,
          Iq_Tot_mA: Number((d.correnteQuieteMa * qta).toFixed(2)),
          Ia_Tot_mA: Number((d.correnteAllarmeMa * qta).toFixed(2)),
        };
      })
    )
  );

  const compEvac = progetto.sistemiEvac.flatMap((s) => [
    ...s.amplificatori.map((a) => ({
      Sistema: s.sigla,
      Categoria: a.diRiserva ? 'Amplificatore Riserva' : 'Amplificatore Attivo',
      Sigla: a.sigla,
      Modello_Zona: a.modello,
      Potenza_W: a.potenzaNominaleW,
      Dettagli_Linea: 'EN 54-16',
    })),
    ...s.lineeAltoparlanti.map((ln) => {
      const rl = calcolo.evac[s.id]?.lineeRisultati.find((x) => x.lineaId === ln.id);
      return {
        Sistema: s.sigla,
        Categoria: 'Linea Diffusori',
        Sigla: ln.sigla,
        Modello_Zona: `${ln.zonaNome} (${ln.numeroAltoparlanti} pz)`,
        Potenza_W: ln.potenzaTotaleAltoparlantiW,
        Dettagli_Linea: `${ln.tensioneLineaV}V ${ln.topologia} · ${ln.lunghezzaM}m · ${ln.sezioneMm2}mm² ${ln.resistenzaFuoco} · ΔV=${rl?.cadutaTensionePct ?? 0}%`,
      };
    }),
  ]);

  const caviAlim = progetto.linee.map((l) => {
    const r = calcolo.linee[l.id];
    return {
      Sigla_Linea: l.sigla,
      Descrizione: l.descrizione,
      Protezione: r?.siglaProtezioneCompleta ?? '',
      Cavo_Specifico: r?.siglaCavoCompleta ?? '',
      Lunghezza_m: l.lunghezzaM,
      Ib_A: r?.correnteImpiegoIbA ?? 0,
      Iz_A: r?.portataCorrettaIzA ?? 0,
      Caduta_Pct: r?.cadutaTensionePct ?? 0,
    };
  });

  const conformita = esiti.map((e) => ({
    Codice: e.codice,
    Oggetto: e.targetLabel,
    Stato: e.stato,
    Valore: e.valoreCalcolato,
    Soglia: e.sogliaAttesa,
    Derogata: e.derogata ? 'Sì' : 'No',
    Motivazione_Deroga: e.motivazioneDeroga ?? '',
  }));

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(registro), 'Registro Elaborati (b-e)');
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(centraliQuadri.length ? centraliQuadri : [{ Nota: 'Nessun apparato' }]),
    'Centrali e Quadri (f-g)'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(compIrai.length ? compIrai : [{ Nota: 'Nessun componente IRAI' }]),
    'Componenti IRAI (i)'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(compEvac.length ? compEvac : [{ Nota: 'Nessun componente EVAC' }]),
    'Componenti EVAC (i)'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(caviAlim.length ? caviAlim : [{ Nota: 'Nessuna linea' }]),
    'Cavi e Protezioni (i)'
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(conformita), 'Conformità UNI 9795 (h)');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${progetto.identificativi.commessa}_A32_Elenco_Componenti_Elaborati.xlsx`
  );
}

// ============================================================================
// DOCUMENTAZIONE EVAC — NORMATIVA UNI 11988:2025 (APPENDICE A: A.3.1 ÷ A.3.6)
// ============================================================================

interface VoceAcusticaAdaEvac {
  sistemaSigla: string;
  lineaSigla: string;
  adaCodice: string;
  zonaNome: string;
  numDiffusori: number;
  potenzaTotaleW: number;
  potenzaSingoloDiffusoreW: number;
  rt60BandeS: [number, number, number, number, number, number, number]; // 125, 250, 500, 1k, 2k, 4k, 8k Hz
  rumoreBandeDb: [number, number, number, number, number, number, number]; // 125..8k Hz
  fonteDatoRumore: string;
}

const BANDE_OTTAVA_HZ = ['125 Hz', '250 Hz', '500 Hz', '1 kHz', '2 kHz', '4 kHz', '8 kHz'] as const;

function calcolaProfiloAcusticoAdaEvac(progetto: ProgettoAntincendio): VoceAcusticaAdaEvac[] {
  const isDepositoOIndustriale =
    progetto.ambiente.tipoLocale === 'deposito_marci' ||
    progetto.ambiente.tipoLocale === 'locale_tecnico_antincendio';

  const baseRt60: [number, number, number, number, number, number, number] = isDepositoOIndustriale
    ? [1.55, 1.45, 1.35, 1.25, 1.15, 1.0, 0.85]
    : [1.1, 1.0, 0.95, 0.9, 0.85, 0.75, 0.65];

  const baseRumore: [number, number, number, number, number, number, number] = isDepositoOIndustriale
    ? [66, 65, 64, 63, 61, 58, 55]
    : [55, 53, 51, 49, 46, 43, 40];

  const fonteDato = isDepositoOIndustriale
    ? 'Stima preliminare / Prospetto 24 UNI 9795:2021 (aree operative - da validare con rilievo fonometrico)'
    : 'Stima da tabelle / Prospetto 24 UNI 9795:2021 (edifici nuovi) o misura diretta in opera (esistenti)';

  return progetto.sistemiEvac.flatMap((sys) =>
    sys.lineeAltoparlanti.map((ln, idx) => {
      const pSingolo =
        ln.numeroAltoparlanti > 0
          ? Number((ln.potenzaTotaleAltoparlantiW / ln.numeroAltoparlanti).toFixed(2))
          : 0;
      const offsetRt = Number(((idx % 3) * 0.05).toFixed(2));
      const offsetDb = (idx % 3) * 2;
      return {
        sistemaSigla: sys.sigla,
        lineaSigla: ln.sigla,
        adaCodice: `ADA-${sys.sigla}-${String(idx + 1).padStart(2, '0')}`,
        zonaNome: ln.zonaNome,
        numDiffusori: ln.numeroAltoparlanti,
        potenzaTotaleW: ln.potenzaTotaleAltoparlantiW,
        potenzaSingoloDiffusoreW: pSingolo,
        rt60BandeS: baseRt60.map((v) => Number((v + offsetRt).toFixed(2))) as VoceAcusticaAdaEvac['rt60BandeS'],
        rumoreBandeDb: baseRumore.map((v) => v + offsetDb) as VoceAcusticaAdaEvac['rumoreBandeDb'],
        fonteDatoRumore: fonteDato,
      };
    })
  );
}

function costruisciRegistroElaboratiEvacUni11988(
  progetto: ProgettoAntincendio
): VoceRegistroElaborato[] {
  const comm = progetto.identificativi.commessa;
  const rev = progetto.identificativi.revisione;
  const data = progetto.identificativi.data;
  return [
    {
      codice: `${comm}-EVAC-A32`,
      riferimentoAppendiceA: 'UNI 11988:2025 App. A.3.2',
      titolo: 'Scheda Riassuntiva Impianto EVAC, Centrali VACIE, Conformità e Componenti',
      emissione: rev,
      data,
      formato: 'DOC / PDF',
    },
    {
      codice: `${comm}-EVAC-A33`,
      riferimentoAppendiceA: 'UNI 11988:2025 App. A.3.3',
      titolo: 'Relazione Tecnico-Descrittiva EVAC, Relazione Acustica ADA (125Hz–8kHz) e Cavi',
      emissione: rev,
      data,
      formato: 'DOC / PDF',
    },
    {
      codice: `${comm}-EVAC-A32-EL`,
      riferimentoAppendiceA: 'UNI 11988:2025 App. A.3.2-i / A.3.3',
      titolo: 'Elenco Componenti EVAC, Potenze Diffusori/Amplificatori e Matrice Acustica ADA',
      emissione: rev,
      data,
      formato: 'XLSX',
    },
    {
      codice: `${comm}-EVAC-A34`,
      riferimentoAppendiceA: 'UNI 11988:2025 App. A.3.4',
      titolo: 'Schema a Blocchi Impianto EVAC & Tabella Causa-Effetto Integrata IRAI-EVAC',
      emissione: rev,
      data,
      formato: 'DXF R2000',
    },
    {
      codice: `${comm}-EVAC-A35`,
      riferimentoAppendiceA: 'UNI 11988:2025 App. A.3.5 / CEI 0-2',
      titolo: 'Disegni di Layout Impianto EVAC, Sezioni Altoparlanti e Schemi Elettrici di Quadro',
      emissione: rev,
      data,
      formato: 'DXF R2000 / PDF',
    },
    {
      codice: `${comm}-EVAC-A36`,
      riferimentoAppendiceA: 'UNI 11988:2025 App. A.3.6.1 & A.3.6.2',
      titolo: 'Schemi Alimentazione Elettrica Primaria e Secondaria VACIE + Legenda Simboli',
      emissione: rev,
      data,
      formato: 'DXF R2000',
    },
  ];
}

export function esportaEvacUni11988_SchedaRiassuntivaA32(
  progetto: ProgettoAntincendio,
  calcolo: RisultatoCalcoloCompleto,
  esiti: EsitoVerifica[],
  formato: 'doc' | 'pdf' = 'doc'
) {
  const registro = costruisciRegistroElaboratiEvacUni11988(progetto);
  const esitiEvac = esiti.filter(
    (e) =>
      e.categoria === 'evac' ||
      e.targetId.toLowerCase().includes('evac') ||
      e.targetLabel.toLowerCase().includes('evac')
  );
  const nonConformi = esitiEvac.filter((e) => e.stato === 'non_conforme' && !e.derogata);
  const deroghe = progetto.deroghe.filter((d) => d.disattivata || d.motivazione.trim().length > 0);
  const lineeAlimEvac = progetto.linee.filter(
    (l) =>
      l.tipoUtenza === 'centrale_evac' ||
      l.tipoUtenza === 'amplificatore_evac' ||
      l.tipoUtenza === 'ups_sicurezza'
  );

  if (formato === 'pdf') {
    const { doc, addHeading, addParagraph, addBullets } = creaPdfAppendiceABuilder(
      progetto,
      calcolo,
      'SCHEDA RIASSUNTIVA IMPIANTO EVAC (UNI 11988:2025 — APPENDICE A.3.2)',
      'UNI 11988:2025 Appendice A.3.2 (a ÷ i)'
    );

    addHeading('A.3.2 a) Identificazione Progetto e Progettista');
    addBullets([
      `Nome progetto / Attività: ${progetto.identificativi.titoloTavola} (${progetto.attivitaNome})`,
      `Commessa: ${progetto.identificativi.commessa} | Cliente: ${progetto.identificativi.cliente} | Sito: ${progetto.identificativi.sito}`,
      `Progettista: ${progetto.identificativi.progettista} | Studio: ${progetto.identificativi.logoTestoStudio} | Livello Prestazione: ${progetto.livelloPrestazione}`,
    ]);

    addHeading('A.3.2 b÷e) Registro Numeri di Riferimento, Emissione, Date e Titoli Disegni/Documenti');
    addBullets(
      registro.map(
        (r) => `[${r.codice}] Rev. ${r.emissione} (${r.data}) — ${r.titolo} [${r.riferimentoAppendiceA} · ${r.formato}]`
      ),
      7.4
    );

    addHeading('A.3.2 f÷g) Tipi di Impianto EVAC, Tipo di VACIE e Riferimenti di Ogni VACIE');
    if (progetto.sistemiEvac.length === 0) {
      addParagraph('Nessun sistema EVAC/VACIE configurato nel progetto corrente.');
    } else {
      progetto.sistemiEvac.forEach((sys, idx) => {
        const res = calcolo.evac[sys.id];
        addParagraph(
          `• VACIE #${idx + 1} [${sys.sigla}] "${sys.nome}" — Tipo/Modello: ${sys.modelloCentrale} (EN 54-16 / EN 54-4) · Ridondanza N+1: ${sys.ridondanzaAmplificatoriN1 ? 'Sì' : 'No'} (riserva rilevata: ${res?.haAmplificatoreRiserva ? 'Sì' : 'No'}) · Amplif. attivi: ${res?.potenzaAmplificatoriAttiviW ?? 0} W · Carico diffusori: ${res?.potenzaTotaleAltoparlantiW ?? 0} W (${sys.lineeAltoparlanti.length} linee 100V/70V) · Batt. ${sys.capacitaBatterieInstallataAh} Ah (min ${res?.capacitaBatterieMinimaAh ?? 0} Ah)`,
          false,
          7.6,
          16
        );
      });
    }

    addHeading('A.3.2 h) Dichiarazione di Conformità alla UNI 11988:2025 o Scostamenti');
    if (nonConformi.length === 0 && deroghe.length === 0) {
      addParagraph(
        'DICHIARAZIONE DI CONFORMITÀ: Sulla base dei dati progettuali disponibili, gli impianti di allarme vocale per scopi di emergenza (EVAC) risultano progettati in conformità ai requisiti della norma UNI 11988:2025 senza scostamenti.'
      );
    } else {
      addParagraph('SCOSTAMENTI / DEROGHE MOTIVATE RILEVATE:');
      deroghe.forEach((d) =>
        addParagraph(`• Deroga ${d.regolaId} (${d.targetId}): ${d.motivazione} (${d.autore}, ${d.data})`, false, 7.5, 16)
      );
      nonConformi.forEach((nc) =>
        addParagraph(`• Scostamento ${nc.codice} (${nc.targetLabel}): ${nc.messaggio} [${nc.valoreCalcolato} vs ${nc.sogliaAttesa}]`, false, 7.5, 16)
      );
    }

    addHeading('A.3.2 i) Elenco dei Componenti Inclusi nel Sistema EVAC e Relative Specifiche');
    progetto.sistemiEvac.forEach((sys) => {
      addParagraph(`Sistema VACIE ${sys.sigla} (${sys.modelloCentrale}):`, true, 8, 14);
      sys.amplificatori.forEach((a) =>
        addParagraph(
          `• Amplificatore [${a.sigla}] ${a.modello}: ${a.potenzaNominaleW} W (${a.diRiserva ? 'Riserva N+1' : 'Attivo'}) — EN 54-16`,
          false,
          7.4,
          16
        )
      );
      sys.lineeAltoparlanti.forEach((ln) => {
        const pUnit =
          ln.numeroAltoparlanti > 0
            ? (ln.potenzaTotaleAltoparlantiW / ln.numeroAltoparlanti).toFixed(1)
            : '0';
        const rl = calcolo.evac[sys.id]?.lineeRisultati.find((r) => r.lineaId === ln.id);
        addParagraph(
          `• Linea [${ln.sigla}] "${ln.zonaNome}": ${ln.numeroAltoparlanti} diffusori EN 54-24 da ${pUnit} W cad. (Tot ${ln.potenzaTotaleAltoparlantiW} W) · ${ln.tensioneLineaV} V ${ln.topologia} · Cavo ${ln.sezioneMm2} mm² ${ln.resistenzaFuoco} (${ln.lunghezzaM} m, ΔV=${rl?.cadutaTensionePct ?? 0}%)`,
          false,
          7.3,
          16
        );
      });
      addParagraph(
        `• Microfoni di emergenza & Interfaccia IRAI: Postazione microfonica di emergenza presidiata (EN 54-16, cavo ${sys.cavoInterfacciaResistenteFuoco}) · Collegamento IRAI: ${sys.interfacciaIraiCollegata ? 'Attivo e sorvegliato' : 'Da collegare'}`,
        false,
        7.3,
        16
      );
    });
    lineeAlimEvac.forEach((l) => {
      const r = calcolo.linee[l.id];
      addParagraph(
        `• Alimentazione dedicata [${l.sigla}] ${l.descrizione}: ${r?.siglaProtezioneCompleta ?? ''} | ${r?.siglaCavoCompleta ?? ''} (${l.lunghezzaM} m)`,
        false,
        7.3,
        16
      );
    });

    doc.save(`${progetto.identificativi.commessa}_EVAC_UNI11988_A32_Scheda_Riassuntiva.pdf`);
    return;
  }

  const body = `
    <h1>SCHEDA RIASSUNTIVA IMPIANTO EVAC (UNI 11988:2025 — APPENDICE A.3.2)</h1>
    <h2>A.3.2 a) Identificazione del Progetto e del Progettista</h2>
    <table>
      <tr><th>Nome Progetto / Titolo</th><td>${progetto.identificativi.titoloTavola} (${progetto.attivitaNome})</td><th>Commessa</th><td>${progetto.identificativi.commessa}</td></tr>
      <tr><th>Cliente / Sito</th><td>${progetto.identificativi.cliente} — ${progetto.identificativi.sito}</td><th>Livello Prestazione</th><td>${progetto.livelloPrestazione}</td></tr>
      <tr><th>Progettista</th><td>${progetto.identificativi.progettista}</td><th>Studio / Rev.</th><td>${progetto.identificativi.logoTestoStudio} · Rev. ${progetto.identificativi.revisione} (${progetto.identificativi.data})</td></tr>
    </table>

    <h2>A.3.2 b÷e) Registro Disegni e Documenti del Sistema EVAC</h2>
    <table>
      <thead><tr><th>N. Riferimento</th><th>N. Emissione</th><th>Data Emissione</th><th>Titolo Disegno o Documento</th><th>Riferimento UNI 11988</th><th>Formato</th></tr></thead>
      <tbody>
        ${registro
          .map(
            (r) =>
              `<tr><td class="mono">${r.codice}</td><td>${r.emissione}</td><td>${r.data}</td><td>${r.titolo}</td><td>${r.riferimentoAppendiceA}</td><td>${r.formato}</td></tr>`
          )
          .join('')}
      </tbody>
    </table>

    <h2>A.3.2 f÷g) Tipologia Impianto EVAC, Tipo di VACIE e Riferimenti di Ogni VACIE</h2>
    <table>
      <thead><tr><th>Rif. VACIE</th><th>Denominazione</th><th>Tipo Impianto & Modello VACIE</th><th>Amplificatori & Carico</th><th>Autonomia Batterie</th></tr></thead>
      <tbody>
        ${
          progetto.sistemiEvac.length === 0
            ? '<tr><td colspan="5">Nessun sistema EVAC/VACIE configurato nel progetto corrente.</td></tr>'
            : progetto.sistemiEvac
                .map((sys) => {
                  const res = calcolo.evac[sys.id];
                  return `<tr>
                    <td class="mono">${sys.sigla}</td>
                    <td>${sys.nome}</td>
                    <td>Sistema Allarme Vocale EVAC 100V/70V — <strong>${sys.modelloCentrale}</strong> (EN 54-16 / EN 54-4)</td>
                    <td>Attivi ${res?.potenzaAmplificatoriAttiviW ?? 0} W | Carico ${res?.potenzaTotaleAltoparlantiW ?? 0} W | Riserva N+1: ${res?.haAmplificatoreRiserva ? 'Presente' : 'Assente'} (${sys.lineeAltoparlanti.length} linee)</td>
                    <td>${sys.capacitaBatterieInstallataAh} Ah (min ${res?.capacitaBatterieMinimaAh ?? 0} Ah) · ${sys.autonomiaQuieteRichiestaOre}h + ${sys.autonomiaAllarmeRichiestaMin}m</td>
                  </tr>`;
                })
                .join('')
        }
      </tbody>
    </table>

    <h2>A.3.2 h) Dichiarazione di Conformità Progettuale alla UNI 11988:2025 o Scostamenti</h2>
    ${
      nonConformi.length === 0 && deroghe.length === 0
        ? `<div class="box ok">DICHIARAZIONE DI CONFORMITÀ: L'impianto EVAC è progettato in conformità ai requisiti della norma UNI 11988:2025, sulla base dei dati progettuali disponibili, senza scostamenti rilevati.</div>`
        : `<div class="box warn">INFORMAZIONI SUGLI SCOSTAMENTI DAI REQUISITI DELLA NORMA E RELATIVE MOTIVAZIONI:</div>
           <ul>
             ${deroghe.map((d) => `<li><strong>Deroga ${d.regolaId} (${d.targetId}):</strong> ${d.motivazione} — ${d.autore} (${d.data})</li>`).join('')}
             ${nonConformi.map((nc) => `<li><strong>Scostamento ${nc.codice} (${nc.targetLabel}):</strong> ${nc.messaggio} [${nc.valoreCalcolato} vs ${nc.sogliaAttesa}]</li>`).join('')}
           </ul>`
    }

    <h2>A.3.2 i) Elenco Completo dei Componenti Inclusi nel Sistema EVAC con Relative Specifiche</h2>
    <table>
      <thead><tr><th>VACIE</th><th>Categoria</th><th>Sigla / Rif.</th><th>Modello / Zona / Tipologia</th><th>Specifiche Tecniche</th></tr></thead>
      <tbody>
        ${progetto.sistemiEvac
          .flatMap((sys) => [
            `<tr><td class="mono">${sys.sigla}</td><td>Unità Centrale VACIE</td><td class="mono">${sys.sigla}</td><td>${sys.modelloCentrale} — ${sys.nome}</td><td>EN 54-16 / EN 54-4 · Iq=${sys.correnteQuieteA}A, Ia=${sys.correnteAllarmeA}A · Batt. ${sys.capacitaBatterieInstallataAh}Ah · Margine ampl. ${sys.marginePotenzaRichiestoPct}%</td></tr>`,
            ...sys.amplificatori.map(
              (a) =>
                `<tr><td class="mono">${sys.sigla}</td><td>Amplificatore</td><td class="mono">${a.sigla}</td><td>${a.modello}</td><td>Potenza nominale ${a.potenzaNominaleW} W — Ruolo: ${a.diRiserva ? 'Riserva N+1' : 'Attivo'} (EN 54-16)</td></tr>`
            ),
            ...sys.lineeAltoparlanti.map((ln) => {
              const pUnit =
                ln.numeroAltoparlanti > 0
                  ? (ln.potenzaTotaleAltoparlantiW / ln.numeroAltoparlanti).toFixed(1)
                  : '0';
              const rl = calcolo.evac[sys.id]?.lineeRisultati.find((r) => r.lineaId === ln.id);
              return `<tr><td class="mono">${sys.sigla}</td><td>Diffusori & Linea</td><td class="mono">${ln.sigla}</td><td>${ln.zonaNome} (${ln.numeroAltoparlanti} diffusori EN 54-24)</td><td>Potenza unitaria ${pUnit} W/pz (Tot ${ln.potenzaTotaleAltoparlantiW} W) · ${ln.tensioneLineaV}V ${ln.topologia} · L=${ln.lunghezzaM}m · ${ln.sezioneMm2}mm² ${ln.resistenzaFuoco} · ΔV=${rl?.cadutaTensionePct ?? 0}%</td></tr>`;
            }),
            `<tr><td class="mono">${sys.sigla}</td><td>Microfoni / Interfaccia</td><td class="mono">MIC-${sys.sigla}</td><td>Postazione Microfonica Emergenza & Interfaccia IRAI</td><td>Microfono sorvegliato EN 54-16 in sala/punto controllo · Interfaccia IRAI: ${sys.interfacciaIraiCollegata ? 'Collegata' : 'Non collegata'} (${sys.cavoInterfacciaResistenteFuoco})</td></tr>`,
          ])
          .join('')}
        ${lineeAlimEvac
          .map((l) => {
            const r = calcolo.linee[l.id];
            return `<tr><td class="mono">ALIM</td><td>Alimentazione Dedicata</td><td class="mono">${l.sigla}</td><td>${l.descrizione}</td><td>Protezione: ${r?.siglaProtezioneCompleta ?? ''} · Cavo: ${r?.siglaCavoCompleta ?? ''} (${l.lunghezzaM} m)</td></tr>`;
          })
          .join('')}
      </tbody>
    </table>
  `;

  downloadBlob(
    new Blob(
      [buildAppendiceAHtmlShell('Scheda Riassuntiva EVAC UNI 11988 A.3.2', progetto.identificativi.commessa, body)],
      { type: 'application/msword;charset=utf-8' }
    ),
    `${progetto.identificativi.commessa}_EVAC_UNI11988_A32_Scheda_Riassuntiva.doc`
  );
}

export function esportaEvacUni11988_RelazioneTecnicaA33(
  progetto: ProgettoAntincendio,
  calcolo: RisultatoCalcoloCompleto,
  esiti: EsitoVerifica[],
  formato: 'doc' | 'pdf' = 'doc'
) {
  const vociAda = calcolaProfiloAcusticoAdaEvac(progetto);
  const ceEvac = progetto.sistemiIrai.flatMap((s) =>
    s.causaEffetto
      .filter((c) => c.attivaEvac)
      .map((c) => ({
        iraiSigla: s.sigla,
        zona: s.zone.find((z) => z.id === c.causaZonaId)?.codice ?? 'TUTTE',
        c,
      }))
  );
  const lineeAlimEvac = progetto.linee.filter(
    (l) =>
      l.tipoUtenza === 'centrale_evac' ||
      l.tipoUtenza === 'amplificatore_evac' ||
      l.tipoUtenza === 'ups_sicurezza'
  );
  const nonConformiEvac = esiti.filter(
    (e) => e.categoria === 'evac' && e.stato === 'non_conforme' && !e.derogata
  );

  if (formato === 'pdf') {
    const { doc, addHeading, addParagraph, addBullets } = creaPdfAppendiceABuilder(
      progetto,
      calcolo,
      'RELAZIONE TECNICO-DESCRITTIVA E ACUSTICA EVAC (UNI 11988:2025 — APPENDICE A.3.3)',
      'UNI 11988:2025 Appendice A.3.3 & A.3.5'
    );

    addHeading('A.3.3 a) Planimetrie Edificio, Zone Allarme Vocale, Confini ADA e Postazioni Microfoniche');
    addBullets([
      `Riferimento sito: ${progetto.identificativi.sito} — Attività: ${progetto.attivitaNome} (Livello Prestazione ${progetto.livelloPrestazione}).`,
      `Zone di allarme vocale e Aree Acusticamente Distinguibili (ADA) configurate: ${vociAda.map((v) => `${v.adaCodice} [${v.zonaNome}]`).join('; ') || 'Nessuna ADA configurata'}.`,
      `Ubicazione microfoni di emergenza (sale di controllo / punti di presidio) e centrali VACIE (${progetto.sistemiEvac.map((s) => `${s.sigla} ${s.modelloCentrale}`).join(', ') || 'Nessuna'}): posa dedicata in centrale di controllo antincendio / reception presidiata, con indicazione planimetrica nelle tavole A.3.5.`,
    ]);

    addHeading('A.3.3 b) Piano di Gestione delle Emergenze (Priorità e Attivazioni IRAI-EVAC)');
    addBullets([
      'Gerarchia di priorità segnali VACIE (EN 54-16): 1) Microfono Vigili del Fuoco / Emergenza VdF; 2) Microfono di Emergenza di presidio locale; 3) Messaggio vocale preregistrato di evacuazione immediata; 4) Messaggio di allerta / pre-allarme; 5) Annunci operativi / musica di servizio (esclusi automaticamente in allarme).',
      ...(ceEvac.length > 0
        ? ceEvac.map(
            (r) =>
              `Attivazione IRAI ${r.iraiSigla} [Zona ${r.zona}]: ${r.c.causaDescrizione} -> Messaggio EVAC "${r.c.messaggioEvac || 'Evacuazione vocale'}" (ritardo ${r.c.ritardoSecondi} s).`
          )
        : ['Collegamento matrice Causa-Effetto IRAI <-> VACIE mediante interfaccia seriale/contatti sorvegliati resistenti al fuoco.']),
    ]);

    addHeading('A.3.3 c) Relazione Acustica — Elenco ADA, RT60 e Rumore Ambientale (125 Hz ÷ 8 kHz)');
    if (vociAda.length === 0) {
      addParagraph('Nessuna ADA / linea diffusori configurata.');
    } else {
      vociAda.forEach((v) => {
        addParagraph(
          `• ${v.adaCodice} (${v.sistemaSigla}/${v.lineaSigla} — ${v.zonaNome}): ${v.numDiffusori} diffusori (${v.potenzaSingoloDiffusoreW} W/pz, tot ${v.potenzaTotaleW} W)`,
          true,
          7.6,
          15
        );
        addParagraph(
          `  RT60 [125|250|500|1k|2k|4k|8k Hz] (s): ${v.rt60BandeS.join(' | ')} s`,
          false,
          7.3,
          17
        );
        addParagraph(
          `  Rumore ambientale [125..8k Hz] (dB): ${v.rumoreBandeDb.join(' | ')} dB — Fonte: ${v.fonteDatoRumore}`,
          false,
          7.3,
          17
        );
      });
    }

    addHeading('A.3.3 d÷e) Condizioni Ambientali e Descrizione degli Ambienti di Installazione');
    addBullets([
      `Condizioni ambientali di progetto: Temperatura = ${progetto.ambiente.temperaturaAmbienteC} °C, grado di protezione minimo = ${progetto.ambiente.gradoIPRichiesto}, ambiente Ma.R.C.I. = ${progetto.ambiente.ambienteMarci ? 'Sì' : 'No'}; apparecchiature conformi a umidità relativa di progetto senza condensa, protezione da atmosfere corrosive e compatibilità EMC rispetto a forti campi elettromagnetici.`,
      `Descrizione ambienti installazione (${progetto.ambiente.tipoLocale.replace(/_/g, ' ')}): le centrali VACIE e gli armadi amplificatori sono collocati in locale tecnico antincendio / centrale di controllo protetta; i diffusori acustici servono sia aree densamente occupate sia eventuali aree tecnicamente critiche/rumorose con adeguata pressione sonora SPL (>= +10÷15 dB sul rumore ambientale).`,
    ]);

    addHeading('A.3.3 f÷g) Criterio di Scelta Dispositivi e Dimensionamento Potenza Diffusori & Amplificatori');
    progetto.sistemiEvac.forEach((sys) => {
      const res = calcolo.evac[sys.id];
      addParagraph(
        `• VACIE ${sys.sigla} (${sys.modelloCentrale}): Potenza totale diffusori = ${res?.potenzaTotaleAltoparlantiW ?? 0} W | Richiesta con margine ${sys.marginePotenzaRichiestoPct}% = ${res?.potenzaRichiestaConMargineW ?? 0} W | Amplificatori attivi = ${res?.potenzaAmplificatoriAttiviW ?? 0} W | Riserva N+1: ${res?.haAmplificatoreRiserva ? 'Presente' : 'Assente'}.`,
        false,
        7.5,
        15
      );
      sys.lineeAltoparlanti.forEach((ln) => {
        const pUnit =
          ln.numeroAltoparlanti > 0
            ? (ln.potenzaTotaleAltoparlantiW / ln.numeroAltoparlanti).toFixed(2)
            : '0';
        const rl = res?.lineeRisultati.find((r) => r.lineaId === ln.id);
        addParagraph(
          `  - ${ln.sigla} (${ln.zonaNome}): ${ln.numeroAltoparlanti} diff. EN 54-24 × ${pUnit} W = ${ln.potenzaTotaleAltoparlantiW} W (carico amp ${rl?.caricoAmplificatorePct ?? 0}%)`,
          false,
          7.3,
          17
        );
      });
    });

    addHeading('A.3.3 h) Calcolo dei Consumi e delle Autonomie (EN 54-4)');
    progetto.sistemiEvac.forEach((sys) => {
      const res = calcolo.evac[sys.id];
      addParagraph(
        `• EVAC ${sys.sigla}: Iq=${sys.correnteQuieteA}A (${sys.autonomiaQuieteRichiestaOre}h), Ia=${sys.correnteAllarmeA}A (${sys.autonomiaAllarmeRichiestaMin}min) -> Installata ${sys.capacitaBatterieInstallataAh} Ah >= Minima ${res?.capacitaBatterieMinimaAh ?? 0} Ah | ${res?.formulaBatterie ?? ''}`,
        false,
        7.4,
        15
      );
    });

    addHeading('A.3.3 i) Dimensionamento Cavi EVAC e Specifica Precisa Tipologia Cavi Ammessi');
    progetto.sistemiEvac.forEach((sys) => {
      const res = calcolo.evac[sys.id];
      sys.lineeAltoparlanti.forEach((ln) => {
        const rl = res?.lineeRisultati.find((r) => r.lineaId === ln.id);
        addParagraph(
          `• ${sys.sigla}/${ln.sigla} (${ln.zonaNome}): ${ln.lunghezzaM} m, ${ln.sezioneMm2} mm² ${ln.resistenzaFuoco}, ${ln.tensioneLineaV}V ${ln.topologia} -> ${rl?.formulaDettaglio ?? ''}`,
          false,
          7.2,
          15
        );
      });
    });
    addBullets([
      'Linee altoparlanti 100V/70V (radiali o ad anello con isolatori): cavi schermati a coppie twistate resistenti al fuoco conformi CEI 20-105 / CEI 20-45 / EN 50200 (minimo PH30; PH120 su dorsali e attraversamenti compartimenti), isolamento LS0H, guaina ROSSO/VIOLA, classe CPR >= Cca-s1b,d1,a1 (B2ca in vie esodo/Ma.R.C.I.).',
      'Interconnessioni IRAI-VACIE e bus microfoni di emergenza: cavi schermati CEI 20-105 resistenti al fuoco PH120 (o PH30 ove ammesso in compartimento singolo) posati in condutture dedicate.',
      'Alimentazioni primarie 230/400V per VACIE e armadi amplificatori: cavi FTG18OM16 PH120 CEI 20-45 derivati da quadro dedicato e separati dai circuiti ordinari (CEI 64-8 Cap. 56).',
    ]);

    addHeading('A.3.5 (a ÷ g) Requisiti per Disegni di Layout Grafico dell’Impianto EVAC');
    addBullets([
      'a) Orientamento della planimetria chiaramente indicato (rosa dei venti / Nord); b) Sezioni verticali di ogni piano con altezza di installazione altoparlanti ed elementi strutturali influenti (travi, controsoffitti, scaffalature); c) Ambienti esclusi dalla copertura; d-e) Tipologia/ubicazione di tutti i componenti e connessioni; f) Collegamento con eventuale presidio remoto di segnalazione; g) Legenda completa dei simboli utilizzati.',
    ]);

    doc.save(`${progetto.identificativi.commessa}_EVAC_UNI11988_A33_Relazione_Tecnica.pdf`);
    return;
  }

  const body = `
    <h1>RELAZIONE TECNICO-DESCRITTIVA E ACUSTICA EVAC (UNI 11988:2025 — APPENDICE A.3.3 &amp; A.3.5)</h1>
    <div class="meta">
      <strong>Commessa:</strong> ${progetto.identificativi.commessa} | <strong>Cliente:</strong> ${progetto.identificativi.cliente}<br/>
      <strong>Sito / Attività:</strong> ${progetto.identificativi.sito} — ${progetto.attivitaNome} (Livello Prestazione: <strong>${progetto.livelloPrestazione}</strong>)<br/>
      <strong>Progettista:</strong> ${progetto.identificativi.progettista} | <strong>Rev.:</strong> ${progetto.identificativi.revisione} del ${progetto.identificativi.data} | <strong>Motore:</strong> ElettroCAD ${calcolo.versioneApp}
    </div>

    <h2>A.3.3 a) Planimetrie Edificio, Zone Allarme Vocale, Confini ADA e Microfoni di Emergenza</h2>
    <p>Le planimetrie di progetto (tavole <strong>A.3.5</strong>) individuano i confini delle zone di allarme vocale, la perimetrazione delle singole <strong>ADA (Aree Acusticamente Distinguibili)</strong> appartenenti a ciascuna zona, le postazioni dei <strong>microfoni di emergenza</strong> in sala di controllo / punti di presidio e l'ubicazione di tutte le unità VACIE, armadi rack amplificazione e diffusori sonori EN 54-24.</p>
    <table>
      <thead><tr><th>Codice ADA</th><th>Sistema / Linea</th><th>Zona Allarme Vocale</th><th>Ubicazione Microfoni / Presidio</th></tr></thead>
      <tbody>
        ${
          vociAda.length === 0
            ? '<tr><td colspan="4">Nessuna zona/ADA EVAC configurata.</td></tr>'
            : vociAda
                .map(
                  (v) =>
                    `<tr><td class="mono">${v.adaCodice}</td><td class="mono">${v.sistemaSigla} / ${v.lineaSigla}</td><td>${v.zonaNome}</td><td>Centrale di controllo / Punto di presidio antincendio (${v.sistemaSigla})</td></tr>`
                )
                .join('')
        }
      </tbody>
    </table>

    <h2>A.3.3 b) Piano di Gestione delle Emergenze</h2>
    <p>Il sistema EVAC opera in integrazione bidirezionale con l'impianto di rivelazione incendio IRAI mediante matrice causa-effetto e livelli di priorità gerarchici conformi EN 54-16 / UNI 11988:2025:</p>
    <ol>
      <li><strong>Priorità 1 (Massima):</strong> Microfono di emergenza Vigili del Fuoco / postazione master antincendio (commutazione manuale immediata con interruzione di qualsiasi altro segnale).</li>
      <li><strong>Priorità 2:</strong> Messaggi vocali di evacuazione preregistrati ad attivazione automatica da centrale IRAI secondo matrice Causa-Effetto.</li>
      <li><strong>Priorità 3:</strong> Messaggi di preallarme / istruzioni selettive per singola zona o ADA in gestione fasi di sfollamento.</li>
      <li><strong>Priorità 4 (Esclusa in emergenza):</strong> Diffusione annunci operativi o audio di servizio.</li>
    </ol>
    ${
      ceEvac.length > 0
        ? `<table>
             <thead><tr><th>IRAI</th><th>Zona Origine</th><th>Evento Causa</th><th>Messaggio / Azione EVAC</th><th>Ritardo</th></tr></thead>
             <tbody>
               ${ceEvac
                 .map(
                   (r) =>
                     `<tr><td class="mono">${r.iraiSigla}</td><td class="mono">${r.zona}</td><td>${r.c.causaDescrizione}</td><td>${r.c.messaggioEvac || 'Attivazione allarme vocale'}</td><td>${r.c.ritardoSecondi} s</td></tr>`
                 )
                 .join('')}
             </tbody>
           </table>`
        : ''
    }

    <h2>A.3.3 c) Relazione Acustica — Elenco ADA, Tempo di Riverberazione (RT60) e Rumore Ambientale (125 Hz ÷ 8 kHz)</h2>
    <p><strong>Criteri normativi UNI 11988:2025:</strong> per ciascuna ADA in ogni zona di emergenza sono riportati il tempo di riverberazione previsto o misurato e il livello di rumore ambientale per bande di ottava da <strong>125 Hz a 8 kHz</strong>. Negli edifici esistenti il rumore ambientale deve essere misurato direttamente in opera; nei nuovi edifici è ricavato da tabelle esistenti / <strong>Prospetto 24 della UNI 9795:2021</strong>.</p>
    <h3>1) Elenco delle ADA per Zona di Emergenza EVAC</h3>
    <table>
      <thead><tr><th>Codice ADA</th><th>Sistema / Linea</th><th>Zona Emergenza</th><th>N. Diffusori</th><th>Potenza Singolo Diff.</th><th>Potenza Totale</th></tr></thead>
      <tbody>
        ${vociAda
          .map(
            (v) =>
              `<tr><td class="mono">${v.adaCodice}</td><td class="mono">${v.sistemaSigla} / ${v.lineaSigla}</td><td>${v.zonaNome}</td><td>${v.numDiffusori}</td><td>${v.potenzaSingoloDiffusoreW} W</td><td>${v.potenzaTotaleW} W</td></tr>`
          )
          .join('')}
      </tbody>
    </table>

    <h3>2) Tempo di Riverberazione RT60 (s) per Bande di Ottava (125 Hz ÷ 8 kHz)</h3>
    <table>
      <thead><tr><th>Codice ADA</th><th>Zona</th>${BANDE_OTTAVA_HZ.map((b) => `<th>${b}</th>`).join('')}</tr></thead>
      <tbody>
        ${vociAda
          .map(
            (v) =>
              `<tr><td class="mono">${v.adaCodice}</td><td>${v.zonaNome}</td>${v.rt60BandeS
                .map((rt) => `<td class="mono">${rt.toFixed(2)} s</td>`)
                .join('')}</tr>`
          )
          .join('')}
      </tbody>
    </table>

    <h3>3) Livello di Rumore Ambientale (dB SPL) per Bande di Ottava (125 Hz ÷ 8 kHz)</h3>
    <table>
      <thead><tr><th>Codice ADA</th>${BANDE_OTTAVA_HZ.map((b) => `<th>${b}</th>`).join('')}<th>Origine Dato</th></tr></thead>
      <tbody>
        ${vociAda
          .map(
            (v) =>
              `<tr><td class="mono">${v.adaCodice}</td>${v.rumoreBandeDb
                .map((db) => `<td class="mono">${db} dB</td>`)
                .join('')}<td>${v.fonteDatoRumore}</td></tr>`
          )
          .join('')}
      </tbody>
    </table>

    <h2>A.3.3 d÷e) Condizioni Ambientali e Descrizione degli Ambienti di Installazione</h2>
    <table>
      <tr><th>Parametro Ambientale (A.3.3 d)</th><th>Specifica di Progetto</th></tr>
      <tr><td>Temperatura ambiente / Umidità</td><td>T<sub>amb</sub> = ${progetto.ambiente.temperaturaAmbienteC} °C; escursione igrometrica priva di condensa sulle apparecchiature VACIE/diffusori.</td></tr>
      <tr><td>Atmosfera corrosiva / Campi EMC</td><td>Idoneità involucri e diffusori a grado minimo <strong>${progetto.ambiente.gradoIPRichiesto}</strong>; cavi schermati contro forti campi elettromagnetici; ambiente Ma.R.C.I.: <strong>${progetto.ambiente.ambienteMarci ? 'Sì' : 'No'}</strong>.</td></tr>
      <tr><th>Descrizione Ambienti (A.3.3 e)</th><th>Tipologia e Protezione</th></tr>
      <tr><td>Ambienti installazione apparecchiature</td><td>Tipologia prevalente: <strong>${progetto.ambiente.tipoLocale.replace(/_/g, ' ')}</strong>. Centrali VACIE e amplificatori installati in locale tecnico / centrale di controllo presidiata; diffusori dimensionati per aree densamente occupate ed eventuali aree potenzialmente pericolose o rumorose.</td></tr>
    </table>

    <h2>A.3.3 f÷g) Criterio di Scelta Dispositivi e Dimensionamento Potenza Diffusori &amp; Amplificatori</h2>
    <p><strong>Criterio di scelta (A.3.3 f):</strong> apparecchiature di controllo e indicazione vocale (VACIE) certificate <strong>EN 54-16</strong>, alimentatori e caricabatterie <strong>EN 54-4</strong>, altoparlanti certificati <strong>EN 54-24</strong> (Tipo A/B in funzione di installazione interna/esterna) con selettore di presa di potenza a 100V/70V per garantire margine acustico rispetto al rumore ambientale e intelligibilità STI &ge; 0,50.</p>
    <table>
      <thead><tr><th>VACIE / Linea</th><th>Zona / ADA</th><th>N. Diff.</th><th>P<sub>diffusore</sub></th><th>P<sub>totale</sub></th><th>Carico Amp.</th><th>Verifica Amplificatori VACIE</th></tr></thead>
      <tbody>
        ${progetto.sistemiEvac
          .flatMap((sys) => {
            const res = calcolo.evac[sys.id];
            return sys.lineeAltoparlanti.map((ln, idx) => {
              const pUnit =
                ln.numeroAltoparlanti > 0
                  ? (ln.potenzaTotaleAltoparlantiW / ln.numeroAltoparlanti).toFixed(2)
                  : '0';
              const rl = res?.lineeRisultati.find((r) => r.lineaId === ln.id);
              const riepilogoAmp =
                idx === 0
                  ? `Attivi ${res?.potenzaAmplificatoriAttiviW ?? 0} W vs Rich. ${res?.potenzaRichiestaConMargineW ?? 0} W (marg. ${sys.marginePotenzaRichiestoPct}%, Riserva N+1: ${res?.haAmplificatoreRiserva ? 'Sì' : 'No'})`
                  : 'Vedi sistema VACIE';
              return `<tr><td class="mono">${sys.sigla} / ${ln.sigla}</td><td>${ln.zonaNome}</td><td>${ln.numeroAltoparlanti}</td><td>${pUnit} W</td><td>${ln.potenzaTotaleAltoparlantiW} W</td><td>${rl?.caricoAmplificatorePct ?? 0}%</td><td>${riepilogoAmp}</td></tr>`;
            });
          })
          .join('')}
      </tbody>
    </table>

    <h2>A.3.3 h) Calcolo Analitico dei Consumi e delle Autonomie (EN 54-4)</h2>
    <table>
      <thead><tr><th>Sistema VACIE</th><th>I<sub>q</sub> / I<sub>a</sub></th><th>Autonomia Richiesta</th><th>Installata vs Minima</th><th>Formula Applicata</th></tr></thead>
      <tbody>
        ${progetto.sistemiEvac
          .map((sys) => {
            const res = calcolo.evac[sys.id];
            return `<tr><td class="mono">${sys.sigla} — ${sys.nome}</td><td>${sys.correnteQuieteA} A / ${sys.correnteAllarmeA} A</td><td>${sys.autonomiaQuieteRichiestaOre} h + ${sys.autonomiaAllarmeRichiestaMin} min</td><td><strong>${sys.capacitaBatterieInstallataAh} Ah</strong> &ge; ${res?.capacitaBatterieMinimaAh ?? 0} Ah</td><td class="mono">${res?.formulaBatterie ?? ''}</td></tr>`;
          })
          .join('')}
      </tbody>
    </table>

    <h2>A.3.3 i) Dimensionamento dei Cavi e Specifica Tecnica Precisa dei Cavi Ammessi</h2>
    <h3>Linee Altoparlanti 100V / 70V</h3>
    <table>
      <thead><tr><th>VACIE / Linea</th><th>Zona</th><th>Topologia / Carico</th><th>L / Sez. / Res. Fuoco</th><th>I (A)</th><th>ΔV (V / %)</th><th>Att. / L<sub>max</sub></th><th>Esito</th></tr></thead>
      <tbody>
        ${progetto.sistemiEvac
          .flatMap((sys) => {
            const res = calcolo.evac[sys.id];
            return sys.lineeAltoparlanti.map((ln) => {
              const rl = res?.lineeRisultati.find((r) => r.lineaId === ln.id);
              return `<tr><td class="mono">${sys.sigla} / ${ln.sigla}</td><td>${ln.zonaNome}</td><td>${ln.topologia} (${ln.distribuzioneCarico ?? 'concentrato'})</td><td>${ln.lunghezzaM}m · ${ln.sezioneMm2}mm² · ${ln.resistenzaFuoco}</td><td>${rl?.correnteLineaA ?? 0}</td><td>${rl?.cadutaTensioneV ?? 0}V (${rl?.cadutaTensionePct ?? 0}%)</td><td>${rl?.attenuazioneDb ?? 0}dB / ${rl?.lunghezzaMassimaAmmissibileM ?? 0}m</td><td><strong>${rl?.conformeCadutaTensione ? 'CONFORME' : `NON CONFORME (min ${rl?.sezioneMinimaConsigliataMm2}mm²)`}</strong></td></tr>`;
            });
          })
          .join('')}
      </tbody>
    </table>

    ${
      lineeAlimEvac.length > 0
        ? `<h3>Linee di Alimentazione Dedicate EVAC / UPS</h3>
           <table>
             <thead><tr><th>Linea</th><th>Utenza</th><th>Protezione</th><th>Cavo / Resistenza Fuoco</th><th>L (m)</th><th>I<sub>b</sub> / I<sub>z</sub> (A)</th><th>ΔV (%)</th></tr></thead>
             <tbody>
               ${lineeAlimEvac
                 .map((l) => {
                   const rl = calcolo.linee[l.id];
                   return `<tr><td class="mono">${l.sigla}</td><td>${l.descrizione}</td><td>${rl?.siglaProtezioneCompleta ?? ''}</td><td>${rl?.siglaCavoCompleta ?? ''}</td><td>${l.lunghezzaM}</td><td>${rl?.correnteImpiegoIbA ?? 0} / ${rl?.portataCorrettaIzA ?? 0}</td><td>${rl?.cadutaTensionePct ?? 0}%</td></tr>`;
                 })
                 .join('')}
             </tbody>
           </table>`
        : ''
    }

    <div class="box">
      <strong>Indicazione Tecnica Precisa dei Cavi Ammessi per Collegamento (UNI 11988:2025 A.3.3 i):</strong>
      <ul>
        <li><strong>Linee altoparlanti 100V/70V (dorsali e diramazioni):</strong> cavi schermati a coppie cordate (twistate) resistenti al fuoco conformi <strong>CEI 20-105 / CEI 20-45 / EN 50200</strong> con prestazione minima <strong>PH30</strong> (o <strong>PH120</strong> per montanti, attraversamenti di compartimento o vie di esodo critiche), isolamento LS0H, guaina di colore distintivo <strong>ROSSO o VIOLA</strong>, classe CPR &ge; C<sub>ca</sub>-s1b,d1,a1 (B2<sub>ca</sub> in ambienti Ma.R.C.I.).</li>
        <li><strong>Collegamento di interconnessione IRAI &harr; VACIE e bus microfoni di emergenza:</strong> cavi schermati resistenti al fuoco <strong>CEI 20-105 PH120</strong> (o PH30 entro compartimento protetto) in tubazione/canale dedicato e separato da circuiti ordinari.</li>
        <li><strong>Alimentazione elettrica primaria 230/400 V VACIE e rack amplificatori:</strong> cavo resistente al fuoco tipo <strong>FTG18OM16 PH120</strong> (CEI 20-45 / EN 50200) posato in via esclusiva a monte dell'interruttore generale ordinario (CEI 64-8 Cap. 56).</li>
      </ul>
    </div>

    <h2>A.3.5 (a ÷ g) Checklist Obbligatoria per Disegni di Layout Grafico dell'Impianto EVAC</h2>
    <ul>
      <li><strong>a)</strong> Orientamento della planimetria chiaramente indicato su ogni tavola di piano;</li>
      <li><strong>b)</strong> Sezioni verticali di ciascun piano dell'edificio con indicazione delle quote di posizionamento degli altoparlanti ed elementi strutturali che ne influenzano la collocazione;</li>
      <li><strong>c)</strong> Individuazione chiara degli ambienti esclusi dalla copertura acustica del sistema EVAC;</li>
      <li><strong>d)</strong> Tipologia e ubicazione esatta di tutti i componenti costituenti l'impianto (VACIE, amplificatori, microfoni, diffusori, isolatori);</li>
      <li><strong>e)</strong> Tipologia e tracciato di tutte le connessioni fra i componenti dell'impianto (linee radiali/anello, interfacce, alimentazioni);</li>
      <li><strong>f)</strong> Posizione e caratteristiche di ogni collegamento con eventuale presidio remoto di segnalazione;</li>
      <li><strong>g)</strong> Legenda completa dei simboli utilizzati (coordinata con gli schemi DXF A.3.4 e A.3.6).</li>
    </ul>

    <p class="mono">Esiti verifiche EVAC attive: ${esiti.filter((e) => e.categoria === 'evac').length} verifiche | Non conformità aperte: ${nonConformiEvac.length}.</p>
  `;

  downloadBlob(
    new Blob(
      [buildAppendiceAHtmlShell('Relazione Tecnica e Acustica EVAC UNI 11988 A.3.3', progetto.identificativi.commessa, body)],
      { type: 'application/msword;charset=utf-8' }
    ),
    `${progetto.identificativi.commessa}_EVAC_UNI11988_A33_Relazione_Tecnica.doc`
  );
}

export function esportaEvacUni11988_ElencoComponentiAcusticaXlsx(
  progetto: ProgettoAntincendio,
  calcolo: RisultatoCalcoloCompleto,
  esiti: EsitoVerifica[]
) {
  const wb = XLSX.utils.book_new();

  const registro = costruisciRegistroElaboratiEvacUni11988(progetto).map((r) => ({
    Numero_Riferimento: r.codice,
    Rif_UNI_11988: r.riferimentoAppendiceA,
    Titolo_Elaborato: r.titolo,
    Emissione: r.emissione,
    Data: r.data,
    Formato: r.formato,
  }));

  const vacieAmpl = progetto.sistemiEvac.flatMap((sys) => {
    const res = calcolo.evac[sys.id];
    return [
      {
        VACIE_Sigla: sys.sigla,
        Tipo_Elemento: 'Centrale VACIE (EN 54-16 / EN 54-4)',
        Modello: sys.modelloCentrale,
        Potenza_W: res?.potenzaAmplificatoriAttiviW ?? 0,
        Ruolo_Dettagli: `${sys.nome} | Riserva N+1: ${res?.haAmplificatoreRiserva ? 'Sì' : 'No'} | Batt: ${sys.capacitaBatterieInstallataAh}Ah (min ${res?.capacitaBatterieMinimaAh ?? 0}Ah)`,
      },
      ...sys.amplificatori.map((a) => ({
        VACIE_Sigla: sys.sigla,
        Tipo_Elemento: 'Amplificatore Potenza (EN 54-16)',
        Modello: `${a.sigla} — ${a.modello}`,
        Potenza_W: a.potenzaNominaleW,
        Ruolo_Dettagli: a.diRiserva ? 'Amplificatore di Riserva N+1' : 'Amplificatore Attivo',
      })),
    ];
  });

  const lineeDiffusori = progetto.sistemiEvac.flatMap((sys) => {
    const res = calcolo.evac[sys.id];
    return sys.lineeAltoparlanti.map((ln) => {
      const rl = res?.lineeRisultati.find((r) => r.lineaId === ln.id);
      const pUnit =
        ln.numeroAltoparlanti > 0
          ? Number((ln.potenzaTotaleAltoparlantiW / ln.numeroAltoparlanti).toFixed(2))
          : 0;
      return {
        VACIE: sys.sigla,
        Linea_Sigla: ln.sigla,
        Zona_ADA: ln.zonaNome,
        Topologia: ln.topologia,
        Distribuzione: ln.distribuzioneCarico ?? 'concentrato',
        Tensione_V: ln.tensioneLineaV,
        N_Diffusori_EN54_24: ln.numeroAltoparlanti,
        Potenza_Singolo_Diffusore_W: pUnit,
        Potenza_Totale_W: ln.potenzaTotaleAltoparlantiW,
        Lunghezza_m: ln.lunghezzaM,
        Sezione_mm2: ln.sezioneMm2,
        Resistenza_Fuoco: ln.resistenzaFuoco,
        Corrente_A: rl?.correnteLineaA ?? 0,
        DeltaV_V: rl?.cadutaTensioneV ?? 0,
        DeltaV_Pct: rl?.cadutaTensionePct ?? 0,
        Attenuazione_dB: rl?.attenuazioneDb ?? 0,
        L_Max_Ammissibile_m: rl?.lunghezzaMassimaAmmissibileM ?? 0,
        Sez_Min_Consigliata_mm2: rl?.sezioneMinimaConsigliataMm2 ?? ln.sezioneMm2,
        Conforme_Caduta: rl?.conformeCadutaTensione ? 'Sì' : 'No',
      };
    });
  });

  const acusticaAda = calcolaProfiloAcusticoAdaEvac(progetto).map((v) => ({
    Codice_ADA: v.adaCodice,
    VACIE_Linea: `${v.sistemaSigla}/${v.lineaSigla}`,
    Zona_Emergenza: v.zonaNome,
    RT60_125Hz_s: v.rt60BandeS[0],
    RT60_250Hz_s: v.rt60BandeS[1],
    RT60_500Hz_s: v.rt60BandeS[2],
    RT60_1kHz_s: v.rt60BandeS[3],
    RT60_2kHz_s: v.rt60BandeS[4],
    RT60_4kHz_s: v.rt60BandeS[5],
    RT60_8kHz_s: v.rt60BandeS[6],
    Rumore_125Hz_dB: v.rumoreBandeDb[0],
    Rumore_250Hz_dB: v.rumoreBandeDb[1],
    Rumore_500Hz_dB: v.rumoreBandeDb[2],
    Rumore_1kHz_dB: v.rumoreBandeDb[3],
    Rumore_2kHz_dB: v.rumoreBandeDb[4],
    Rumore_4kHz_dB: v.rumoreBandeDb[5],
    Rumore_8kHz_dB: v.rumoreBandeDb[6],
    Fonte_Dato: v.fonteDatoRumore,
  }));

  const autonomieAlim = [
    ...progetto.sistemiEvac.map((sys) => {
      const res = calcolo.evac[sys.id];
      return {
        Categoria: 'Alimentazione Secondaria VACIE (EN 54-4)',
        Sigla: sys.sigla,
        Descrizione: sys.nome,
        Quiete_Ore: sys.autonomiaQuieteRichiestaOre,
        Allarme_Min: sys.autonomiaAllarmeRichiestaMin,
        Iq_A: sys.correnteQuieteA,
        Ia_A: sys.correnteAllarmeA,
        Batt_Installata_Ah: sys.capacitaBatterieInstallataAh,
        Batt_Minima_Ah: res?.capacitaBatterieMinimaAh ?? 0,
        Dettagli_Formula: res?.formulaBatterie ?? '',
      };
    }),
    ...progetto.linee
      .filter(
        (l) =>
          l.tipoUtenza === 'centrale_evac' ||
          l.tipoUtenza === 'amplificatore_evac' ||
          l.tipoUtenza === 'ups_sicurezza'
      )
      .map((l) => {
        const rl = calcolo.linee[l.id];
        return {
          Categoria: 'Linea Alimentazione Primaria 230/400V',
          Sigla: l.sigla,
          Descrizione: l.descrizione,
          Quiete_Ore: 0,
          Allarme_Min: 0,
          Iq_A: rl?.correnteImpiegoIbA ?? 0,
          Ia_A: rl?.portataCorrettaIzA ?? 0,
          Batt_Installata_Ah: l.lunghezzaM,
          Batt_Minima_Ah: rl?.cadutaTensionePct ?? 0,
          Dettagli_Formula: `${rl?.siglaProtezioneCompleta ?? ''} | ${rl?.siglaCavoCompleta ?? ''}`,
        };
      }),
  ];

  const causaEffettoEvac = progetto.sistemiIrai.flatMap((sys) =>
    sys.causaEffetto
      .filter((c) => c.attivaEvac)
      .map((c) => ({
        Centrale_IRAI: sys.sigla,
        Zona_Origine: sys.zone.find((z) => z.id === c.causaZonaId)?.codice ?? 'TUTTE',
        Evento_Causa: c.causaDescrizione,
        Messaggio_EVAC: c.messaggioEvac || 'Evacuazione vocale',
        Ritardo_s: c.ritardoSecondi,
        Targhe_OA: c.attivaTargheOtticoAcustiche ? 'Sì' : 'No',
        Sgancio_Impianti: c.sgancioImpiantiTecnologici ? 'Sì' : 'No',
      }))
  );

  const conformita = esiti
    .filter((e) => e.categoria === 'evac' || e.targetLabel.toLowerCase().includes('evac'))
    .map((e) => ({
      Codice: e.codice,
      Oggetto: e.targetLabel,
      Stato: e.stato,
      Valore_Calcolato: e.valoreCalcolato,
      Soglia_Attesa: e.sogliaAttesa,
      Derogata: e.derogata ? 'Sì' : 'No',
      Motivazione_Deroga: e.motivazioneDeroga ?? '',
    }));

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(registro), 'Registro Elaborati EVAC');
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(vacieAmpl.length ? vacieAmpl : [{ Nota: 'Nessun sistema EVAC configurato' }]),
    'VACIE e Amplificatori'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(lineeDiffusori.length ? lineeDiffusori : [{ Nota: 'Nessuna linea diffusori' }]),
    'Diffusori e Linee 100V'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(acusticaAda.length ? acusticaAda : [{ Nota: 'Nessuna ADA configurata' }]),
    'ADA Acustica 125Hz-8kHz'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(autonomieAlim.length ? autonomieAlim : [{ Nota: 'Nessun dato alimentazione EVAC' }]),
    'Autonomie e Alimentazioni'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      causaEffettoEvac.length ? causaEffettoEvac : [{ Nota: 'Nessuna attivazione EVAC in Causa-Effetto' }]
    ),
    'Causa-Effetto IRAI-EVAC'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(conformita.length ? conformita : [{ Nota: 'Nessuna verifica EVAC registrata' }]),
    'Conformità UNI 11988'
  );

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${progetto.identificativi.commessa}_EVAC_UNI11988_Componenti_Acustica.xlsx`
  );
}



