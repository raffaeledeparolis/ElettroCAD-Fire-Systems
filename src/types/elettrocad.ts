export type SistemaDistribuzione = 'TT' | 'TN-S' | 'TN-C' | 'IT';
export type TipoFornitura = 'monofase' | 'trifase';
export type LivelloPrestazione = 'L1' | 'L2' | 'L3' | 'L4' | 'non_definito';
export type TipoUtenza =
  | 'centrale_irai'
  | 'alimentatore_irai'
  | 'centrale_evac'
  | 'amplificatore_evac'
  | 'ups_sicurezza'
  | 'commutazione_sicurezza'
  | 'illuminazione_emergenza'
  | 'elettropompa'
  | 'pompa_pilota'
  | 'altro';

export type TipoAvviamento = 'diretto' | 'stella_triangolo' | 'soft_starter' | 'inverter' | 'statico';
export type TipoPosa = 'tubo_incassato' | 'tubo_a_vista' | 'canale_passerella' | 'interrato' | 'aria_libera';
export type ResistenzaFuocoCavo = 'nessuna' | 'PH30' | 'PH60' | 'PH90' | 'PH120';
export type ClasseCPR = 'Eca' | 'Dca-s2,d2,a2' | 'Cca-s1b,d1,a1' | 'B2ca-s1a,d1,a1';
export type TipoProtezione = 'magnetotermico' | 'magnetotermico_differenziale' | 'fusibile' | 'sezionatore';
export type CurvaIntervento = 'B' | 'C' | 'D' | 'gG' | 'aM' | 'AC';
export type StatoVerifica = 'conforme' | 'non_conforme' | 'dato_mancante' | 'da_verificare';

export interface DatiIdentificativiProgetto {
  cliente: string;
  commessa: string;
  sito: string;
  progettista: string;
  autoreModificaCorrente: string;
  revisione: string;
  data: string;
  titoloTavola: string;
  scala: string;
  logoTestoStudio: string;
}

export interface DatiFornitura {
  tipoFornitura: TipoFornitura;
  tensioneNominaleV: number; // 230 o 400
  frequenzaHz: number; // 50
  sistemaDistribuzione: SistemaDistribuzione;
  potenzaDisponibileKw: number;
  iccPuntoConsegnaKa: number | null; // null se mancante -> segnala
  impedenzaAnelloGuastoOhm: number | null;
  resistenzaTerraReOhm: number | null;
}

export interface CondizioniAmbientali {
  temperaturaAmbienteC: number;
  tipoLocale: 'ordinario' | 'locale_tecnico_antincendio' | 'centrale_controllo' | 'deposito_marci';
  gradoIPRichiesto: 'IP2X' | 'IP4X' | 'IP54' | 'IP55' | 'IP65';
  ambienteMarci: boolean;
}

export interface RiferimentoNormativoProgetto {
  codice: string;
  titolo: string;
  edizione: string;
  attivo: boolean;
}

export interface SorgenteAlimentazione {
  id: string;
  sigla: string;
  nome: string;
  tipo: 'rete_ordinaria' | 'linea_preferenziale' | 'ups' | 'gruppo_batterie';
  derivataAMonteInterruttoreGenerale: boolean;
  potenzaKva: number;
  tensioneV: number;
  autonomiaRichiestaMin: number;
  tempoCommutazioneSec: number;
}

export interface QuadroElettrico {
  id: string;
  sigla: string;
  nome: string;
  sorgenteId: string;
  tensioneV: number;
  tipoFornitura: TipoFornitura;
  gradoIP: 'IP2X' | 'IP4X' | 'IP54' | 'IP55' | 'IP65';
  formaSegregazione: 'Forma 1' | 'Forma 2a' | 'Forma 2b' | 'Forma 3b' | 'Forma 4';
  correnteNominaleBarraA: number;
  iccQuadroKa: number | null;
  interruttoreGeneraleInA: number;
  interruttoreGeneraleIcuKa: number;
  interruttoreGeneraleSelettivo: boolean;
  alimentazionePreferenzialeAMonte: boolean;
}

export interface SegnaliInterfaccia {
  allarme: boolean;
  guasto: boolean;
  marcia: boolean;
  mancanzaRete: boolean;
  comandiRemoti: boolean;
}

