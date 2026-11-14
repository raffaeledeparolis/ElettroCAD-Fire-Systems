import {
  CASI_RIFERIMENTO_TEST,
  creaProgettoEdificioDirezionale,
  REGOLE_ANTINCENDIO_CATALOGO,
} from '../data/rulesAndLibrary';
import {
  DerogaRegola,
  EsitoVerifica,
  ProgettoAntincendio,
  ResistenzaFuocoCavo,
  RisultatoCalcoloCompleto,
  StatoVerifica,
} from '../types/elettrocad';
import { calcolaProgettoCompleto } from './calculator';

const ORDINE_PH: Record<ResistenzaFuocoCavo, number> = {
  nessuna: 0,
  PH30: 1,
  PH60: 2,
  PH90: 3,
  PH120: 4,
};

const ORDINE_IP: Record<string, number> = {
  IP2X: 1,
  IP4X: 2,
  IP54: 3,
  IP55: 4,
  IP65: 5,
};

function applicaDeroga(
  esito: EsitoVerifica,
  deroghe: DerogaRegola[]
): EsitoVerifica {
  const deroga = deroghe.find(
    (d) => d.regolaId === esito.regolaId && (d.targetId === esito.targetId || d.targetId === '*')
  );
  if (deroga && deroga.disattivata) {
    return {
      ...esito,
      stato: 'da_verificare',
      derogata: true,
      motivazioneDeroga: deroga.motivazione,
      messaggio: `Regola derogata dal progettista: ${deroga.motivazione}`,
    };
  }
  return esito;
}

