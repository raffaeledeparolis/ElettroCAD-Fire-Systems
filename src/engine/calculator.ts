import {
  VERSIONE_APP,
  VERSIONE_LIBRERIA,
  VERSIONE_REGOLE,
} from '../data/rulesAndLibrary';
import {
  AmplificatoreEVAC,
  LineaAltoparlantiEVAC,
  LineaUtenza,
  ProgettoAntincendio,
  RisultatoCalcoloCompleto,
  RisultatoCalcoloEVAC,
  RisultatoCalcoloIRAI,
  RisultatoCalcoloLinea,
  RisultatoCalcoloLineaEVAC,
  RisultatoCalcoloLoop,
  RisultatoCalcoloQuadro,
  TipoPosa,
} from '../types/elettrocad';

const SEZIONI_STANDARD = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120];
export const SEZIONI_EVAC_STANDARD = [1.0, 1.5, 2.5, 4, 6, 10, 16];
const CALIBRI_INTERRUTTORI = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250];
const RHO_RAME_EVAC = 0.018; // Ohm*mm2/m conduttore in rame linee altoparlanti 100V/70V

// Portate base I0 (A) a 30°C per cavi isolati EPR/XLPE (es. FG16OM16 / FTG18OM16) 2/3 conduttori caricati
const PORTATA_BASE_I0: Record<number, { mono: number; tri: number }> = {
  1.5: { mono: 23, tri: 20 },
  2.5: { mono: 31, tri: 28 },
  4: { mono: 42, tri: 37 },
  6: { mono: 54, tri: 48 },
  10: { mono: 75, tri: 66 },
  16: { mono: 100, tri: 88 },
  25: { mono: 133, tri: 117 },
  35: { mono: 164, tri: 144 },
  50: { mono: 198, tri: 175 },
  70: { mono: 253, tri: 222 },
  95: { mono: 306, tri: 269 },
  120: { mono: 354, tri: 312 },
};

function fattorePosa(posa: TipoPosa): number {
  switch (posa) {
    case 'tubo_incassato':
      return 0.78;
    case 'tubo_a_vista':
      return 0.88;
    case 'canale_passerella':
      return 0.95;
    case 'interrato':
      return 0.9;
    case 'aria_libera':
      return 1.0;
  }
}

function fattoreTemperatura(tempC: number): number {
  if (tempC <= 20) return 1.08;
  if (tempC <= 25) return 1.04;
  if (tempC <= 30) return 1.0;
  if (tempC <= 35) return 0.96;
  if (tempC <= 40) return 0.91;
  if (tempC <= 45) return 0.87;
  if (tempC <= 50) return 0.82;
  return 0.76;
}

function fattoreRaggruppamento(nCircuiti: number): number {
  if (nCircuiti <= 1) return 1.0;
  if (nCircuiti === 2) return 0.8;
  if (nCircuiti === 3) return 0.7;
  if (nCircuiti === 4) return 0.65;
  if (nCircuiti === 5) return 0.6;
  if (nCircuiti <= 7) return 0.54;
  return 0.5;
}

function siglaTipoPosa(posa: TipoPosa): string {
  switch (posa) {
    case 'tubo_incassato':
      return 'Tubo incassato (B1)';
    case 'tubo_a_vista':
      return 'Tubo a vista (B2)';
    case 'canale_passerella':
      return 'Passerella / Canale (E)';
    case 'interrato':
      return 'Interrato protetto (D)';
    case 'aria_libera':
      return 'Posa in aria libera (F)';
  }
}

