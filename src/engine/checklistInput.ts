import {
  ChecklistInputCategoriaId,
  EsitoVerifica,
  ProgettoAntincendio,
  VoceChecklistInputGenerata,
} from '../types/elettrocad';

export const CHECKLIST_INPUT_CATEGORIE: Array<{
  id: ChecklistInputCategoriaId;
  ordine: number;
  label: string;
  normaRif: string;
}> = [
  {
    id: 'anagrafica_antincendio',
    ordine: 1,
    label: '1. Anagrafica Commessa & Inquadramento Antincendio',
    normaRif: 'D.P.R. 151/2011 · D.M. 03/08/2015 (RTO)',
  },
  {
    id: 'fornitura_terra',
    ordine: 2,
    label: '2. Fornitura Elettrica & Impianto di Terra',
    normaRif: 'CEI 64-8 Cap. 31 / 41 / 56',
  },
  {
    id: 'ambiente_posa',
    ordine: 3,
    label: '3. Condizioni Ambientali & Criteri di Posa Cavi',
    normaRif: 'CEI 64-8 Cap. 52 / 751 · Reg. CPR 305/2011 · CEI 20-105',
  },
  {
    id: 'quadro_utenze',
    ordine: 4,
    label: '4. Quadro Antincendio & Utenze di Sicurezza',
    normaRif: 'CEI EN 61439-1/2 · CEI 64-8 Sez. 56',
  },
  {
    id: 'irai_rivelazione',
    ordine: 5,
    label: '5. Impianto IRAI — Rivelazione Incendi',
    normaRif: 'UNI 9795:2021 · EN 54',
  },
  {
    id: 'evac_vocale',
    ordine: 6,
    label: '6. Impianto EVAC — Allarme Vocale di Emergenza',
    normaRif: 'UNI 11988:2025 · EN 54-16 / EN 54-24',
  },
  {
    id: 'documenti_base',
    ordine: 7,
    label: '7. Elaborati & Documentazione di Base da Acquisire',
    normaRif: 'D.M. 37/08 · UNI 9795 App. A · UNI 11988 App. A',
  },
];

const CATEGORIA_LABEL_MAP: Record<ChecklistInputCategoriaId, string> =
  CHECKLIST_INPUT_CATEGORIE.reduce(
    (acc, c) => {
      acc[c.id] = c.label;
      return acc;
    },
    {} as Record<ChecklistInputCategoriaId, string>
  );

export interface OpzioniGenerazioneChecklistInput {
  includiIrai?: boolean;
  includiEvac?: boolean;
}