export function valutaRegoleProgetto(
  progetto: ProgettoAntincendio,
  calcolo: RisultatoCalcoloCompleto
): EsitoVerifica[] {
  const esiti: EsitoVerifica[] = [];
  const regMap = new Map(REGOLE_ANTINCENDIO_CATALOGO.map((r) => [r.id, r]));

  const pushEsito = (
    regolaId: string,
    targetId: string,
    targetLabel: string,
    stato: StatoVerifica,
    valoreCalcolato: string,
    sogliaAttesa: string,
    messaggio: string,
    formula: string
  ) => {
    const r = regMap.get(regolaId);
    if (!r) return;
    const base: EsitoVerifica = {
      id: `${regolaId}__${targetId}`,
      regolaId,
      codice: r.codice,
      categoria: r.categoria,
      titolo: r.titolo,
      normaRiferimento: `${r.normaRiferimento} (${r.edizione})`,
      targetId,
      targetLabel,
      stato,
      valoreCalcolato,
      sogliaAttesa,
      messaggio,
      formula,
      derogata: false,
    };
    esiti.push(applicaDeroga(base, progetto.deroghe));
  };

  // REG-01: Completezza dati critici
  const mancaIcc = progetto.fornitura.iccPuntoConsegnaKa == null || progetto.fornitura.iccPuntoConsegnaKa <= 0;
  const mancaZs =
    progetto.fornitura.sistemaDistribuzione !== 'TT' &&
    (progetto.fornitura.impedenzaAnelloGuastoOhm == null || progetto.fornitura.impedenzaAnelloGuastoOhm <= 0);
  const mancaLp = progetto.livelloPrestazione === 'non_definito';
  const campiMancanti: string[] = [];
  if (mancaIcc) campiMancanti.push('Icc punto consegna');
  if (mancaZs) campiMancanti.push('Impedenza anello guasto Zs');
  if (mancaLp) campiMancanti.push('Livello di prestazione');

  pushEsito(
    'reg-01',
    progetto.id,
    'Dati Generali di Progetto',
    campiMancanti.length === 0 ? 'conforme' : 'dato_mancante',
    campiMancanti.length === 0
      ? `Icc=${progetto.fornitura.iccPuntoConsegnaKa} kA · LP=${progetto.livelloPrestazione}`
      : `Mancano: ${campiMancanti.join(', ')}`,
    'Tutti i parametri critici valorizzati',
    campiMancanti.length === 0
      ? 'Dati di ingresso critici completi per il calcolo di verifica.'
      : `Inserire i dati mancanti: ${campiMancanti.join(', ')}.`,
    'Controllo di completezza pre-verifica'
  );

  // REG-02 e REG-03: Alimentazione preferenziale a monte & continuità
  for (const quadro of progetto.quadri) {
    pushEsito(
      'reg-02',
      quadro.id,
      `Quadro ${quadro.sigla}`,
      quadro.alimentazionePreferenzialeAMonte ? 'conforme' : 'non_conforme',
      quadro.alimentazionePreferenzialeAMonte ? 'Derivata a monte I.G.' : 'Sotto I.G. ordinario',
      'Derivata a monte dell’interruttore generale',
      quadro.alimentazionePreferenzialeAMonte
        ? 'Alimentazione di sicurezza correttamente derivata a monte del sezionamento generale.'
        : 'Attenzione: il quadro antincendio risulta derivato a valle dell’interruttore generale.',
      'Flag alimentazionePreferenzialeAMonte = true'
    );

    const ipQuadroVal = ORDINE_IP[quadro.gradoIP] ?? 0;
    const ipRichVal = ORDINE_IP[progetto.ambiente.gradoIPRichiesto] ?? 0;
    pushEsito(
      'reg-10',
      quadro.id,
      `Quadro ${quadro.sigla}`,
      ipQuadroVal >= ipRichVal ? 'conforme' : 'non_conforme',
      `${quadro.gradoIP} (${quadro.formaSegregazione})`,
      `>= ${progetto.ambiente.gradoIPRichiesto}`,
      ipQuadroVal >= ipRichVal
        ? `Grado di protezione ${quadro.gradoIP} adeguato al locale (${progetto.ambiente.tipoLocale}).`
        : `Grado IP del quadro (${quadro.gradoIP}) inferiore al requisito ambientale (${progetto.ambiente.gradoIPRichiesto}).`,
      `IP(${quadro.gradoIP}) >= IP_req(${progetto.ambiente.gradoIPRichiesto})`
    );
  }

  const haUpsOSicurezza = progetto.sorgenti.some(
    (s) => (s.tipo === 'ups' || s.tipo === 'gruppo_batterie') && s.tempoCommutazioneSec <= 0.5
  );
  pushEsito(
    'reg-03',
    'sorgenti',
    'Sorgenti di Continuità',
    haUpsOSicurezza ? 'conforme' : 'non_conforme',
    haUpsOSicurezza
      ? `UPS/Batterie presenti (commutazione <= 0.5s, consigliato ${calcolo.upsKvaConsigliato} kVA)`
      : 'Nessuna fonte continua <= 0.5s configurata',
    'Fonte secondaria con t_comm <= 0.5 s',
    haUpsOSicurezza
      ? 'Continuità elettrica garantita per i sistemi di rivelazione e evacuazione.'
      : 'Configurare almeno un UPS o gruppo batterie di sicurezza.',
    `S_UPS >= P_sic / (0.8 × 1000) × 1.25 = ${calcolo.upsKvaConsigliato} kVA`
  );

  // Verifiche per singola linea
  for (const linea of progetto.linee) {
    const res = calcolo.linee[linea.id];
    if (!res) continue;

    // REG-04: Cavi resistenti al fuoco e CPR
    const phOk =
      ORDINE_PH[linea.resistenzaFuocoCavoScelto] >=
      ORDINE_PH[linea.resistenzaFuocoRichiesta];
    const cprOk =
      !progetto.ambiente.ambienteMarci ||
      linea.classeCPR === 'Cca-s1b,d1,a1' ||
      linea.classeCPR === 'B2ca-s1a,d1,a1';
    pushEsito(
      'reg-04',
      linea.id,
      `Linea ${linea.sigla} (${linea.descrizione})`,
      phOk && cprOk ? 'conforme' : 'non_conforme',
      `${linea.resistenzaFuocoCavoScelto} · CPR ${linea.classeCPR}`,
      `>= ${linea.resistenzaFuocoRichiesta} · ${progetto.ambiente.ambienteMarci ? 'CPR >= Cca' : 'CPR idonea'}`,
      phOk && cprOk
        ? 'Cavo resistente al fuoco e classe CPR conformi alle prescrizioni.'
        : 'Resistenza al fuoco o classe CPR insufficiente per l’ambiente e il servizio.',
      `PH_scelto(${linea.resistenzaFuocoCavoScelto}) >= PH_req(${linea.resistenzaFuocoRichiesta})`
    );

    // REG-05: Percorsi protetti e separazione
    pushEsito(
      'reg-05',
      linea.id,
      `Linea ${linea.sigla}`,
      linea.percorsoProtetto && linea.separataDaAltriImpianti ? 'conforme' : 'non_conforme',
      `Protetto: ${linea.percorsoProtetto ? 'Sì' : 'No'} · Separato: ${linea.separataDaAltriImpianti ? 'Sì' : 'No'}`,
      'Percorso protetto + separazione fisica',
      linea.percorsoProtetto && linea.separataDaAltriImpianti
        ? 'Criteri di posa e separazione rispettati.'
        : 'Attivare posa in percorso protetto e separazione dagli altri impianti.',
      'CEI 64-8 Art. 560.7'
    );

    // REG-06: Coordinamento cavo-protezione e I2t
    pushEsito(
      'reg-06',
      linea.id,
      `Linea ${linea.sigla}`,
      res.verificaCoordinamentoOk ? 'conforme' : 'non_conforme',
      `Ib=${res.correnteImpiegoIbA} A · In=${res.protezioneSceltaInA} A · Iz=${res.portataCorrettaIzA} A`,
      'Ib <= In <= Iz e I²t <= k²S²',
      res.verificaCoordinamentoOk
        ? 'Protezione da sovraccarico e tenuta termica al cortocircuito verificate.'
        : 'Mancato coordinamento tra corrente di impiego, interruttore e portata cavo.',
      `${res.correnteImpiegoIbA} <= ${res.protezioneSceltaInA} <= ${res.portataCorrettaIzA} A · I²t=${res.energiaSpecificaI2t} <= ${res.resistenzaTermicaCavoK2S2}`
    );

    // REG-07: Potere di interruzione
    const quadro = progetto.quadri.find((q) => q.id === linea.quadroId);
    const iccQuadro = quadro?.iccQuadroKa ?? progetto.fornitura.iccPuntoConsegnaKa;
    if (iccQuadro == null) {
      pushEsito(
        'reg-07',
        linea.id,
        `Linea ${linea.sigla}`,
        'dato_mancante',
        `Icu=${linea.protezioneIcuKa} kA · Icc=N.D.`,
        'Icu >= Icc quadro',
        'Impossibile verificare il potere di interruzione: Icc del quadro mancante.',
        'Icu >= Icc'
      );
    } else {
      pushEsito(
        'reg-07',
        linea.id,
        `Linea ${linea.sigla}`,
        linea.protezioneIcuKa >= iccQuadro ? 'conforme' : 'non_conforme',
        `Icu=${linea.protezioneIcuKa} kA vs Icc=${iccQuadro} kA`,
        `Icu >= ${iccQuadro} kA`,
        linea.protezioneIcuKa >= iccQuadro
          ? 'Potere di interruzione adeguato alla corrente di cortocircuito presunta.'
          : 'Potere di interruzione inferiore alla Icc presunta al quadro.',
        `${linea.protezioneIcuKa} kA >= ${iccQuadro} kA`
      );
    }

    // REG-08: Caduta di tensione
    pushEsito(
      'reg-08',
      linea.id,
      `Linea ${linea.sigla}`,
      res.cadutaTensionePct <= 4.0 ? 'conforme' : 'non_conforme',
      `ΔV = ${res.cadutaTensionePct.toFixed(2)}% (${res.cadutaTensioneV} V)`,
      'ΔV <= 4.00%',
      res.cadutaTensionePct <= 4.0
        ? 'Caduta di tensione entro il limite normativo del 4%.'
        : 'Caduta di tensione superiore al 4%: aumentare sezione cavo.',
      `ΔV% = (${res.cadutaTensioneV} / ${linea.tensioneV}) × 100 = ${res.cadutaTensionePct.toFixed(2)}%`
    );

    // REG-09: Contatti indiretti e selettività
    const statoCi: StatoVerifica =
      res.verificaContattiIndirettiOk === null
        ? 'dato_mancante'
        : res.verificaContattiIndirettiOk && res.verificaSelettivitaOk
        ? 'conforme'
        : 'non_conforme';
    pushEsito(
      'reg-09',
      linea.id,
      `Linea ${linea.sigla}`,
      statoCi,
      res.verificaContattiIndirettiOk === null
        ? 'Dato Zs/Re mancante'
        : `Contatti ind.: ${res.verificaContattiIndirettiOk ? 'OK' : 'KO'} · Selettività: ${res.verificaSelettivitaOk ? 'OK' : 'Da verificare'}`,
      'Contatti indiretti e selettività verificati',
      statoCi === 'conforme'
        ? 'Protezione contatti indiretti e selettività rispetto al generale verificate.'
        : statoCi === 'dato_mancante'
        ? 'Inserire impedenza anello di guasto Zs o resistenza di terra Re.'
        : 'Verifica contatti indiretti o selettività non soddisfatta.',
      `${progetto.fornitura.sistemaDistribuzione} · Selettività In_gen >= 1.6×In_linea`
    );
  }

  // Verifiche IRAI
  for (const sys of progetto.sistemiIrai) {
    const resIrai = calcolo.irai[sys.id];
    if (!resIrai) continue;

    for (const lp of sys.loop) {
      const lpRes = resIrai.loopRisultati.find((r) => r.loopId === lp.id);
      if (!lpRes) continue;
      const okLoop =
        lpRes.numeroDispositivi <= lp.maxDispositiviConsentiti &&
        lp.lunghezzaM <= 2000 &&
        lpRes.cadutaTensioneLoopV <= lp.cadutaTensioneMaxV;
      pushEsito(
        'reg-11',
        lp.id,
        `${sys.sigla} · ${lp.sigla}`,
        okLoop ? 'conforme' : 'non_conforme',
        `${lpRes.numeroDispositivi}/${lp.maxDispositiviConsentiti} disp · ${lp.lunghezzaM} m · ΔV=${lpRes.cadutaTensioneLoopV} V`,
        `Disp <= ${lp.maxDispositiviConsentiti}, L <= 2000 m, ΔV <= ${lp.cadutaTensioneMaxV} V`,
        okLoop
          ? 'Carico, lunghezza e caduta di tensione del loop entro i limiti.'
          : 'Superato limite dispositivi, lunghezza o caduta di tensione sul loop.',
        lpRes.formulaDettaglio
      );
    }

    // REG-12: Batterie IRAI
    const batOk =
      sys.capacitaBatterieInstallataAh >= resIrai.capacitaBatterieMinimaAh &&
      sys.correnteAlimentatoreMaxA >= resIrai.correnteAlimentatoreMinimaA;
    pushEsito(
      'reg-12',
      sys.id,
      `${sys.sigla} (Batterie & Alimentatore)`,
      batOk ? 'conforme' : 'non_conforme',
      `Installata: ${sys.capacitaBatterieInstallataAh} Ah · Alim: ${sys.correnteAlimentatoreMaxA} A`,
      `>= ${resIrai.capacitaBatterieMinimaAh} Ah · Alim >= ${resIrai.correnteAlimentatoreMinimaA} A`,
      batOk
        ? 'Autonomia batterie IRAI (quiete + allarme) e taglia alimentatore conformi.'
        : 'Capacità batterie o corrente alimentatore insufficiente per l’autonomia richiesta.',
      resIrai.formulaBatterie
    );

    // REG-13: Indirizzamento univoco & causa-effetto
    const indirizziTutti = sys.loop.flatMap((l) => l.dispositivi.map((d) => `${l.id}:${d.indirizzo}`));
    const haDuplicati = new Set(indirizziTutti).size !== indirizziTutti.length;
    const zoneNonCoperte = sys.zone.filter(
      (z) => !sys.causaEffetto.some((ce) => ce.causaZonaId === z.id)
    );
    const ceOk = !haDuplicati && zoneNonCoperte.length === 0 && sys.causaEffetto.length > 0;
    pushEsito(
      'reg-13',
      sys.id,
      `${sys.sigla} (Indirizzamento & Causa-Effetto)`,
      ceOk ? 'conforme' : 'non_conforme',
      haDuplicati
        ? 'Indirizzi duplicati rilevati'
        : `Zone coperte: ${sys.zone.length - zoneNonCoperte.length}/${sys.zone.length}`,
      'Indirizzi univoci e tutte le zone mappate',
      ceOk
        ? 'Indirizzamento univoco e tabella causa-effetto completa.'
        : 'Verificare indirizzi duplicati o zone mancanti nella matrice causa-effetto.',
      'UNI 9795 — Controllo unicità indirizzi e copertura zone'
    );
  }

  // Verifiche EVAC
  for (const sys of progetto.sistemiEvac) {
    const resEvac = calcolo.evac[sys.id];
    if (!resEvac) continue;

    const ridondanzaRichiesta =
      progetto.livelloPrestazione === 'L3' || progetto.livelloPrestazione === 'L4';
    const ampOk =
      resEvac.potenzaAmplificatoriAttiviW >= resEvac.potenzaRichiestaConMargineW &&
      (!ridondanzaRichiesta || (sys.ridondanzaAmplificatoriN1 && resEvac.haAmplificatoreRiserva));

    pushEsito(
      'reg-14',
      sys.id,
      `${sys.sigla} (Amplificatori & Ridondanza)`,
      ampOk ? 'conforme' : 'non_conforme',
      `Attivi: ${resEvac.potenzaAmplificatoriAttiviW} W vs Richiesta+margine: ${resEvac.potenzaRichiestaConMargineW} W · Riserva N+1: ${resEvac.haAmplificatoreRiserva ? 'Sì' : 'No'}`,
      `>= ${resEvac.potenzaRichiestaConMargineW} W${ridondanzaRichiesta ? ' + Riserva N+1' : ''}`,
      ampOk
        ? 'Potenza amplificatori con margine di progetto e ridondanza verificate.'
        : 'Potenza amplificatori o ridondanza N+1 insufficiente per il livello di prestazione.',
      `P_req = ${resEvac.potenzaTotaleAltoparlantiW} W × (1 + ${sys.marginePotenzaRichiestoPct}%) = ${resEvac.potenzaRichiestaConMargineW} W`
    );

    const lineeEvacOk = resEvac.lineeRisultati.every((r) => r.cadutaTensionePct <= 10);
    const batEvacOk = sys.capacitaBatterieInstallataAh >= resEvac.capacitaBatterieMinimaAh;
    const maxDvEvac = Math.max(0, ...resEvac.lineeRisultati.map((r) => r.cadutaTensionePct));

    pushEsito(
      'reg-15',
      sys.id,
      `${sys.sigla} (Linee 100V & Batterie)`,
      lineeEvacOk && batEvacOk ? 'conforme' : 'non_conforme',
      `Max ΔV linee: ${maxDvEvac.toFixed(2)}% · Batterie: ${sys.capacitaBatterieInstallataAh} Ah (min ${resEvac.capacitaBatterieMinimaAh} Ah)`,
      'ΔV linee <= 10% e C_bat >= C_min',
      lineeEvacOk && batEvacOk
        ? 'Linee altoparlanti 100V e autonomia batterie EVAC conformi.'
        : 'Caduta di tensione superiore al 10% su linea altoparlanti o batterie sottodimensionate.',
      resEvac.formulaBatterie
    );

    const intOk =
      sys.interfacciaIraiCollegata &&
      sys.cavoInterfacciaResistenteFuoco !== 'nessuna' &&
      sys.separazioneCircuitiPotenza;
    pushEsito(
      'reg-16',
      sys.id,
      `${sys.sigla} (Interfaccia IRAI)`,
      intOk ? 'conforme' : 'non_conforme',
      `Collegata: ${sys.interfacciaIraiCollegata ? 'Sì' : 'No'} · Cavo: ${sys.cavoInterfacciaResistenteFuoco} · Separazione: ${sys.separazioneCircuitiPotenza ? 'Sì' : 'No'}`,
      'Interfaccia attiva + cavo PH + separazione circuiti',
      intOk
        ? 'Interfaccia IRAI-EVAC protetta al fuoco e separata dai circuiti di potenza.'
        : 'Verificare collegamento interfaccia IRAI, cavo resistente al fuoco o separazione.',
      'UNI 9795 / UNI ISO 7240-19'
    );
  }

  return esiti;
}