export function calcolaLinea(
  linea: LineaUtenza,
  progetto: ProgettoAntincendio
): RisultatoCalcoloLinea {
  const rho = 0.0225; // Ohm*mm2/m rame a regime termico
  const reactance = 0.00008; // Ohm/m
  const cosPhi = Math.max(0.5, Math.min(1, linea.cosPhi || 0.9));
  const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
  const rendimento = Math.max(0.4, Math.min(1, linea.rendimento || 0.9));
  const ku = Math.max(0.1, Math.min(1, linea.coefficienteUtilizzoKu || 1));
  const kc = Math.max(0.1, Math.min(1, linea.coefficienteContemporaneitaKc || 1));
  const tensione = linea.tensioneV || (linea.tipoFornitura === 'trifase' ? 400 : 230);

  const potenzaAssorbitaW = linea.potenzaNominaleW * ku;
  const potenzaContemporaneaW = potenzaAssorbitaW * kc;

  const fattoreFasi = linea.tipoFornitura === 'trifase' ? Math.sqrt(3) : 1;
  const fattoreLoop = linea.tipoFornitura === 'trifase' ? Math.sqrt(3) : 2;

  const correnteImpiegoIbA =
    potenzaAssorbitaW / (fattoreFasi * tensione * cosPhi * rendimento);
  const correnteSpuntoA = correnteImpiegoIbA * Math.max(1, linea.rapportoIaIn || 1);

  const kt = fattoreTemperatura(linea.temperaturaPosaC || progetto.ambiente.temperaturaAmbienteC);
  const kg = fattoreRaggruppamento(linea.circuitiRaggruppati || 1);
  const kp = fattorePosa(linea.tipoPosa);

  // Scelta calibro protezione In >= Ib
  const protezioneSceltaInA =
    linea.protezioneInManualeA && linea.protezioneInManualeA > 0
      ? linea.protezioneInManualeA
      : CALIBRI_INTERRUTTORI.find((c) => c >= correnteImpiegoIbA) ?? 250;

  // Scelta sezione cavo S
  let sezioneSceltaMm2 = linea.sezioneManualeMm2 ?? 1.5;
  if (!linea.sezioneManualeMm2) {
    const candidata = SEZIONI_STANDARD.find((s) => {
      const base =
        linea.tipoFornitura === 'trifase'
          ? PORTATA_BASE_I0[s].tri
          : PORTATA_BASE_I0[s].mono;
      const iz = base * kp * kt * kg;
      const dv =
        fattoreLoop *
        linea.lunghezzaM *
        correnteImpiegoIbA *
        ((rho / s) * cosPhi + reactance * sinPhi);
      const dvPct = (dv / tensione) * 100;
      const minSezioneSicurezza = s >= 1.5;
      return minSezioneSicurezza && iz >= protezioneSceltaInA && dvPct <= 4.0;
    });
    sezioneSceltaMm2 = candidata ?? 120;
  }

  const baseInfo = PORTATA_BASE_I0[sezioneSceltaMm2] ?? PORTATA_BASE_I0[2.5];
  const portataBaseI0A =
    linea.tipoFornitura === 'trifase' ? baseInfo.tri : baseInfo.mono;
  const portataCorrettaIzA = Number((portataBaseI0A * kp * kt * kg).toFixed(2));

  const cadutaTensioneV =
    fattoreLoop *
    linea.lunghezzaM *
    correnteImpiegoIbA *
    ((rho / sezioneSceltaMm2) * cosPhi + reactance * sinPhi);
  const cadutaTensionePct = (cadutaTensioneV / tensione) * 100;
  const cadutaTensioneAvviamentoPct =
    cadutaTensionePct * Math.max(1, linea.rapportoIaIn || 1);

  // Cortocircuito presunta fine linea (stima conservativa con impedenza monte + cavo)
  const quadro = progetto.quadri.find((q) => q.id === linea.quadroId);
  const iccMonteKa = quadro?.iccQuadroKa ?? progetto.fornitura.iccPuntoConsegnaKa ?? 6;
  const zMonte = (tensione / fattoreFasi) / (iccMonteKa * 1000);
  const rCavo = (2 * linea.lunghezzaM * rho) / sezioneSceltaMm2;
  const zTot = Math.sqrt(Math.pow(zMonte + rCavo, 2) + Math.pow(linea.lunghezzaM * reactance, 2));
  const iccPresuntaFineLineaKa = Number(
    (((tensione / fattoreFasi) / Math.max(0.01, zTot)) / 1000).toFixed(2)
  );

  // Energia specifica I2t (stima intervento istantaneo <= 0.01s) vs k2*S2 (k=143 per EPR/XLPE rame)
  const energiaSpecificaI2t = Math.round(
    Math.pow(iccPresuntaFineLineaKa * 1000, 2) * 0.01
  );
  const kCavo = 143;
  const resistenzaTermicaCavoK2S2 = Math.round(
    Math.pow(kCavo, 2) * Math.pow(sezioneSceltaMm2, 2)
  );

  // Verifica contatti indiretti
  let verificaContattiIndirettiOk: boolean | null = null;
  const u0 = 230;
  if (progetto.fornitura.sistemaDistribuzione === 'TT') {
    if (progetto.fornitura.resistenzaTerraReOhm != null) {
      if (linea.differenzialeIdnMa && linea.differenzialeIdnMa > 0) {
        verificaContattiIndirettiOk =
          progetto.fornitura.resistenzaTerraReOhm * (linea.differenzialeIdnMa / 1000) <= 50;
      } else {
        verificaContattiIndirettiOk = false;
      }
    }
  } else {
    // TN / IT
    if (progetto.fornitura.impedenzaAnelloGuastoOhm != null) {
      const multCurva =
        linea.curvaProtezione === 'B' ? 5 : linea.curvaProtezione === 'C' ? 10 : 20;
      const ia = protezioneSceltaInA * multCurva;
      const zCavoLoop = (2 * linea.lunghezzaM * rho) / sezioneSceltaMm2;
      const zTotaleGuasto = progetto.fornitura.impedenzaAnelloGuastoOhm + zCavoLoop;
      verificaContattiIndirettiOk = zTotaleGuasto * ia <= u0;
    }
  }

  const verificaCoordinamentoOk =
    correnteImpiegoIbA <= protezioneSceltaInA &&
    protezioneSceltaInA <= portataCorrettaIzA &&
    energiaSpecificaI2t <= resistenzaTermicaCavoK2S2;

  const verificaSelettivitaOk = quadro
    ? quadro.interruttoreGeneraleInA >= protezioneSceltaInA * 1.6 ||
      quadro.interruttoreGeneraleSelettivo
    : true;

  const siglaTipoProt =
    linea.tipoProtezione === 'magnetotermico_differenziale'
      ? `MTD ${linea.tipoFornitura === 'trifase' ? '4P' : '2P'} ${protezioneSceltaInA}A ${linea.curvaProtezione} ${linea.differenzialeIdnMa ?? 30}mA`
      : linea.tipoProtezione === 'magnetotermico'
      ? `MT ${linea.tipoFornitura === 'trifase' ? '4P' : '2P'} ${protezioneSceltaInA}A ${linea.curvaProtezione}`
      : linea.tipoProtezione === 'fusibile'
      ? `FUS ${protezioneSceltaInA}A ${linea.curvaProtezione}`
      : `SEZ ${protezioneSceltaInA}A`;

  const nConduttori = linea.tipoFornitura === 'trifase' ? '5G' : '3G';
  const prefissoCavo =
    linea.resistenzaFuocoCavoScelto !== 'nessuna'
      ? `FTG18OM16 (${linea.resistenzaFuocoCavoScelto})`
      : 'FG16OM16';
  const siglaCavoCompleta = `${prefissoCavo} ${nConduttori}${sezioneSceltaMm2} mm² · ${linea.classeCPR}`;

  const formuleDettaglio = [
    `P_ass = P_nom × ku = ${linea.potenzaNominaleW} × ${ku} = ${potenzaAssorbitaW.toFixed(0)} W`,
    `Ib = P_ass / (${linea.tipoFornitura === 'trifase' ? '√3 × ' : ''}${tensione} × ${cosPhi} × ${rendimento}) = ${correnteImpiegoIbA.toFixed(2)} A`,
    `Iz = I0(${portataBaseI0A} A) × k_posa(${kp}) × kt(${kt}) × kg(${kg}) = ${portataCorrettaIzA.toFixed(2)} A`,
    `ΔV = ${linea.tipoFornitura === 'trifase' ? '√3' : '2'} × ${linea.lunghezzaM} × ${correnteImpiegoIbA.toFixed(2)} × ((${rho}/${sezioneSceltaMm2})×${cosPhi} + ${reactance}×${sinPhi.toFixed(2)}) = ${cadutaTensioneV.toFixed(2)} V (${cadutaTensionePct.toFixed(2)}%)`,
    `Posa: ${siglaTipoPosa(linea.tipoPosa)} · I²t = ${energiaSpecificaI2t.toLocaleString('it-IT')} A²s <= k²S² = ${resistenzaTermicaCavoK2S2.toLocaleString('it-IT')} A²s`,
  ];

  return {
    lineaId: linea.id,
    potenzaAssorbitaW: Number(potenzaAssorbitaW.toFixed(1)),
    potenzaContemporaneaW: Number(potenzaContemporaneaW.toFixed(1)),
    correnteImpiegoIbA: Number(correnteImpiegoIbA.toFixed(2)),
    correnteSpuntoA: Number(correnteSpuntoA.toFixed(2)),
    sezioneSceltaMm2,
    portataBaseI0A,
    fattoreKt: kt,
    fattoreKg: kg,
    portataCorrettaIzA,
    protezioneSceltaInA,
    siglaProtezioneCompleta: siglaTipoProt,
    siglaCavoCompleta,
    cadutaTensioneV: Number(cadutaTensioneV.toFixed(2)),
    cadutaTensionePct: Number(cadutaTensionePct.toFixed(2)),
    cadutaTensioneAvviamentoPct: Number(cadutaTensioneAvviamentoPct.toFixed(2)),
    iccPresuntaFineLineaKa,
    energiaSpecificaI2t,
    resistenzaTermicaCavoK2S2,
    verificaContattiIndirettiOk,
    verificaCoordinamentoOk,
    verificaSelettivitaOk,
    formuleDettaglio,
    fonteNormativa: 'CEI 64-8 Cap. 43, 52, 56 · CEI-UNEL 35024',
  };
}