export function generaChecklistDatiInput(
  progetto: ProgettoAntincendio,
  esiti: EsitoVerifica[],
  opzioni: OpzioniGenerazioneChecklistInput = {}
): VoceChecklistInputGenerata[] {
  const includiIrai = opzioni.includiIrai ?? true;
  const includiEvac = opzioni.includiEvac ?? true;
  const statiSalvati = progetto.checklistInputStato ?? {};

  const items: Array<Omit<VoceChecklistInputGenerata, 'acquisito' | 'nota' | 'categoriaLabel'>> = [];

  const haCliente = progetto.identificativi.cliente.trim().length > 0;
  const haCommessa = progetto.identificativi.commessa.trim().length > 0;
  const haSito = progetto.identificativi.sito.trim().length > 0;
  const haProgettista = progetto.identificativi.progettista.trim().length > 0;

  items.push({
    id: 'inp-1-1',
    categoria: 'anagrafica_antincendio',
    codice: 'INP-1.1',
    voce: 'Dati identificativi commessa, committente, sito e progettista abilitato',
    dettaglio:
      'Ragione sociale committente, codice commessa, indirizzo completo del sito di installazione, nominativo e timbro/abilitazione del progettista.',
    fonte: 'Committente / Studio',
    obbligatorio: true,
    statoAuto:
      haCliente && haCommessa && haSito && haProgettista
        ? 'compilato'
        : haCliente || haCommessa
          ? 'parziale'
          : 'mancante',
    valoreAttuale: `Commessa: ${progetto.identificativi.commessa || 'N.D.'} | Cliente: ${progetto.identificativi.cliente || 'N.D.'} | Sito: ${progetto.identificativi.sito || 'N.D.'} | Prog.: ${progetto.identificativi.progettista || 'N.D.'}`,
  });

  const haAttivita = progetto.attivitaNome.trim().length > 0;
  const haLivello = progetto.livelloPrestazione !== 'non_definito';
  items.push({
    id: 'inp-1-2',
    categoria: 'anagrafica_antincendio',
    codice: 'INP-1.2',
    voce: 'Attività soggetta (D.P.R. 151/2011) e Livello di Prestazione (L1–L4)',
    dettaglio:
      'Individuazione codici attività D.P.R. 151/2011, numero/categoria e livello di prestazione richiesto dal Codice di Prevenzione Incendi (S.7 / S.8) o regola tecnica verticale.',
    fonte: 'Progettista Antincendio',
    obbligatorio: true,
    statoAuto: haAttivita && haLivello ? 'compilato' : haAttivita || haLivello ? 'parziale' : 'mancante',
    valoreAttuale: `Attività: ${progetto.attivitaNome || 'Non indicata'} | Livello Prestazione: ${progetto.livelloPrestazione === 'non_definito' ? 'Non definito' : progetto.livelloPrestazione}`,
  });

  items.push({
    id: 'inp-1-3',
    categoria: 'anagrafica_antincendio',
    codice: 'INP-1.3',
    voce: 'Compartimentazioni antincendio (EI) ed eventuali aree escluse/esenti',
    dettaglio:
      'Delimitazione dei compartimenti antincendio, vie di esodo protette, locali a rischio specifico ed eventuali aree esenti da sorveglianza secondo UNI 9795 §5.1.3.',
    fonte: 'Progettista Antincendio',
    obbligatorio: true,
    statoAuto: progetto.sistemiIrai.some((s) => s.zone.length > 0) ? 'parziale' : 'mancante',
    valoreAttuale: `Zone IRAI definite: ${progetto.sistemiIrai.reduce((a, s) => a + s.zone.length, 0)} — verificare corrispondenza compartimenti su planimetria`,
  });

  items.push({
    id: 'inp-1-4',
    categoria: 'anagrafica_antincendio',
    codice: 'INP-1.4',
    voce: 'Strategia gestione emergenza, presidio H24 e trasmissione allarmi',
    dettaglio:
      'Modalità di presidio (locale custodito H24 o combinatore/trasmettitore EN 54-21 verso centrale di ricezione), tempi di risposta squadra interna e fasi di evacuazione (simultanea o a fasi).',
    fonte: 'Committente / RSPP',
    obbligatorio: true,
    statoAuto: 'mancante',
    valoreAttuale: 'Da confermare con verbale / piano di emergenza aziendale',
  });

  // 2. Fornitura & Terra
  const haFornituraBase =
    progetto.fornitura.tensioneNominaleV > 0 && progetto.fornitura.potenzaDisponibileKw > 0;
  items.push({
    id: 'inp-2-1',
    categoria: 'fornitura_terra',
    codice: 'INP-2.1',
    voce: 'Sistema di distribuzione, tensione nominale e potenza disponibile',
    dettaglio:
      'Conferma schema TT / TN-S / TN-C / IT, sistema monofase 230V o trifase 400V, frequenza 50 Hz e potenza contrattuale/trasformatore disponibile.',
    fonte: 'Distributore / Impianto Utente',
    obbligatorio: true,
    statoAuto: haFornituraBase ? 'compilato' : 'parziale',
    valoreAttuale: `${progetto.fornitura.sistemaDistribuzione} · ${progetto.fornitura.tensioneNominaleV}V (${progetto.fornitura.tipoFornitura}) · ${progetto.fornitura.potenzaDisponibileKw} kW`,
  });

  const haIcc =
    progetto.fornitura.iccPuntoConsegnaKa !== null && progetto.fornitura.iccPuntoConsegnaKa > 0;
  items.push({
    id: 'inp-2-2',
    categoria: 'fornitura_terra',
    codice: 'INP-2.2',
    voce: 'Corrente di cortocircuito presunta al punto di consegna Icc (kA)',
    dettaglio:
      'Valore Icc trifase/monofase dichiarato dall’Ente Distributore (CEI 0-21 / CEI 0-16) o calcolato a valle cabina MT/BT per dimensionamento potere di interruzione Icu/Icn.',
    fonte: 'Distributore / Progetto BT',
    obbligatorio: true,
    statoAuto: haIcc ? 'compilato' : 'mancante',
    valoreAttuale: haIcc
      ? `Icc consegna = ${progetto.fornitura.iccPuntoConsegnaKa} kA`
      : 'MANCANTE — Dato obbligatorio per verifica Icu interruttori',
  });

  const isTT = progetto.fornitura.sistemaDistribuzione === 'TT';
  const valTerra = isTT
    ? progetto.fornitura.resistenzaTerraReOhm
    : progetto.fornitura.impedenzaAnelloGuastoOhm;
  const haTerra = valTerra !== null && valTerra > 0;
  items.push({
    id: 'inp-2-3',
    categoria: 'fornitura_terra',
    codice: 'INP-2.3',
    voce: isTT
      ? 'Resistenza impianto di terra Re (Ω) per coordinamento differenziali'
      : 'Impedenza anello di guasto Zs (Ω) per verifica contatti indiretti',
    dettaglio:
      'Misura strumentale esistente o valore di progetto Re / Zs al fine di verificare Idn * Re <= 50V (TT) o intervento magnetico entro 0,4s/5s (TN).',
    fonte: 'Verbale Verifiche / Elettrico',
    obbligatorio: true,
    statoAuto: haTerra ? 'compilato' : 'mancante',
    valoreAttuale: haTerra
      ? `${isTT ? 'Re' : 'Zs'} = ${valTerra} Ω`
      : `MANCANTE — Inserire ${isTT ? 'Re (Ω)' : 'Zs (Ω)'} nei dati fornitura`,
  });

  const haSorgenteSicurezza = progetto.sorgenti.some(
    (s) => s.derivataAMonteInterruttoreGenerale || s.tipo !== 'rete_ordinaria'
  );
  items.push({
    id: 'inp-2-4',
    categoria: 'fornitura_terra',
    codice: 'INP-2-4',
    voce: 'Schema derivazione alimentazione di sicurezza e sorgenti dedicate (UPS / GE)',
    dettaglio:
      'Verifica disponibilità punto di consegna dedicato a monte dell’interruttore generale ordinario (CEI 64-8 Cap. 56), eventuale Gruppo Elettrogeno o UPS centralizzato con autonomia richiesta.',
    fonte: 'Progetto Elettrico Generale',
    obbligatorio: true,
    statoAuto:
      progetto.sorgenti.length > 0 && haSorgenteSicurezza
        ? 'compilato'
        : progetto.sorgenti.length > 0
          ? 'parziale'
          : 'mancante',
    valoreAttuale:
      progetto.sorgenti.length > 0
        ? progetto.sorgenti
            .map(
              (s) =>
                `${s.sigla} (${s.tipo.replace('_', ' ')}${s.derivataAMonteInterruttoreGenerale ? ', a monte I.G.' : ''})`
            )
            .join(' | ')
        : 'Nessuna sorgente configurata',
  });

  // 3. Ambiente & Posa
  items.push({
    id: 'inp-3-1',
    categoria: 'ambiente_posa',
    codice: 'INP-3.1',
    voce: 'Condizioni ambientali, temperatura di posa, grado IP e classificazione Ma.R.C.I.',
    dettaglio:
      'Temperatura massima ambiente nei locali/cavedi, eventuale rischio incendio Ma.R.C.I. (CEI 64-8 Sez. 751), presenza di polvere/umidità/agenti corrosivi per selezione IP involucri.',
    fonte: 'Progettista Antincendio / Impianti',
    obbligatorio: true,
    statoAuto: 'compilato',
    valoreAttuale: `T_amb = ${progetto.ambiente.temperaturaAmbienteC}°C | Locale: ${progetto.ambiente.tipoLocale} | IP richiesto: ${progetto.ambiente.gradoIPRichiesto} | Ma.R.C.I.: ${progetto.ambiente.ambienteMarci ? 'Sì' : 'No'}`,
  });

  const lineeConLunghezza = progetto.linee.filter((l) => l.lunghezzaM > 0).length;
  items.push({
    id: 'inp-3-2',
    categoria: 'ambiente_posa',
    codice: 'INP-3.2',
    voce: 'Tracciati cavi, lunghezze reali tratte, tipi di posa e fasci/raggruppamenti',
    dettaglio:
      'Definizione dei percorsi planimetrici/verticali da quadro alle utenze e alle dorsali di campo, metodi di posa (tubo, passerella, interrato) e numero di circuiti nello stesso fascio (fattore Kt, Kg).',
    fonte: 'Rilievo / Planimetria Impianti',
    obbligatorio: true,
    statoAuto:
      progetto.linee.length > 0 && lineeConLunghezza === progetto.linee.length
        ? 'compilato'
        : progetto.linee.length > 0
          ? 'parziale'
          : 'mancante',
    valoreAttuale: `${lineeConLunghezza}/${progetto.linee.length} linee quadro con lunghezza > 0 m configurata`,
  });

  const lineeSeparate = progetto.linee.filter(
    (l) => l.percorsoProtetto || l.separataDaAltriImpianti
  ).length;
  items.push({
    id: 'inp-3-3',
    categoria: 'ambiente_posa',
    codice: 'INP-3.3',
    voce: 'Classe di reazione al fuoco CPR e resistenza al fuoco cavi (PH30 / PH120)',
    dettaglio:
      'Requisito di classe CPR (es. Cca-s1b,d1,a1 o B2ca secondo rischio locale) e mantenimento continuità di esercizio PH30/PH60/PH120 (CEI EN 50200 / CEI 20-105) e segregazione circuiti.',
    fonte: 'Normativa / Progettista Antincendio',
    obbligatorio: true,
    statoAuto:
      progetto.linee.length > 0 && lineeSeparate === progetto.linee.length
        ? 'compilato'
        : progetto.linee.length > 0
          ? 'parziale'
          : 'mancante',
    valoreAttuale:
      progetto.linee.length > 0
        ? `Classi CPR impostate (${Array.from(new Set(progetto.linee.map((l) => l.classeCPR))).join(', ')}); ${lineeSeparate}/${progetto.linee.length} con percorso protetto/separato`
        : 'Nessuna linea configurata',
  });

  // 4. Quadro & Utenze
  const quadro = progetto.quadri[0];
  items.push({
    id: 'inp-4-1',
    categoria: 'quadro_utenze',
    codice: 'INP-4.1',
    voce: 'Ubicazione e requisiti costruttivi Quadro Antincendio (forma segregazione, Icc)',
    dettaglio:
      'Posizionamento quadro generale antincendio (locale protetto/compartimentato EI), accessibilità VdF, forma di segregazione interna, grado IP e Icc alle sbarre.',
    fonte: 'Committente / Elettrico',
    obbligatorio: true,
    statoAuto:
      quadro && quadro.iccQuadroKa !== null && quadro.iccQuadroKa > 0
        ? 'compilato'
        : quadro
          ? 'parziale'
          : 'mancante',
    valoreAttuale: quadro
      ? `${quadro.sigla} — ${quadro.nome} (${quadro.gradoIP}, ${quadro.formaSegregazione}, Icc sbarre: ${quadro.iccQuadroKa ?? 'N.D.'} kA)`
      : 'Nessun quadro definito',
  });

  const lineeValide = progetto.linee.filter((l) => l.potenzaNominaleW > 0).length;
  items.push({
    id: 'inp-4-2',
    categoria: 'quadro_utenze',
    codice: 'INP-4.2',
    voce: 'Elenco completo utenze di sicurezza con dati di targa elettrici',
    dettaglio:
      'Potenza nominale (W), tensione, fattore di potenza cos φ, rendimento, tipo di avviamento (diretto, star-delta, inverter, soft-starter) e rapporto Ia/In per tutte le utenze antincendio.',
    fonte: 'Fornitori Macchine / Specialisti',
    obbligatorio: true,
    statoAuto:
      progetto.linee.length > 0 && lineeValide === progetto.linee.length
        ? 'compilato'
        : progetto.linee.length > 0
          ? 'parziale'
          : 'mancante',
    valoreAttuale: `${progetto.linee.length} utenze configurate (${lineeValide} con potenza > 0 W)`,
  });

  items.push({
    id: 'inp-4-3',
    categoria: 'quadro_utenze',
    codice: 'INP-4.3',
    voce: 'Segnali di interfaccia, telecontrollo e contatti puliti tra impianti',
    dettaglio:
      'Elenco segnali di stato (marcia, allarme, guasto, mancanza rete), comandi di sgancio elettrico generale/parziale (bobine a lancio/minima tensione) e interfacce HVAC/ascensori.',
    fonte: 'Elettrico / Impianti Tecnologici',
    obbligatorio: false,
    statoAuto: progetto.linee.some((l) => l.segnali.allarme || l.segnali.comandiRemoti)
      ? 'compilato'
      : 'parziale',
    valoreAttuale: `${progetto.linee.filter((l) => l.segnali.allarme || l.segnali.guasto || l.segnali.comandiRemoti).length} linee con segnali interfaccia abilitati`,
  });

  // 5. IRAI
  if (includiIrai) {
    const totZone = progetto.sistemiIrai.reduce((a, s) => a + s.zone.length, 0);
    const totLoop = progetto.sistemiIrai.reduce((a, s) => a + s.loop.length, 0);
    const totDisp = progetto.sistemiIrai.reduce(
      (a, s) =>
        a +
        s.loop.reduce(
          (al, l) => al + l.dispositivi.reduce((ad, d) => ad + Math.max(1, d.quantita ?? 1), 0),
          0
        ),
      0
    );
    const totCe = progetto.sistemiIrai.reduce((a, s) => a + s.causaEffetto.length, 0);

    items.push({
      id: 'inp-5-1',
      categoria: 'irai_rivelazione',
      codice: 'INP-5.1',
      voce: 'Suddivisione in Zone di Rivelazione e Zone di Allarme IRAI (UNI 9795 §5.4)',
      dettaglio:
        'Definizione delle zone di rivelazione in funzione di superficie max (1.600 m²), piani/compartimenti e identificazione visiva rapida da centrale.',
      fonte: 'Progettista Antincendio / IRAI',
      obbligatorio: true,
      statoAuto: totZone > 0 ? 'compilato' : 'mancante',
      valoreAttuale: `${progetto.sistemiIrai.length} centrali IRAI · ${totZone} zone di rivelazione definite`,
    });

    items.push({
      id: 'inp-5-2',
      categoria: 'irai_rivelazione',
      codice: 'INP-5.2',
      voce: 'Geometria locali: altezze soffitto, travi/velette, controsoffitti e pavimenti sopraelevati',
      dettaglio:
        'Quote altezze nette per scelta tipologia rivelatori (ottici, lineari, aspirazione ASD, termici), profondità ribassamenti/travi e presenza controsoffitti/pavimenti (>800mm o carico d’incendio).',
      fonte: 'Architettonico / Rilievo',
      obbligatorio: true,
      statoAuto: 'mancante',
      valoreAttuale: 'Dato geometrico da verificare sulle sezioni architettoniche allegate',
    });

    items.push({
      id: 'inp-5-3',
      categoria: 'irai_rivelazione',
      codice: 'INP-5.3',
      voce: 'Ubicazione centrale IRAI, anagrafica dispositivi EN 54 e topologia/lunghezza loop',
      dettaglio:
        'Locale presidiato o pannello ripetitore remoto (EN 54-2), marca/modello dispositivi per calcolo correnti Iq/Ia, lunghezze stimate dei loop e limite max dispositivi per loop.',
      fonte: 'Installatore / Progetto IRAI',
      obbligatorio: true,
      statoAuto:
        progetto.sistemiIrai.length > 0 && totLoop > 0 && totDisp > 0
          ? 'compilato'
          : progetto.sistemiIrai.length > 0
            ? 'parziale'
            : 'mancante',
      valoreAttuale: `${totLoop} loop configurati · ${totDisp} dispositivi totali in anagrafica/loop`,
    });

    items.push({
      id: 'inp-5-4',
      categoria: 'irai_rivelazione',
      codice: 'INP-5.4',
      voce: 'Matrice Causa-Effetto: targhe O/A, sganci impianti, porte REI, HVAC/evacuazione fumi',
      dettaglio:
        'Logiche di attivazione allarmi acustico-ottici, ritardi di verifica/ricognizione, interfacce verso serrande tagliafuoco, elettromagneti porte REI, ascensori, UTA e sistema EVAC.',
      fonte: 'Progettista Antincendio / Impianti',
      obbligatorio: true,
      statoAuto: totCe > 0 ? 'compilato' : 'mancante',
      valoreAttuale: `${totCe} righe matrice Causa-Effetto configurate`,
    });

    const iraiBattOk =
      progetto.sistemiIrai.length > 0 &&
      progetto.sistemiIrai.every((s) => s.capacitaBatterieInstallataAh > 0 && s.autonomiaQuieteRichiestaOre >= 24);
    items.push({
      id: 'inp-5-5',
      categoria: 'irai_rivelazione',
      codice: 'INP-5.5',
      voce: 'Requisito autonomia batterie EN 54-4 (24h vs 72h in assenza di presidio H24)',
      dettaglio:
        'Conferma autonomia in quiete (24 ore se allarme guasto riportato a presidio/servizio assistenza, altrimenti 72 ore) + almeno 30 minuti in stato di allarme.',
      fonte: 'Normativa / Gestore Impianto',
      obbligatorio: true,
      statoAuto: iraiBattOk ? 'compilato' : 'parziale',
      valoreAttuale:
        progetto.sistemiIrai.length > 0
          ? progetto.sistemiIrai
              .map(
                (s) =>
                  `${s.sigla}: ${s.autonomiaQuieteRichiestaOre}h + ${s.autonomiaAllarmeRichiestaMin}m (Batt ${s.capacitaBatterieInstallataAh}Ah)`
              )
              .join(' | ')
          : 'Nessun sistema IRAI presente',
    });
  }

  // 6. EVAC
  if (includiEvac) {
    const totLineeEvac = progetto.sistemiEvac.reduce((a, s) => a + s.lineeAltoparlanti.length, 0);
    const totDiffEvac = progetto.sistemiEvac.reduce(
      (a, s) => a + s.lineeAltoparlanti.reduce((al, l) => al + l.numeroAltoparlanti, 0),
      0
    );

    items.push({
      id: 'inp-6-1',
      categoria: 'evac_vocale',
      codice: 'INP-6.1',
      voce: 'Zonizzazione acustica EVAC, confini ADA e postazioni microfoniche (FMS)',
      dettaglio:
        'Definizione delle Aree Acusticamente Distinguibili (ADA) coerenti con compartimenti e fasi evacuazione, numero e ubicazione postazioni microfoniche Vigili del Fuoco / emergenza.',
      fonte: 'Progettista Antincendio / EVAC',
      obbligatorio: progetto.sistemiEvac.length > 0,
      statoAuto: totLineeEvac > 0 ? 'compilato' : progetto.sistemiEvac.length > 0 ? 'parziale' : 'mancante',
      valoreAttuale: `${progetto.sistemiEvac.length} centrali VACIE · ${totLineeEvac} linee/zone diffusori · ${totDiffEvac} altoparlanti`,
    });

    items.push({
      id: 'inp-6-2',
      categoria: 'evac_vocale',
      codice: 'INP-6.2',
      voce: 'Dati acustici per ADA (125 Hz – 8 kHz): RT60 e rumore ambientale (Prospetto 24 / misure)',
      dettaglio:
        'Valori di rumore di fondo ambientale e tempo di riverberazione RT60 (o volumi/materiali finitura locali) per calcolo rapporto segnale/rumore e intelligibilità STI >= 0,50 (UNI 11988:2025).',
      fonte: 'Tecnico Acustico / Rilievo Fonometrico',
      obbligatorio: progetto.sistemiEvac.length > 0,
      statoAuto:
        progetto.sistemiEvac.length > 0 && totLineeEvac > 0 ? 'parziale' : 'mancante',
      valoreAttuale:
        totLineeEvac > 0
          ? 'Verificare in sezione Documentazione EVAC se il rumore di fondo è stimato da Prospetto 24 o misurato in opera'
          : 'Nessuna ADA / linea diffusori definita',
    });

    items.push({
      id: 'inp-6-3',
      categoria: 'evac_vocale',
      codice: 'INP-6.3',
      voce: 'Architettura linee diffusori (100V/70V, A/B, anello/radiale) e ridondanza amplificatori N+1',
      dettaglio:
        'Scelta tensione di linea, separazione circuiti ridondanti (linee A+B o anello per zona), lunghezza e sezione cavi PH30/PH120 per caduta di tensione e amplificatore di riserva caldo N+1.',
      fonte: 'Progettista EVAC / Fornitore',
      obbligatorio: progetto.sistemiEvac.length > 0,
      statoAuto:
        progetto.sistemiEvac.length > 0 &&
        progetto.sistemiEvac.every((s) => s.amplificatori.length > 0 && s.lineeAltoparlanti.length > 0)
          ? 'compilato'
          : 'mancante',
      valoreAttuale:
        progetto.sistemiEvac.length > 0
          ? progetto.sistemiEvac
              .map(
                (s) =>
                  `${s.sigla}: ${s.amplificatori.length} ampl., ridondanza N+1 ${s.ridondanzaAmplificatoriN1 ? 'attiva' : 'disattiva'}`
              )
              .join(' | ')
          : 'Nessun sistema EVAC configurato',
    });

    const evacInterf =
      progetto.sistemiEvac.length > 0 &&
      progetto.sistemiEvac.every((s) => s.interfacciaIraiCollegata && s.autonomiaQuieteRichiestaOre >= 24);
    items.push({
      id: 'inp-6-4',
      categoria: 'evac_vocale',
      codice: 'INP-6.4',
      voce: 'Interfaccia sorvegliata IRAI–VACIE e autonomia secondaria EN 54-4',
      dettaglio:
        'Collegamento fisico monitorato in cavo resistente al fuoco tra centrale IRAI e VACIE per attivazione automatica messaggi vocali e verifica batterie (24h/72h quiete + 30 min allarme).',
      fonte: 'Progettista IRAI/EVAC',
      obbligatorio: progetto.sistemiEvac.length > 0,
      statoAuto: evacInterf ? 'compilato' : progetto.sistemiEvac.length > 0 ? 'parziale' : 'mancante',
      valoreAttuale:
        progetto.sistemiEvac.length > 0
          ? progetto.sistemiEvac
              .map(
                (s) =>
                  `${s.sigla}: interfaccia IRAI ${s.interfacciaIraiCollegata ? `Sì (${s.cavoInterfacciaResistenteFuoco})` : 'No'}`
              )
              .join(' | ')
          : 'Nessun sistema EVAC configurato',
    });
  }

  // 7. Documenti di base
  items.push({
    id: 'inp-7-1',
    categoria: 'documenti_base',
    codice: 'INP-7.1',
    voce: 'Planimetrie architettoniche DWG / DXF aggiornate e quotate (tutti i piani)',
    dettaglio:
      'Elaborati grafici CAD puliti con destinazione d’uso dei singoli locali, superfici, porte/uscite di sicurezza e percorsi cavidotti principali.',
    fonte: 'Architettonico / Committente',
    obbligatorio: true,
    statoAuto: 'mancante',
    valoreAttuale: 'Allegato esterno da acquisire prima dell’emissione esecutiva',
  });

  items.push({
    id: 'inp-7-2',
    categoria: 'documenti_base',
    codice: 'INP-7.2',
    voce: 'Sezioni verticali architettoniche (quote solai, controsoffitti, capriate)',
    dettaglio:
      'Necessarie per verificare altezza d’installazione rivelatori/pulsanti/targhe e copertura conica/orientamento diffusori acustici EVAC.',
    fonte: 'Architettonico / Committente',
    obbligatorio: true,
    statoAuto: 'mancante',
    valoreAttuale: 'Allegato esterno da acquisire',
  });

  items.push({
    id: 'inp-7-3',
    categoria: 'documenti_base',
    codice: 'INP-7.3',
    voce: 'Valutazione Progetto / Parere di conformità VV.F. e Piano di Emergenza',
    dettaglio:
      'Relazione tecnica antincendio approvata (o SCIA/parere VV.F.) con eventuali prescrizioni particolari e condizioni di esercizio.',
    fonte: 'Progettista Antincendio',
    obbligatorio: true,
    statoAuto: 'mancante',
    valoreAttuale: 'Documento autorizzativo da acquisire / protocollare',
  });

  items.push({
    id: 'inp-7-4',
    categoria: 'documenti_base',
    codice: 'INP-7.4',
    voce: 'Datasheet apparecchiature previste (Centrale, Dispositivi EN 54, Pompe, UPS, Cavi)',
    dettaglio:
      'Schede tecniche e DoP CPR di centrali IRAI/VACIE, rivelatori, amplificatori, altoparlanti EN 54-24 (SPL @ 1W/4m), batterie ed eventuali gruppi pompe.',
    fonte: 'Fornitori / Installatore',
    obbligatorio: false,
    statoAuto: progetto.sistemiIrai.some((s) => (s.anagraficaComponenti?.length ?? 0) > 0)
      ? 'parziale'
      : 'mancante',
    valoreAttuale: `Anagrafica IRAI interna con ${progetto.sistemiIrai.reduce((a, s) => a + (s.anagraficaComponenti?.length ?? 0), 0)} articoli precaricati — acquisire DoP ufficiali`,
  });

  // Eventuali non conformità o dati mancanti dal motore verifiche -> evidenziazione nella checklist
  const esitiMancanti = esiti.filter((e) => e.stato === 'dato_mancante');
  if (esitiMancanti.length > 0) {
    items.push({
      id: 'inp-2-5',
      categoria: 'fornitura_terra',
      codice: 'INP-2.5',
      voce: 'Risoluzione dati mancanti rilevati dal motore di verifica automatico',
      dettaglio: `Il motore di calcolo segnala ${esitiMancanti.length} verifiche bloccate per dato mancante: ${esitiMancanti.map((e) => `${e.codice} (${e.targetLabel})`).join('; ')}.`,
      fonte: 'Motore Calcolo ElettroCAD',
      obbligatorio: true,
      statoAuto: 'mancante',
      valoreAttuale: `${esitiMancanti.length} verifiche in stato "Dato Mancante"`,
    });
  }

  // Voci custom salvate dall'utente
  const customItems = (progetto.checklistInputCustom ?? []).map((c, idx) => ({
    id: c.id,
    categoria: c.categoria,
    codice: `CUS-${idx + 1}`,
    voce: c.voce,
    dettaglio: c.dettaglio,
    fonte: c.fonte,
    obbligatorio: c.obbligatorio,
    statoAuto: 'mancante' as const,
    valoreAttuale: 'Voce personalizzata di commessa',
    custom: true,
  }));

  const allItems = [...items, ...customItems];

  return allItems.map((it) => {
    const saved = statiSalvati[it.id];
    const acquisito = saved ? saved.acquisito : it.statoAuto === 'compilato';
    const nota = saved?.nota ?? '';
    return {
      ...it,
      categoriaLabel: CATEGORIA_LABEL_MAP[it.categoria],
      acquisito,
      nota,
    };
  });
}