export interface LineaUtenza {
  id: string;
  quadroId: string;
  sigla: string;
  descrizione: string;
  tipoUtenza: TipoUtenza;
  potenzaNominaleW: number;
  tensioneV: number;
  tipoFornitura: TipoFornitura;
  cosPhi: number;
  rendimento: number;
  tipoAvviamento: TipoAvviamento;
  rapportoIaIn: number;
  coefficienteUtilizzoKu: number;
  coefficienteContemporaneitaKc: number;
  lunghezzaM: number;
  tipoPosa: TipoPosa;
  circuitiRaggruppati: number;
  temperaturaPosaC: number;
  resistenzaFuocoRichiesta: ResistenzaFuocoCavo;
  resistenzaFuocoCavoScelto: ResistenzaFuocoCavo;
  classeCPR: ClasseCPR;
  percorsoProtetto: boolean;
  separataDaAltriImpianti: boolean;
  tipoProtezione: TipoProtezione;
  curvaProtezione: CurvaIntervento;
  protezioneInManualeA: number | null; // null = auto-dimensionamento
  protezioneIcuKa: number;
  differenzialeIdnMa: number | null;
  sezioneManualeMm2: number | null; // null = auto-dimensionamento
  autonomiaBatterieOre: number;
  tempoInterventoEmergenzaSec: number;
  segnali: SegnaliInterfaccia;
  simboloCodice: string;
}

export interface DispositivoIRAI {
  id: string;
  indirizzo: number;
  sigla: string;
  tipo: 'rivelatore_ottico' | 'rivelatore_termico' | 'pulsante_manuale' | 'targa_ottico_acustica' | 'modulo_ingresso' | 'modulo_uscita';
  zonaId: string;
  descrizione: string;
  correnteQuieteMa: number;
  correnteAllarmeMa: number;
  simboloCodice: string;
}

export interface LoopIRAI {
  id: string;
  sigla: string;
  nome: string;
  lunghezzaM: number;
  sezioneCavoMm2: number;
  resistenzaFuoco: ResistenzaFuocoCavo;
  tensioneNominaleV: number;
  maxDispositiviConsentiti: number;
  cadutaTensioneMaxV: number;
  dispositivi: DispositivoIRAI[];
}

export interface ZonaIRAI {
  id: string;
  codice: string;
  nome: string;
}

export interface RigaCausaEffetto {
  id: string;
  causaZonaId: string;
  causaDescrizione: string;
  attivaTargheOtticoAcustiche: boolean;
  attivaEvac: boolean;
  messaggioEvac: string;
  sgancioImpiantiTecnologici: boolean;
  chiusuraPorteTagliafuoco: boolean;
  ritardoSecondi: number;
}

export interface SistemaIRAI {
  id: string;
  sigla: string;
  nome: string;
  lineaAlimentazioneId: string;
  modelloCentrale: string;
  tensioneSistemaV: 24;
  correnteCentraleQuieteMa: number;
  correnteCentraleAllarmeMa: number;
  correnteAlimentatoreMaxA: number;
  autonomiaQuieteRichiestaOre: number;
  autonomiaAllarmeRichiestaMin: number;
  capacitaBatterieInstallataAh: number;
  loop: LoopIRAI[];
  zone: ZonaIRAI[];
  causaEffetto: RigaCausaEffetto[];
}

export interface AmplificatoreEVAC {
  id: string;
  sigla: string;
  modello: string;
  potenzaNominaleW: number;
  diRiserva: boolean;
}

export type DistribuzioneCaricoEVAC = 'concentrato' | 'distribuito';

export interface LineaAltoparlantiEVAC {
  id: string;
  sigla: string;
  zonaNome: string;
  topologia: 'radiale' | 'anello';
  distribuzioneCarico?: DistribuzioneCaricoEVAC;
  tensioneLineaV: 100 | 70;
  numeroAltoparlanti: number;
  potenzaTotaleAltoparlantiW: number;
  lunghezzaM: number;
  sezioneMm2: number;
  resistenzaFuoco: ResistenzaFuocoCavo;
  cadutaTensioneMaxPct?: number;
  amplificatoreId: string;
}