export function verificaLineaAltoparlantiEVAC(
  ln: LineaAltoparlantiEVAC,
  amp?: AmplificatoreEVAC
): RisultatoCalcoloLineaEVAC {
  const uLinea = ln.tensioneLineaV || 100;
  const pW = Math.max(0, ln.potenzaTotaleAltoparlantiW || 0);
  const lunghezzaM = Math.max(0, ln.lunghezzaM || 0);
  const sezioneMm2 = Math.max(0.5, ln.sezioneMm2 || 1.5);
  const sogliaMaxPct =
    ln.cadutaTensioneMaxPct && ln.cadutaTensioneMaxPct > 0
      ? ln.cadutaTensioneMaxPct
      : 10.0;

  const iLinea = pW / uLinea;
  const impedenzaCaricoOhm = pW > 0 ? (uLinea * uLinea) / pW : 0;
  const resistenzaCavoOhm = (2 * lunghezzaM * RHO_RAME_EVAC) / sezioneMm2;

  const fattoreTopo = ln.topologia === 'anello' ? 0.5 : 1.0;
  const distribuzione = ln.distribuzioneCarico ?? 'concentrato';
  const fattoreDist =
    distribuzione === 'distribuito' && ln.numeroAltoparlanti > 1 ? 0.5 : 1.0;
  const fattoreComplessivo = fattoreTopo * fattoreDist;

  const resistenzaEffettivaOhm = resistenzaCavoOhm * fattoreComplessivo;
  const dvLinea = iLinea * resistenzaEffettivaOhm;
  const dvPct = (dvLinea / uLinea) * 100;

  const rapportoResiduo = Math.max(0.01, 1 - dvPct / 100);
  const attenuazioneDb = 20 * Math.log10(1 / rapportoResiduo);
  const perditaPotenzaPct = (1 - Math.pow(Math.max(0, 1 - dvPct / 100), 2)) * 100;

  const denomLmax = 2 * RHO_RAME_EVAC * iLinea * fattoreComplessivo;
  const lunghezzaMassimaAmmissibileM =
    denomLmax > 0
      ? Math.round(((sogliaMaxPct / 100) * uLinea * sezioneMm2) / denomLmax)
      : 2000;

  const sezioneMinimaConsigliataMm2 =
    SEZIONI_EVAC_STANDARD.find((s) => {
      const rCand = ((2 * lunghezzaM * RHO_RAME_EVAC) / s) * fattoreComplessivo;
      const dvCandPct = ((iLinea * rCand) / uLinea) * 100;
      return dvCandPct <= sogliaMaxPct;
    }) ?? 16;

  const conformeCadutaTensione = dvPct <= sogliaMaxPct;
  const caricoPct =
    amp && amp.potenzaNominaleW > 0 ? (pW / amp.potenzaNominaleW) * 100 : 0;

  const formulaDettaglio = `I = ${pW}W / ${uLinea}V = ${iLinea.toFixed(2)} A · R_cavo = ${resistenzaCavoOhm.toFixed(2)} Ω (R_eff = ${resistenzaEffettivaOhm.toFixed(2)} Ω, ${ln.topologia}/${distribuzione}) · ΔV = ${dvLinea.toFixed(2)} V (${dvPct.toFixed(2)}% vs ≤${sogliaMaxPct.toFixed(1)}%) · Att. = ${attenuazioneDb.toFixed(2)} dB · L_max = ${lunghezzaMassimaAmmissibileM} m`;

  return {
    lineaId: ln.id,
    correnteLineaA: Number(iLinea.toFixed(2)),
    impedenzaCaricoOhm: Number(impedenzaCaricoOhm.toFixed(1)),
    resistenzaCavoOhm: Number(resistenzaCavoOhm.toFixed(2)),
    resistenzaEffettivaOhm: Number(resistenzaEffettivaOhm.toFixed(2)),
    cadutaTensioneV: Number(dvLinea.toFixed(2)),
    cadutaTensionePct: Number(dvPct.toFixed(2)),
    sogliaMaxPct: Number(sogliaMaxPct.toFixed(1)),
    attenuazioneDb: Number(attenuazioneDb.toFixed(2)),
    perditaPotenzaPct: Number(perditaPotenzaPct.toFixed(2)),
    lunghezzaMassimaAmmissibileM,
    sezioneMinimaConsigliataMm2,
    conformeCadutaTensione,
    caricoAmplificatorePct: Number(caricoPct.toFixed(1)),
    formulaDettaglio,
  };
}