export interface EsitoTestRegressione {
  id: string;
  titolo: string;
  riferimentoManuale: string;
  atteso: string;
  calcolato: string;
  scartoPct: number;
  superato: boolean;
}

export function eseguiTestRegressione(): EsitoTestRegressione[] {
  const proj = creaProgettoEdificioDirezionale();
  const calc = calcolaProgettoCompleto(proj);

  const l1 = calc.linee['ln-irai-1'];
  const l2 = calc.linee['ln-evac-1'];
  const l3 = calc.linee['ln-ups-1'];

  const mappa = [
    { caso: CASI_RIFERIMENTO_TEST[0], linea: l1 },
    { caso: CASI_RIFERIMENTO_TEST[1], linea: l2 },
    { caso: CASI_RIFERIMENTO_TEST[2], linea: l3 },
  ];

  return mappa.map(({ caso, linea }) => {
    const scartoIb =
      Math.abs((linea.correnteImpiegoIbA - caso.attesoIbA) / caso.attesoIbA) * 100;
    const scartoDv =
      Math.abs((linea.cadutaTensionePct - caso.attesoDvPct) / caso.attesoDvPct) * 100;
    const scartoMax = Number(Math.max(scartoIb, scartoDv).toFixed(2));
    return {
      id: caso.id,
      titolo: caso.titolo,
      riferimentoManuale: caso.riferimentoManuale,
      atteso: `Ib=${caso.attesoIbA} A · S=${caso.attesoSezioneMm2} mm² · ΔV=${caso.attesoDvPct}%`,
      calcolato: `Ib=${linea.correnteImpiegoIbA} A · S=${linea.sezioneSceltaMm2} mm² · ΔV=${linea.cadutaTensionePct}%`,
      scartoPct: scartoMax,
      superato: scartoMax <= caso.tolleranzaPct && linea.sezioneSceltaMm2 === caso.attesoSezioneMm2,
    };
  });
}