export interface SistemaEVAC {
  id: string;
  sigla: string;
  nome: string;
  lineaAlimentazioneId: string;
  modelloCentrale: string;
  ridondanzaAmplificatoriN1: boolean;
  marginePotenzaRichiestoPct: number;
  autonomiaQuieteRichiestaOre: number;
  autonomiaAllarmeRichiestaMin: number;
  correnteQuieteA: number;
  correnteAllarmeA: number;
  capacitaBatterieInstallataAh: number;
  interfacciaIraiCollegata: boolean;
  cavoInterfacciaResistenteFuoco: ResistenzaFuocoCavo;
  separazioneCircuitiPotenza: boolean;
  amplificatori: AmplificatoreEVAC[];
  lineeAltoparlanti: LineaAltoparlantiEVAC[];
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  autore: string;
  sezione: string;
  campo: string;
  valorePrecedente: string;
  valoreNuovo: string;
}

export interface RevisionSnapshot {
  id: string;
  revisione: string;
  data: string;
  autore: string;
  note: string;
  snapshotJson: string;
}

export interface DerogaRegola {
  regolaId: string;
  targetId: string;
  disattivata: boolean;
  motivazione: string;
  autore: string;
  data: string;
}

export interface LayoutNodeOverride {
  dx: number;
  dy: number;
}

export interface AnnotazioneSchema {
  id: string;
  foglio: number;
  x: number;
  y: number;
  testo: string;
}

export interface ProgettoAntincendio {
  id: string;
  archiviato: boolean;
  dataCreazione: string;
  ultimoAggiornamento: string;
  identificativi: DatiIdentificativiProgetto;
  fornitura: DatiFornitura;
  ambiente: CondizioniAmbientali;
  attivitaNome: string;
  livelloPrestazione: LivelloPrestazione;
  norme: RiferimentoNormativoProgetto[];
  sorgenti: SorgenteAlimentazione[];
  quadri: QuadroElettrico[];
  linee: LineaUtenza[];
  sistemiIrai: SistemaIRAI[];
  sistemiEvac: SistemaEVAC[];
  deroghe: DerogaRegola[];
  auditLog: AuditEntry[];
  revisioni: RevisionSnapshot[];
  templateIdAssociato: string;
  layoutOverrides: Record<string, LayoutNodeOverride>;
  annotazioni: AnnotazioneSchema[];
}

export interface RisultatoCalcoloLinea {
  lineaId: string;
  potenzaAssorbitaW: number;
  potenzaContemporaneaW: number;
  correnteImpiegoIbA: number;
  correnteSpuntoA: number;
  sezioneSceltaMm2: number;
  portataBaseI0A: number;
  fattoreKt: number;
  fattoreKg: number;
  portataCorrettaIzA: number;
  protezioneSceltaInA: number;
  siglaProtezioneCompleta: string;
  siglaCavoCompleta: string;
  cadutaTensioneV: number;
  cadutaTensionePct: number;
  cadutaTensioneAvviamentoPct: number;
  iccPresuntaFineLineaKa: number;
  energiaSpecificaI2t: number;
  resistenzaTermicaCavoK2S2: number;
  verificaContattiIndirettiOk: boolean | null;
  verificaCoordinamentoOk: boolean;
  verificaSelettivitaOk: boolean;
  formuleDettaglio: string[];
  fonteNormativa: string;
}

export interface RisultatoCalcoloQuadro {
  quadroId: string;
  potenzaInstallataTotaleKw: number;
  potenzaContemporaneaKw: number;
  correnteTotaleImpiegoA: number;
  interruttoreGeneraleConsigliatoA: number;
  numeroLinee: number;
}

export interface RisultatoCalcoloLoop {
  loopId: string;
  numeroDispositivi: number;
  correnteQuieteMa: number;
  correnteAllarmeMa: number;
  cadutaTensioneLoopV: number;
  formulaDettaglio: string;
}

export interface RisultatoCalcoloIRAI {
  sistemaId: string;
  correnteTotaleQuieteA: number;
  correnteTotaleAllarmeA: number;
  capacitaBatterieMinimaAh: number;
  correnteAlimentatoreMinimaA: number;
  loopRisultati: RisultatoCalcoloLoop[];
  formulaBatterie: string;
}