export function calcolaProgettoCompleto(
  progetto: ProgettoAntincendio
): RisultatoCalcoloCompleto {
  const lineeRes: Record<string, RisultatoCalcoloLinea> = {};
  for (const linea of progetto.linee) {
    lineeRes[linea.id] = calcolaLinea(linea, progetto);
  }

  const quadriRes: Record<string, RisultatoCalcoloQuadro> = {};
  for (const quadro of progetto.quadri) {
    const lineeQuadro = progetto.linee.filter((l) => l.quadroId === quadro.id);
    const pInstW = lineeQuadro.reduce((acc, l) => acc + l.potenzaNominaleW, 0);
    const pContW = lineeQuadro.reduce(
      (acc, l) => acc + (lineeRes[l.id]?.potenzaContemporaneaW ?? 0),
      0
    );
    const fattore = quadro.tipoFornitura === 'trifase' ? Math.sqrt(3) : 1;
    const iTot = pContW / (fattore * quadro.tensioneV * 0.9);
    const genCons = CALIBRI_INTERRUTTORI.find((c) => c >= iTot * 1.15) ?? 63;

    quadriRes[quadro.id] = {
      quadroId: quadro.id,
      potenzaInstallataTotaleKw: Number((pInstW / 1000).toFixed(2)),
      potenzaContemporaneaKw: Number((pContW / 1000).toFixed(2)),
      correnteTotaleImpiegoA: Number(iTot.toFixed(2)),
      interruttoreGeneraleConsigliatoA: genCons,
      numeroLinee: lineeQuadro.length,
    };
  }

  const iraiRes: Record<string, RisultatoCalcoloIRAI> = {};
  for (const sys of progetto.sistemiIrai) {
    const loopRisultati: RisultatoCalcoloLoop[] = sys.loop.map((lp) => {
      const iqMa = lp.dispositivi.reduce(
        (s, d) => s + d.correnteQuieteMa * Math.max(1, d.quantita ?? 1),
        0
      );
      const iaMa = lp.dispositivi.reduce(
        (s, d) => s + d.correnteAllarmeMa * Math.max(1, d.quantita ?? 1),
        0
      );
      const numDisp = lp.dispositivi.reduce(
        (s, d) => s + Math.max(1, d.quantita ?? 1),
        0
      );
      // Caduta di tensione su loop (resistenza totale cavo andata+ritorno, carico distribuito /2)
      const rLoop = (2 * lp.lunghezzaM * 0.018) / Math.max(0.5, lp.sezioneCavoMm2);
      const dvLoop = (iaMa / 1000) * (rLoop / 2);
      return {
        loopId: lp.id,
        numeroDispositivi: numDisp,
        correnteQuieteMa: Number(iqMa.toFixed(2)),
        correnteAllarmeMa: Number(iaMa.toFixed(2)),
        cadutaTensioneLoopV: Number(dvLoop.toFixed(3)),
        formulaDettaglio: `ΔV_loop = (${iaMa.toFixed(1)} mA) × (R_loop/2 = ${(rLoop / 2).toFixed(2)} Ω) = ${dvLoop.toFixed(3)} V`,
      };
    });

    const totQuieteMa =
      sys.correnteCentraleQuieteMa +
      loopRisultati.reduce((s, l) => s + l.correnteQuieteMa, 0);
    const totAllarmeMa =
      sys.correnteCentraleAllarmeMa +
      loopRisultati.reduce((s, l) => s + l.correnteAllarmeMa, 0);

    const iqA = totQuieteMa / 1000;
    const iaA = totAllarmeMa / 1000;
    const tQuieteH = sys.autonomiaQuieteRichiestaOre;
    const tAllarmeH = sys.autonomiaAllarmeRichiestaMin / 60;
    const cMinAh = 1.25 * (iqA * tQuieteH + iaA * tAllarmeH);
    const iAlimMin = iaA + (cMinAh / 24) * 1.2;

    iraiRes[sys.id] = {
      sistemaId: sys.id,
      correnteTotaleQuieteA: Number(iqA.toFixed(3)),
      correnteTotaleAllarmeA: Number(iaA.toFixed(3)),
      capacitaBatterieMinimaAh: Number(cMinAh.toFixed(2)),
      correnteAlimentatoreMinimaA: Number(iAlimMin.toFixed(2)),
      loopRisultati,
      formulaBatterie: `C_min = 1.25 × (${iqA.toFixed(3)} A × ${tQuieteH} h + ${iaA.toFixed(3)} A × ${tAllarmeH.toFixed(2)} h) = ${cMinAh.toFixed(2)} Ah`,
    };
  }

  const evacRes: Record<string, RisultatoCalcoloEVAC> = {};
  for (const sys of progetto.sistemiEvac) {
    const lineeRisultati: RisultatoCalcoloLineaEVAC[] = sys.lineeAltoparlanti.map(
      (ln) => {
        const amp = sys.amplificatori.find((a) => a.id === ln.amplificatoreId);
        return verificaLineaAltoparlantiEVAC(ln, amp);
      }
    );

    const pTotAltoparlantiW = sys.lineeAltoparlanti.reduce(
      (s, l) => s + l.potenzaTotaleAltoparlantiW,
      0
    );
    const pAmpAttiviW = sys.amplificatori
      .filter((a) => !a.diRiserva)
      .reduce((s, a) => s + a.potenzaNominaleW, 0);
    const haRiserva = sys.amplificatori.some((a) => a.diRiserva);
    const pRichiestaMargineW =
      pTotAltoparlantiW * (1 + (sys.marginePotenzaRichiestoPct || 20) / 100);
    const cMinEvacAh =
      1.25 *
      (sys.correnteQuieteA * sys.autonomiaQuieteRichiestaOre +
        sys.correnteAllarmeA * (sys.autonomiaAllarmeRichiestaMin / 60));

    evacRes[sys.id] = {
      sistemaId: sys.id,
      potenzaTotaleAltoparlantiW: pTotAltoparlantiW,
      potenzaAmplificatoriAttiviW: pAmpAttiviW,
      potenzaRichiestaConMargineW: Number(pRichiestaMargineW.toFixed(1)),
      haAmplificatoreRiserva: haRiserva,
      capacitaBatterieMinimaAh: Number(cMinEvacAh.toFixed(2)),
      lineeRisultati,
      formulaBatterie: `C_min = 1.25 × (${sys.correnteQuieteA} A × ${sys.autonomiaQuieteRichiestaOre} h + ${sys.correnteAllarmeA} A × ${(sys.autonomiaAllarmeRichiestaMin / 60).toFixed(2)} h) = ${cMinEvacAh.toFixed(2)} Ah`,
    };
  }

  // Calcolo taglia UPS consigliata sui carichi di sicurezza (IRAI + EVAC)
  const potenzaCarichiSicurezzaW = progetto.linee
    .filter((l) =>
      ['centrale_irai', 'alimentatore_irai', 'centrale_evac', 'amplificatore_evac'].includes(
        l.tipoUtenza
      )
    )
    .reduce((s, l) => s + (lineeRes[l.id]?.potenzaContemporaneaW ?? 0), 0);
  const upsKvaConsigliato = Number(((potenzaCarichiSicurezzaW / 1000 / 0.8) * 1.25).toFixed(1));

  return {
    versioneApp: VERSIONE_APP,
    versioneRegole: VERSIONE_REGOLE,
    versioneLibreria: VERSIONE_LIBRERIA,
    linee: lineeRes,
    quadri: quadriRes,
    irai: iraiRes,
    evac: evacRes,
    upsKvaConsigliato,
  };
}