export interface RisultatoCalcoloLineaEVAC {
  lineaId: string;
  correnteLineaA: number;
  impedenzaCaricoOhm: number;
  resistenzaCavoOhm: number;
  resistenzaEffettivaOhm: number;
  cadutaTensioneV: number;
  cadutaTensionePct: number;
  sogliaMaxPct: number;
  attenuazioneDb: number;
  perditaPotenzaPct: number;
  lunghezzaMassimaAmmissibileM: number;
  sezioneMinimaConsigliataMm2: number;
  conformeCadutaTensione: boolean;
  caricoAmplificatorePct: number;
  formulaDettaglio: string;
}

export interface RisultatoCalcoloEVAC {
  sistemaId: string;
  potenzaTotaleAltoparlantiW: number;
  potenzaAmplificatoriAttiviW: number;
  potenzaRichiestaConMargineW: number;
  haAmplificatoreRiserva: boolean;
  capacitaBatterieMinimaAh: number;
  lineeRisultati: RisultatoCalcoloLineaEVAC[];
  formulaBatterie: string;
}

export interface RisultatoCalcoloCompleto {
  versioneApp: string;
  versioneRegole: string;
  versioneLibreria: string;
  linee: Record<string, RisultatoCalcoloLinea>;
  quadri: Record<string, RisultatoCalcoloQuadro>;
  irai: Record<string, RisultatoCalcoloIRAI>;
  evac: Record<string, RisultatoCalcoloEVAC>;
  upsKvaConsigliato: number;
}

export interface RegolaAntincendio {
  id: string;
  codice: string;
  categoria: 'completezza' | 'alimentazione' | 'cavi_posa' | 'protezioni' | 'quadri' | 'irai' | 'evac';
  titolo: string;
  descrizione: string;
  normaRiferimento: string;
  edizione: string;
  sogliaPredefinita: string;
  versione: string;
  attivaDiDefault: boolean;
}

export interface EsitoVerifica {
  id: string;
  regolaId: string;
  codice: string;
  categoria: RegolaAntincendio['categoria'];
  titolo: string;
  normaRiferimento: string;
  targetId: string;
  targetLabel: string;
  stato: StatoVerifica;
  valoreCalcolato: string;
  sogliaAttesa: string;
  messaggio: string;
  formula: string;
  derogata: boolean;
  motivazioneDeroga?: string;
}

export interface SimboloNormativo {
  codice: string;
  nome: string;
  categoria: 'prevenzione_incendi' | 'sicurezza' | 'elettrico';
  normaOrigine: string;
  descrizione: string;
}

export interface ComponenteLibreria {
  id: string;
  codiceCostruttore: string;
  costruttore: string;
  categoria: 'protezione' | 'cavo' | 'irai' | 'evac' | 'ups';
  descrizione: string;
  correnteNominaleA?: number;
  potereInterruzioneKa?: number;
  curva?: CurvaIntervento;
  sezioneMm2?: number;
  resistenzaFuoco?: ResistenzaFuocoCavo;
  ingombroModuliDin?: number;
  potenzaW?: number;
  versioneCatalogo: string;
  dataCatalogo: string;
  approvatoAziendale: boolean;
  preferito: boolean;
}

export interface MappaturaCampoDXF {
  campoProgetto:
    | 'commessa'
    | 'cliente'
    | 'progettista'
    | 'titoloTavola'
    | 'scala'
    | 'data'
    | 'revisione'
    | 'numeroTavola';
  tagAttributoDXF: string;
}

export interface TemplateTavolaDXF {
  id: string;
  nome: string;
  versione: string;
  clienteAssociato: string;
  predefinito: boolean;
  formatoFoglio: 'A4' | 'A3';
  orientamento: 'orizzontale' | 'verticale';
  larghezzaMm: number;
  altezzaMm: number;
  layerRilevati: string[];
  blocchiRilevati: string[];
  attributiRilevati: string[];
  mappatura: MappaturaCampoDXF[];
  nomeFileOriginale?: string;
  rawDxfContent?: string;
}

export interface CasoTestRiferimento {
  id: string;
  titolo: string;
  descrizione: string;
  riferimentoManuale: string;
  attesoIbA: number;
  attesoSezioneMm2: number;
  attesoDvPct: number;
  attesoBatteriaIraiAh?: number;
  tolleranzaPct: number;
}
