import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Copy,
  FileSpreadsheet,
  HelpCircle,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Printer,
  Trash2,
  XCircle,
} from 'lucide-react';
import { ANAGRAFICA_COMPONENTI_IRAI_DEFAULT } from '../data/rulesAndLibrary';
import { SEZIONI_EVAC_STANDARD } from '../engine/calculator';
import {
  esportaExcelRiepilogoSistemaIrai,
  esportaPdfRiepilogoSistemaIrai,
} from '../engine/exporters';
import {
  ClasseCPR,
  ComponenteAnagraficaIRAI,
  CurvaIntervento,
  DispositivoIRAI,
  DistribuzioneCaricoEVAC,
  EsitoVerifica,
  LayoutNodeOverride,
  LineaAltoparlantiEVAC,
  LineaUtenza,
  LivelloPrestazione,
  LoopIRAI,
  ProgettoAntincendio,
  ResistenzaFuocoCavo,
  RigaCausaEffetto,
  RisultatoCalcoloCompleto,
  SistemaDistribuzione,
  SistemaEVAC,
  TemplateTavolaDXF,
  TipoAvviamento,
  TipoPosa,
  TipoProtezione,
  TipoUtenza,
  ZonaIRAI,
} from '../types/elettrocad';
import { SchematicCanvas } from './SchematicCanvas';
import { SymbolSvg } from './SymbolSvg';
import { SezioneApp } from './TopBar';

type NodoAlbero =
  | { tipo: 'generali' }
  | { tipo: 'sorgenti_quadri' }
  | { tipo: 'linee'; lineaId?: string }
  | { tipo: 'irai'; sistemaId: string }
  | { tipo: 'evac'; sistemaId: string };

interface DesignWorkspaceProps {
  progetto: ProgettoAntincendio;
  calcolo: RisultatoCalcoloCompleto;
  esiti: EsitoVerifica[];
  template: TemplateTavolaDXF;
  onAggiornaProgetto: (
    updater: (prev: ProgettoAntincendio) => ProgettoAntincendio,
    audit?: { sezione: string; campo: string; prevVal: string; newVal: string }
  ) => void;
  onVaiARegole: (sezione: SezioneApp) => void;
}

export const DesignWorkspace: React.FC<DesignWorkspaceProps> = ({
  progetto,
  calcolo,
  esiti,
  template,
  onAggiornaProgetto,
  onVaiARegole,
}) => {
  const [nodoAttivo, setNodoAttivo] = useState<NodoAlbero>({
    tipo: 'linee',
    lineaId: progetto.linee[0]?.id,
  });
  const [vistaLayout, setVistaLayout] = useState<'divisa' | 'dati' | 'schema'>(
    'divisa'
  );
  const [modalitaInserimento, setModalitaInserimento] = useState<
    'guidata' | 'avanzata'
  >('guidata');
  const [ispettoreAperto, setIspettoreAperto] = useState(true);
  const [iraiSubTab, setIraiSubTab] = useState<'zone' | 'anagrafica' | 'loop' | 'causa_effetto' | 'batterie'>('loop');
  const [nuovaZonaCodice, setNuovaZonaCodice] = useState('');
  const [nuovaZonaNome, setNuovaZonaNome] = useState('');
  const [nuovoDispTipoPerLoop, setNuovoDispTipoPerLoop] = useState<
    Record<string, DispositivoIRAI['tipo']>
  >({});
  const [nuovoDispZonaPerLoop, setNuovoDispZonaPerLoop] = useState<
    Record<string, string>
  >({});
  const [nuovoDispQuantitaPerLoop, setNuovoDispQuantitaPerLoop] = useState<
    Record<string, number>
  >({});
  const [nuovoDispAnagraficaPerLoop, setNuovoDispAnagraficaPerLoop] = useState<
    Record<string, string>
  >({});
  const [nuovoCompCodice, setNuovoCompCodice] = useState('');
  const [nuovoCompCostruttore, setNuovoCompCostruttore] = useState('Notifier / EN 54');
  const [nuovoCompModello, setNuovoCompModello] = useState('');
  const [nuovoCompTipo, setNuovoCompTipo] = useState<DispositivoIRAI['tipo']>('rivelatore_ottico');
  const [nuovoCompNorma, setNuovoCompNorma] = useState('EN 54-7');
  const [nuovoCompIq, setNuovoCompIq] = useState(0.35);
  const [nuovoCompIa, setNuovoCompIa] = useState(5.5);
  const [nuovoCompDescrizione, setNuovoCompDescrizione] = useState('');

  const PRESET_DISPOSITIVI_IRAI: Record<
    DispositivoIRAI['tipo'],
    {
      label: string;
      prefisso: string;
      descrizioneDefault: string;
      iqMa: number;
      iaMa: number;
      simbolo: string;
    }
  > = {
    rivelatore_ottico: {
      label: 'Rivelatore ottico di fumo',
      prefisso: 'R',
      descrizioneDefault: 'Rivelatore ottico di fumo indirizzato',
      iqMa: 0.35,
      iaMa: 5.5,
      simbolo: 'DM83-RIVELATORE',
    },
    rivelatore_termico: {
      label: 'Rivelatore termico',
      prefisso: 'RT',
      descrizioneDefault: 'Rivelatore termovelocimetrico indirizzato',
      iqMa: 0.35,
      iaMa: 5.5,
      simbolo: 'DM83-RIVELATORE',
    },
    pulsante_manuale: {
      label: 'Pulsante manuale allarme',
      prefisso: 'P',
      descrizioneDefault: 'Pulsante manuale di segnalazione incendio',
      iqMa: 0.3,
      iaMa: 6.0,
      simbolo: 'DM83-PULSANTE',
    },
    targa_ottico_acustica: {
      label: 'Targa ottico-acustica / Sirena',
      prefisso: 'T',
      descrizioneDefault: 'Targa ottico-acustica di allarme incendio',
      iqMa: 0.8,
      iaMa: 45.0,
      simbolo: 'DM83-SIRENA',
    },
    modulo_uscita: {
      label: 'Modulo di uscita (comandi)',
      prefisso: 'MU',
      descrizioneDefault: 'Modulo di uscita attuazione comandi antincendio',
      iqMa: 0.5,
      iaMa: 12.0,
      simbolo: 'DM83-CENTRALE',
    },
    modulo_ingresso: {
      label: 'Modulo di ingresso (stati)',
      prefisso: 'MI',
      descrizioneDefault: 'Modulo di ingresso monitoraggio stati/allarmi',
      iqMa: 0.4,
      iaMa: 5.0,
      simbolo: 'DM83-CENTRALE',
    },
  };

  const lineaSelezionataId =
    nodoAttivo.tipo === 'linee' ? nodoAttivo.lineaId ?? progetto.linee[0]?.id ?? null : null;
  const lineaAttiva =
    progetto.linee.find((l) => l.id === lineaSelezionataId) ?? progetto.linee[0];

  const quadroPrincipale = progetto.quadri[0];

  const nonConformiTot = esiti.filter((e) => e.stato === 'non_conforme').length;
  const mancantiTot = esiti.filter((e) => e.stato === 'dato_mancante').length;

  const aggiungiLinea = () => {
    const idx = progetto.linee.length + 1;
    const nuova: LineaUtenza = {
      id: `ln-${Date.now()}`,
      quadroId: quadroPrincipale?.id ?? 'q-ant-01',
      sigla: `L${idx}`,
      descrizione: `Nuova Linea Sicurezza ${idx}`,
      tipoUtenza: 'altro',
      potenzaNominaleW: 500,
      tensioneV: 230,
      tipoFornitura: 'monofase',
      cosPhi: 0.9,
      rendimento: 0.9,
      tipoAvviamento: 'statico',
      rapportoIaIn: 1,
      coefficienteUtilizzoKu: 1,
      coefficienteContemporaneitaKc: 1,
      lunghezzaM: 30,
      tipoPosa: 'canale_passerella',
      circuitiRaggruppati: 2,
      temperaturaPosaC: progetto.ambiente.temperaturaAmbienteC,
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
      segnali: {
        allarme: true,
        guasto: true,
        marcia: false,
        mancanzaRete: true,
        comandiRemoti: false,
      },
      simboloCodice: 'DM83-CENTRALE',
    };
    onAggiornaProgetto(
      (p) => ({ ...p, linee: [...p.linee, nuova] }),
      {
        sezione: 'Linee Quadro',
        campo: 'Aggiunta linea',
        prevVal: '—',
        newVal: `${nuova.sigla} (${nuova.descrizione})`,
      }
    );
    setNodoAttivo({ tipo: 'linee', lineaId: nuova.id });
  };

  const eliminaLinea = (id: string) => {
    const target = progetto.linee.find((l) => l.id === id);
    if (!target || progetto.linee.length <= 1) return;
    onAggiornaProgetto(
      (p) => ({ ...p, linee: p.linee.filter((l) => l.id !== id) }),
      {
        sezione: 'Linee Quadro',
        campo: 'Rimozione linea',
        prevVal: target.sigla,
        newVal: 'Eliminata',
      }
    );
    setNodoAttivo({ tipo: 'linee', lineaId: progetto.linee[0]?.id });
  };

  const duplicaLinea = (id: string) => {
    const target = progetto.linee.find((l) => l.id === id);
    if (!target) return;

    const sigleEsistenti = new Set(
      progetto.linee.map((l) => l.sigla.trim().toUpperCase())
    );
    const match = target.sigla.trim().match(/^(.*?)(\d+)$/);
    let nuovaSigla = `${target.sigla.trim()}-2`;
    if (match) {
      const prefisso = match[1];
      const numStr = match[2];
      let num = parseInt(numStr, 10) + 1;
      while (
        sigleEsistenti.has(
          `${prefisso}${String(num).padStart(numStr.length, '0')}`.toUpperCase()
        )
      ) {
        num += 1;
      }
      nuovaSigla = `${prefisso}${String(num).padStart(numStr.length, '0')}`;
    } else {
      let suff = 2;
      while (sigleEsistenti.has(`${target.sigla.trim()}-${suff}`.toUpperCase())) {
        suff += 1;
      }
      nuovaSigla = `${target.sigla.trim()}-${suff}`;
    }

    const duplicata: LineaUtenza = {
      ...target,
      id: `ln-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      sigla: nuovaSigla,
      descrizione: `${target.descrizione} (Copia)`,
      segnali: { ...target.segnali },
    };

    onAggiornaProgetto(
      (p) => {
        const idx = p.linee.findIndex((l) => l.id === id);
        if (idx === -1) return { ...p, linee: [...p.linee, duplicata] };
        const nextLinee = [...p.linee];
        nextLinee.splice(idx + 1, 0, duplicata);
        return { ...p, linee: nextLinee };
      },
      {
        sezione: 'Linee Quadro',
        campo: 'Duplicazione linea',
        prevVal: target.sigla,
        newVal: `${duplicata.sigla} (${duplicata.descrizione})`,
      }
    );
    setNodoAttivo({ tipo: 'linee', lineaId: duplicata.id });
  };

  const updateLinea = <K extends keyof LineaUtenza>(
    lineaId: string,
    campo: K,
    valore: LineaUtenza[K],
    etichetta?: string
  ) => {
    const corr = progetto.linee.find((l) => l.id === lineaId);
    onAggiornaProgetto(
      (p) => ({
        ...p,
        linee: p.linee.map((l) =>
          l.id === lineaId ? { ...l, [campo]: valore } : l
        ),
      }),
      etichetta && corr
        ? {
            sezione: `Linea ${corr.sigla}`,
            campo: etichetta,
            prevVal: String(corr[campo] ?? 'Auto'),
            newVal: String(valore ?? 'Auto'),
          }
        : undefined
    );
  };

  const aggiungiSistemaIrai = () => {
    const now = Date.now();
    const id = `irai-${now}`;
    const defaultZonaId = `z-${now}`;
    onAggiornaProgetto((p) => ({
      ...p,
      sistemiIrai: [
        ...p.sistemiIrai,
        {
          id,
          sigla: `IRAI-0${p.sistemiIrai.length + 1}`,
          nome: 'Nuova Centrale Rivelazione Incendi',
          lineaAlimentazioneId: p.linee[0]?.id ?? '',
          modelloCentrale: 'FC-IRAI-2L-EN54',
          tensioneSistemaV: 24,
          correnteCentraleQuieteMa: 250,
          correnteCentraleAllarmeMa: 550,
          correnteAlimentatoreMaxA: 5,
          autonomiaQuieteRichiestaOre: 24,
          autonomiaAllarmeRichiestaMin: 30,
          capacitaBatterieInstallataAh: 24,
          zone: [{ id: defaultZonaId, codice: 'Z01', nome: 'Zona Unica' }],
          loop: [
            {
              id: `lp-${now}`,
              sigla: 'LOOP 1',
              nome: 'Anello Principale',
              lunghezzaM: 350,
              sezioneCavoMm2: 1.5,
              resistenzaFuoco: 'PH30',
              tensioneNominaleV: 24,
              maxDispositiviConsentiti: 128,
              cadutaTensioneMaxV: 2,
              dispositivi: [
                {
                  id: `disp-${now}`,
                  indirizzo: 1,
                  sigla: 'R1.01',
                  tipo: 'rivelatore_ottico',
                  zonaId: defaultZonaId,
                  descrizione: 'Rivelatore ottico locale',
                  correnteQuieteMa: 0.35,
                  correnteAllarmeMa: 5.5,
                  simboloCodice: 'DM83-RIVELATORE',
                },
              ],
            },
          ],
          causaEffetto: [],
          anagraficaComponenti: ANAGRAFICA_COMPONENTI_IRAI_DEFAULT,
        },
      ],
    }));
    setNodoAttivo({ tipo: 'irai', sistemaId: id });
  };

  const aggiungiSistemaEvac = () => {
    const id = `evac-${Date.now()}`;
    onAggiornaProgetto((p) => ({
      ...p,
      sistemiEvac: [
        ...p.sistemiEvac,
        {
          id,
          sigla: `EVAC-0${p.sistemiEvac.length + 1}`,
          nome: 'Nuovo Sistema EVAC EN 54-16',
          lineaAlimentazioneId: p.linee[0]?.id ?? '',
          modelloCentrale: 'EVAC-COMPACT',
          ridondanzaAmplificatoriN1: true,
          marginePotenzaRichiestoPct: 20,
          autonomiaQuieteRichiestaOre: 24,
          autonomiaAllarmeRichiestaMin: 30,
          correnteQuieteA: 1.0,
          correnteAllarmeA: 12.0,
          capacitaBatterieInstallataAh: 45,
          interfacciaIraiCollegata: true,
          cavoInterfacciaResistenteFuoco: 'PH120',
          separazioneCircuitiPotenza: true,
          amplificatori: [
            { id: `amp-${Date.now()}`, sigla: 'AMP-1', modello: '500W', potenzaNominaleW: 500, diRiserva: false },
            { id: `amp-r-${Date.now()}`, sigla: 'AMP-RIS', modello: '500W Riserva', potenzaNominaleW: 500, diRiserva: true },
          ],
          lineeAltoparlanti: [
            {
              id: `spk-${Date.now()}`,
              sigla: 'EV-Z1',
              zonaNome: 'Zona 1',
              topologia: 'anello',
              distribuzioneCarico: 'concentrato',
              tensioneLineaV: 100,
              numeroAltoparlanti: 12,
              potenzaTotaleAltoparlantiW: 120,
              lunghezzaM: 180,
              sezioneMm2: 1.5,
              resistenzaFuoco: 'PH30',
              cadutaTensioneMaxPct: 10,
              amplificatoreId: `amp-${Date.now()}`,
            },
          ],
        },
      ],
    }));
    setNodoAttivo({ tipo: 'evac', sistemaId: id });
  };

  const duplicaSistemaEvac = (sistemaId: string) => {
    const target = progetto.sistemiEvac.find((s) => s.id === sistemaId);
    if (!target) return;

    const sigleEsistenti = new Set(
      progetto.sistemiEvac.map((s) => s.sigla.trim().toUpperCase())
    );
    const match = target.sigla.trim().match(/^(.*?)(\d+)$/);
    let nuovaSigla = `${target.sigla.trim()}-2`;
    if (match) {
      const prefisso = match[1];
      const numStr = match[2];
      let num = parseInt(numStr, 10) + 1;
      while (
        sigleEsistenti.has(
          `${prefisso}${String(num).padStart(numStr.length, '0')}`.toUpperCase()
        )
      ) {
        num += 1;
      }
      nuovaSigla = `${prefisso}${String(num).padStart(numStr.length, '0')}`;
    } else {
      let suff = 2;
      while (sigleEsistenti.has(`${target.sigla.trim()}-${suff}`.toUpperCase())) {
        suff += 1;
      }
      nuovaSigla = `${target.sigla.trim()}-${suff}`;
    }

    const now = Date.now();
    const rand = Math.random().toString(36).slice(2, 5);
    const ampIdMap: Record<string, string> = {};
    const clonedAmplificatori = target.amplificatori.map((amp, idx) => {
      const newAmpId = `amp-${now}-${idx}-${rand}`;
      ampIdMap[amp.id] = newAmpId;
      return {
        ...amp,
        id: newAmpId,
      };
    });

    const clonedLineeAltoparlanti = target.lineeAltoparlanti.map((ln, idx) => ({
      ...ln,
      id: `spk-${now}-${idx}-${rand}`,
      amplificatoreId:
        ampIdMap[ln.amplificatoreId] ?? clonedAmplificatori[0]?.id ?? '',
    }));

    const duplicato: SistemaEVAC = {
      ...target,
      id: `evac-${now}-${rand}`,
      sigla: nuovaSigla,
      nome: `${target.nome} (Copia)`,
      amplificatori: clonedAmplificatori,
      lineeAltoparlanti: clonedLineeAltoparlanti,
    };

    onAggiornaProgetto(
      (p) => {
        const idx = p.sistemiEvac.findIndex((s) => s.id === sistemaId);
        if (idx === -1) {
          return { ...p, sistemiEvac: [...p.sistemiEvac, duplicato] };
        }
        const nextEvac = [...p.sistemiEvac];
        nextEvac.splice(idx + 1, 0, duplicato);
        return { ...p, sistemiEvac: nextEvac };
      },
      {
        sezione: 'Sistemi EVAC',
        campo: 'Duplicazione sistema EVAC',
        prevVal: `${target.sigla} (${target.nome})`,
        newVal: `${duplicato.sigla} (${duplicato.nome})`,
      }
    );
    setNodoAttivo({ tipo: 'evac', sistemaId: duplicato.id });
  };

  const sysIraiAttivo =
    nodoAttivo.tipo === 'irai'
      ? progetto.sistemiIrai.find((s) => s.id === nodoAttivo.sistemaId)
      : undefined;
  const sysEvacAttivo =
    nodoAttivo.tipo === 'evac'
      ? progetto.sistemiEvac.find((s) => s.id === nodoAttivo.sistemaId)
      : undefined;

  return (
    <div className="flex min-h-[calc(100vh-58px)] flex-col lg:flex-row">
      {/* Sidebar Sinistra: Albero Progetto (RF-02) */}
      <aside className="w-full shrink-0 border-b border-slate-200 bg-white lg:w-64 lg:border-r lg:border-b-0">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="font-mono text-xs font-semibold text-blue-700">
            {progetto.identificativi.commessa}
          </div>
          <div className="truncate text-sm font-semibold text-slate-900">
            {progetto.identificativi.cliente}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {progetto.identificativi.revisione} · LP {progetto.livelloPrestazione}
          </div>
        </div>

        <nav className="p-2.5 space-y-4 text-xs">
          <div>
            <div className="px-2 pb-1 text-[11px] font-semibold text-slate-500">
              Impostazioni Commessa
            </div>
            <button
              type="button"
              onClick={() => setNodoAttivo({ tipo: 'generali' })}
              className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left cursor-pointer ${
                nodoAttivo.tipo === 'generali'
                  ? 'bg-blue-50 font-semibold text-blue-800'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>Dati Generali & Fornitura</span>
              <ChevronRight className="h-3.5 w-3.5 opacity-60" />
            </button>
            <button
              type="button"
              onClick={() => setNodoAttivo({ tipo: 'sorgenti_quadri' })}
              className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left cursor-pointer ${
                nodoAttivo.tipo === 'sorgenti_quadri'
                  ? 'bg-blue-50 font-semibold text-blue-800'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>Sorgenti, UPS & Quadro</span>
              <ChevronRight className="h-3.5 w-3.5 opacity-60" />
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between px-2 pb-1">
              <span className="text-[11px] font-semibold text-slate-500">
                Linee Quadro ({progetto.linee.length})
              </span>
              <button
                type="button"
                onClick={aggiungiLinea}
                title="Aggiungi nuova linea"
                className="rounded p-0.5 text-blue-700 hover:bg-blue-50 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-0.5">
              {progetto.linee.map((l) => {
                const active =
                  nodoAttivo.tipo === 'linee' && lineaSelezionataId === l.id;
                const hasErr = esiti.some(
                  (e) => e.targetId === l.id && e.stato === 'non_conforme'
                );
                return (
                  <div
                    key={l.id}
                    className={`group flex w-full items-center justify-between rounded px-2.5 py-1.5 ${
                      active
                        ? 'bg-blue-50 font-semibold text-blue-800'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setNodoAttivo({ tipo: 'linee', lineaId: l.id })}
                      className="flex-1 min-w-0 truncate text-left cursor-pointer"
                    >
                      <span className="font-mono mr-1.5">{l.sigla}</span>
                      {l.descrizione}
                    </button>
                    <div className="ml-1 flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicaLinea(l.id);
                        }}
                        title={`Duplica linea ${l.sigla}`}
                        className="rounded p-0.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-blue-100 hover:text-blue-700 cursor-pointer"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      {hasErr && (
                        <XCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between px-2 pb-1">
              <span className="text-[11px] font-semibold text-slate-500">
                Sistemi IRAI (EN 54)
              </span>
              <button
                type="button"
                onClick={aggiungiSistemaIrai}
                title="Aggiungi centrale IRAI"
                className="rounded p-0.5 text-blue-700 hover:bg-blue-50 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {progetto.sistemiIrai.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setNodoAttivo({ tipo: 'irai', sistemaId: s.id })}
                className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left cursor-pointer ${
                  nodoAttivo.tipo === 'irai' && nodoAttivo.sistemaId === s.id
                    ? 'bg-blue-50 font-semibold text-blue-800'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="truncate">
                  <span className="font-mono mr-1.5">{s.sigla}</span>
                  {s.loop.length} loop · {s.capacitaBatterieInstallataAh}Ah
                </span>
              </button>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between px-2 pb-1">
              <span className="text-[11px] font-semibold text-slate-500">
                Sistemi EVAC (EN 54-16)
              </span>
              <button
                type="button"
                onClick={aggiungiSistemaEvac}
                title="Aggiungi sistema EVAC"
                className="rounded p-0.5 text-blue-700 hover:bg-blue-50 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {progetto.sistemiEvac.length === 0 ? (
              <div className="px-2.5 py-1 text-[11px] text-slate-400">
                Nessun sistema EVAC presente
              </div>
            ) : (
              progetto.sistemiEvac.map((s) => (
                <div
                  key={s.id}
                  className={`group flex w-full items-center justify-between rounded px-2.5 py-1.5 ${
                    nodoAttivo.tipo === 'evac' && nodoAttivo.sistemaId === s.id
                      ? 'bg-blue-50 font-semibold text-blue-800'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setNodoAttivo({ tipo: 'evac', sistemaId: s.id })}
                    className="flex-1 min-w-0 truncate text-left cursor-pointer"
                  >
                    <span className="font-mono mr-1.5">{s.sigla}</span>
                    {s.lineeAltoparlanti.length} zone 100V
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicaSistemaEvac(s.id);
                    }}
                    title={`Duplica sistema EVAC ${s.sigla}`}
                    className="ml-1 shrink-0 rounded p-0.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-blue-100 hover:text-blue-700 cursor-pointer"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </nav>
      </aside>

      {/* Area Centrale: Editor Dati + Anteprima Unifilare Real-Time */}
      <main className="flex-1 overflow-y-auto bg-slate-50 p-4 lg:p-5 space-y-4">
        {/* Toolbar Contestuale Workspace */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded bg-slate-100 p-0.5 text-xs">
              {(
                [
                  ['divisa', 'Dati + Schema Live'],
                  ['dati', 'Solo Dati'],
                  ['schema', 'Solo Schema CAD'],
                ] as const
              ).map(([v, lbl]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVistaLayout(v)}
                  className={`rounded px-2.5 py-1 font-medium cursor-pointer ${
                    vistaLayout === v
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {nodoAttivo.tipo === 'linee' && (
              <div className="flex items-center gap-1 rounded bg-slate-100 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setModalitaInserimento('guidata')}
                  className={`rounded px-2.5 py-1 font-medium cursor-pointer ${
                    modalitaInserimento === 'guidata'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  Flusso Guidato
                </button>
                <button
                  type="button"
                  onClick={() => setModalitaInserimento('avanzata')}
                  className={`rounded px-2.5 py-1 font-medium cursor-pointer ${
                    modalitaInserimento === 'avanzata'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  Tabella Avanzata
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => onVaiARegole('regole')}
              className="inline-flex items-center gap-1.5 font-medium text-slate-700 hover:text-blue-700 cursor-pointer"
            >
              {nonConformiTot === 0 && mancantiTot === 0 ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                  <span>Tutte le verifiche conformi</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span>
                    {nonConformiTot} non conformi · {mancantiTot} dati mancanti
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIspettoreAperto((o) => !o)}
              className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {ispettoreAperto ? (
                <>
                  <PanelRightClose className="h-3.5 w-3.5" />
                  Chiudi Ispettore
                </>
              ) : (
                <>
                  <PanelRightOpen className="h-3.5 w-3.5" />
                  Verifiche & Formule
                </>
              )}
            </button>
          </div>
        </div>

        {/* Pannello Editor Dati */}
        {vistaLayout !== 'schema' && (
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            {nodoAttivo.tipo === 'generali' && (
              <div className="space-y-5">
                <h2 className="text-base font-semibold text-slate-900">
                  Dati Generali di Progetto, Fornitura e Condizioni Ambientali
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                  <label className="block">
                    <span className="font-medium text-slate-700">Cliente / Committente</span>
                    <input
                      type="text"
                      value={progetto.identificativi.cliente}
                      onChange={(e) =>
                        onAggiornaProgetto(
                          (p) => ({
                            ...p,
                            identificativi: { ...p.identificativi, cliente: e.target.value },
                          }),
                          {
                            sezione: 'Dati Generali',
                            campo: 'Cliente',
                            prevVal: progetto.identificativi.cliente,
                            newVal: e.target.value,
                          }
                        )
                      }
                      className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-slate-900"
                    />
                  </label>
                  <label className="block">
                    <span className="font-medium text-slate-700">Numero Commessa</span>
                    <input
                      type="text"
                      value={progetto.identificativi.commessa}
                      onChange={(e) =>
                        onAggiornaProgetto((p) => ({
                          ...p,
                          identificativi: { ...p.identificativi, commessa: e.target.value },
                        }))
                      }
                      className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono text-slate-900"
                    />
                  </label>
                  <label className="block">
                    <span className="font-medium text-slate-700">Sito di Installazione</span>
                    <input
                      type="text"
                      value={progetto.identificativi.sito}
                      onChange={(e) =>
                        onAggiornaProgetto((p) => ({
                          ...p,
                          identificativi: { ...p.identificativi, sito: e.target.value },
                        }))
                      }
                      className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-slate-900"
                    />
                  </label>
                  <label className="block">
                    <span className="font-medium text-slate-700">Progettista Abilitato</span>
                    <input
                      type="text"
                      value={progetto.identificativi.progettista}
                      onChange={(e) =>
                        onAggiornaProgetto((p) => ({
                          ...p,
                          identificativi: { ...p.identificativi, progettista: e.target.value },
                        }))
                      }
                      className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-slate-900"
                    />
                  </label>
                  <label className="block">
                    <span className="font-medium text-slate-700">Titolo Tavola (Cartiglio)</span>
                    <input
                      type="text"
                      value={progetto.identificativi.titoloTavola}
                      onChange={(e) =>
                        onAggiornaProgetto((p) => ({
                          ...p,
                          identificativi: { ...p.identificativi, titoloTavola: e.target.value },
                        }))
                      }
                      className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-slate-900"
                    />
                  </label>
                  <label className="block">
                    <span className="font-medium text-slate-700">Attività & Livello Prestazione</span>
                    <div className="mt-1 flex gap-2">
                      <input
                        type="text"
                        value={progetto.attivitaNome}
                        onChange={(e) =>
                          onAggiornaProgetto((p) => ({ ...p, attivitaNome: e.target.value }))
                        }
                        className="flex-1 rounded border border-slate-300 px-2.5 py-1.5 text-slate-900"
                      />
                      <select
                        value={progetto.livelloPrestazione}
                        onChange={(e) =>
                          onAggiornaProgetto(
                            (p) => ({
                              ...p,
                              livelloPrestazione: e.target.value as LivelloPrestazione,
                            }),
                            {
                              sezione: 'Dati Generali',
                              campo: 'Livello Prestazione',
                              prevVal: progetto.livelloPrestazione,
                              newVal: e.target.value,
                            }
                          )
                        }
                        className="rounded border border-slate-300 px-2 py-1.5 font-mono text-slate-900"
                      >
                        <option value="L1">L1</option>
                        <option value="L2">L2</option>
                        <option value="L3">L3</option>
                        <option value="L4">L4</option>
                        <option value="non_definito">Non def.</option>
                      </select>
                    </div>
                  </label>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">
                    Parametri Elettrici di Fornitura & Ambiente
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                    <label className="block">
                      <span className="font-medium text-slate-700">Sistema Distribuzione</span>
                      <select
                        value={progetto.fornitura.sistemaDistribuzione}
                        onChange={(e) =>
                          onAggiornaProgetto(
                            (p) => ({
                              ...p,
                              fornitura: {
                                ...p.fornitura,
                                sistemaDistribuzione: e.target.value as SistemaDistribuzione,
                              },
                            }),
                            {
                              sezione: 'Fornitura',
                              campo: 'Sistema',
                              prevVal: progetto.fornitura.sistemaDistribuzione,
                              newVal: e.target.value,
                            }
                          )
                        }
                        className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono text-slate-900"
                      >
                        <option value="TN-S">TN-S</option>
                        <option value="TT">TT</option>
                        <option value="TN-C">TN-C</option>
                        <option value="IT">IT</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="font-medium text-slate-700">Icc Presunta Consegna (kA)</span>
                      <input
                        type="number"
                        step="0.5"
                        value={progetto.fornitura.iccPuntoConsegnaKa ?? ''}
                        placeholder="Dato obbligatorio"
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : Number(e.target.value);
                          onAggiornaProgetto(
                            (p) => ({
                              ...p,
                              fornitura: { ...p.fornitura, iccPuntoConsegnaKa: val },
                            }),
                            {
                              sezione: 'Fornitura',
                              campo: 'Icc consegna (kA)',
                              prevVal: String(progetto.fornitura.iccPuntoConsegnaKa ?? 'N.D.'),
                              newVal: String(val ?? 'N.D.'),
                            }
                          );
                        }}
                        className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono text-slate-900"
                      />
                    </label>
                    <label className="block">
                      <span className="font-medium text-slate-700">
                        {progetto.fornitura.sistemaDistribuzione === 'TT'
                          ? 'Resistenza Terra Re (Ω)'
                          : 'Impedenza Anello Zs (Ω)'}
                      </span>
                      <input
                        type="number"
                        step="0.05"
                        value={
                          progetto.fornitura.sistemaDistribuzione === 'TT'
                            ? progetto.fornitura.resistenzaTerraReOhm ?? ''
                            : progetto.fornitura.impedenzaAnelloGuastoOhm ?? ''
                        }
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : Number(e.target.value);
                          onAggiornaProgetto((p) => ({
                            ...p,
                            fornitura:
                              p.fornitura.sistemaDistribuzione === 'TT'
                                ? { ...p.fornitura, resistenzaTerraReOhm: val }
                                : { ...p.fornitura, impedenzaAnelloGuastoOhm: val },
                          }));
                        }}
                        className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono text-slate-900"
                      />
                    </label>
                    <label className="block">
                      <span className="font-medium text-slate-700">Grado IP Richiesto & Ma.R.C.I.</span>
                      <div className="mt-1 flex items-center gap-2">
                        <select
                          value={progetto.ambiente.gradoIPRichiesto}
                          onChange={(e) =>
                            onAggiornaProgetto((p) => ({
                              ...p,
                              ambiente: {
                                ...p.ambiente,
                                gradoIPRichiesto: e.target.value as ProgettoAntincendio['ambiente']['gradoIPRichiesto'],
                              },
                            }))
                          }
                          className="rounded border border-slate-300 px-2 py-1.5 font-mono text-slate-900"
                        >
                          <option value="IP2X">IP2X</option>
                          <option value="IP4X">IP4X</option>
                          <option value="IP54">IP54</option>
                          <option value="IP55">IP55</option>
                          <option value="IP65">IP65</option>
                        </select>
                        <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={progetto.ambiente.ambienteMarci}
                            onChange={(e) =>
                              onAggiornaProgetto((p) => ({
                                ...p,
                                ambiente: { ...p.ambiente, ambienteMarci: e.target.checked },
                              }))
                            }
                          />
                          Ma.R.C.I.
                        </label>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {nodoAttivo.tipo === 'sorgenti_quadri' && quadroPrincipale && (
              <div className="space-y-5">
                <h2 className="text-base font-semibold text-slate-900">
                  Quadro Elettrico Principale & Alimentazione di Sicurezza
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                  <label className="block">
                    <span className="font-medium text-slate-700">Sigla Quadro</span>
                    <input
                      type="text"
                      value={quadroPrincipale.sigla}
                      onChange={(e) =>
                        onAggiornaProgetto((p) => ({
                          ...p,
                          quadri: p.quadri.map((q) =>
                            q.id === quadroPrincipale.id ? { ...q, sigla: e.target.value } : q
                          ),
                        }))
                      }
                      className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono text-slate-900"
                    />
                  </label>
                  <label className="block">
                    <span className="font-medium text-slate-700">Denominazione Quadro</span>
                    <input
                      type="text"
                      value={quadroPrincipale.nome}
                      onChange={(e) =>
                        onAggiornaProgetto((p) => ({
                          ...p,
                          quadri: p.quadri.map((q) =>
                            q.id === quadroPrincipale.id ? { ...q, nome: e.target.value } : q
                          ),
                        }))
                      }
                      className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-slate-900"
                    />
                  </label>
                  <label className="block">
                    <span className="font-medium text-slate-700">Grado IP Quadro / Segregazione</span>
                    <div className="mt-1 flex gap-2">
                      <select
                        value={quadroPrincipale.gradoIP}
                        onChange={(e) =>
                          onAggiornaProgetto((p) => ({
                            ...p,
                            quadri: p.quadri.map((q) =>
                              q.id === quadroPrincipale.id
                                ? { ...q, gradoIP: e.target.value as typeof q.gradoIP }
                                : q
                            ),
                          }))
                        }
                        className="rounded border border-slate-300 px-2 py-1.5 font-mono text-slate-900"
                      >
                        <option value="IP2X">IP2X</option>
                        <option value="IP4X">IP4X</option>
                        <option value="IP54">IP54</option>
                        <option value="IP55">IP55</option>
                        <option value="IP65">IP65</option>
                      </select>
                      <select
                        value={quadroPrincipale.formaSegregazione}
                        onChange={(e) =>
                          onAggiornaProgetto((p) => ({
                            ...p,
                            quadri: p.quadri.map((q) =>
                              q.id === quadroPrincipale.id
                                ? {
                                    ...q,
                                    formaSegregazione: e.target.value as typeof q.formaSegregazione,
                                  }
                                : q
                            ),
                          }))
                        }
                        className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-slate-900"
                      >
                        <option value="Forma 1">Forma 1</option>
                        <option value="Forma 2a">Forma 2a</option>
                        <option value="Forma 2b">Forma 2b</option>
                        <option value="Forma 3b">Forma 3b</option>
                        <option value="Forma 4">Forma 4</option>
                      </select>
                    </div>
                  </label>
                  <label className="block">
                    <span className="font-medium text-slate-700">Interruttore Generale In (A)</span>
                    <input
                      type="number"
                      value={quadroPrincipale.interruttoreGeneraleInA}
                      onChange={(e) =>
                        onAggiornaProgetto((p) => ({
                          ...p,
                          quadri: p.quadri.map((q) =>
                            q.id === quadroPrincipale.id
                              ? { ...q, interruttoreGeneraleInA: Number(e.target.value) || 40 }
                              : q
                          ),
                        }))
                      }
                      className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono text-slate-900"
                    />
                  </label>
                  <label className="block">
                    <span className="font-medium text-slate-700">Icu Generale (kA)</span>
                    <input
                      type="number"
                      value={quadroPrincipale.interruttoreGeneraleIcuKa}
                      onChange={(e) =>
                        onAggiornaProgetto((p) => ({
                          ...p,
                          quadri: p.quadri.map((q) =>
                            q.id === quadroPrincipale.id
                              ? { ...q, interruttoreGeneraleIcuKa: Number(e.target.value) || 10 }
                              : q
                          ),
                        }))
                      }
                      className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono text-slate-900"
                    />
                  </label>
                  <div className="flex flex-col justify-end gap-2">
                    <label className="inline-flex items-center gap-2 text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={quadroPrincipale.alimentazionePreferenzialeAMonte}
                        onChange={(e) =>
                          onAggiornaProgetto(
                            (p) => ({
                              ...p,
                              quadri: p.quadri.map((q) =>
                                q.id === quadroPrincipale.id
                                  ? { ...q, alimentazionePreferenzialeAMonte: e.target.checked }
                                  : q
                              ),
                            }),
                            {
                              sezione: 'Quadro',
                              campo: 'Derivazione a monte I.G.',
                              prevVal: String(quadroPrincipale.alimentazionePreferenzialeAMonte),
                              newVal: String(e.target.checked),
                            }
                          )
                        }
                      />
                      <span>Derivato a monte I.G. edificio (CEI 64-8 Cap. 56)</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={quadroPrincipale.interruttoreGeneraleSelettivo}
                        onChange={(e) =>
                          onAggiornaProgetto((p) => ({
                            ...p,
                            quadri: p.quadri.map((q) =>
                              q.id === quadroPrincipale.id
                                ? { ...q, interruttoreGeneraleSelettivo: e.target.checked }
                                : q
                            ),
                          }))
                        }
                      />
                      <span>Interruttore generale selettivo</span>
                    </label>
                  </div>
                </div>

                <div className="rounded border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-950 font-mono">
                  Riepilogo quadro {quadroPrincipale.sigla}: Potenza installata{' '}
                  {calcolo.quadri[quadroPrincipale.id]?.potenzaInstallataTotaleKw ?? 0} kW ·
                  Contemporanea {calcolo.quadri[quadroPrincipale.id]?.potenzaContemporaneaKw ?? 0}{' '}
                  kW · Taglia UPS sicurezza consigliata: {calcolo.upsKvaConsigliato} kVA
                </div>
              </div>
            )}

            {nodoAttivo.tipo === 'linee' && modalitaInserimento === 'guidata' && lineaAttiva && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-slate-900">
                    Configurazione Guidata Linea {lineaAttiva.sigla} — {lineaAttiva.descrizione}
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => duplicaLinea(lineaAttiva.id)}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                    >
                      <Copy className="h-3.5 w-3.5 text-blue-700" />
                      Duplica Linea
                    </button>
                    {progetto.linee.length > 1 && (
                      <button
                        type="button"
                        onClick={() => eliminaLinea(lineaAttiva.id)}
                        className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 cursor-pointer whitespace-nowrap"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Elimina Linea
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                  <label className="block">
                    <span className="font-medium text-slate-700">Sigla</span>
                    <input
                      type="text"
                      value={lineaAttiva.sigla}
                      onChange={(e) =>
                        updateLinea(lineaAttiva.id, 'sigla', e.target.value, 'Sigla')
                      }
                      className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono text-slate-900"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="font-medium text-slate-700">Descrizione Utenza</span>
                    <input
                      type="text"
                      value={lineaAttiva.descrizione}
                      onChange={(e) =>
                        updateLinea(lineaAttiva.id, 'descrizione', e.target.value, 'Descrizione')
                      }
                      className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-slate-900"
                    />
                  </label>
                  <label className="block">
                    <span className="font-medium text-slate-700">Tipo Utenza</span>
                    <select
                      value={lineaAttiva.tipoUtenza}
                      onChange={(e) =>
                        updateLinea(lineaAttiva.id, 'tipoUtenza', e.target.value as TipoUtenza, 'Tipo Utenza')
                      }
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-slate-900"
                    >
                      <option value="centrale_irai">Centrale IRAI</option>
                      <option value="alimentatore_irai">Alimentatore IRAI</option>
                      <option value="centrale_evac">Centrale EVAC</option>
                      <option value="amplificatore_evac">Amplificatore EVAC</option>
                      <option value="ups_sicurezza">UPS Sicurezza</option>
                      <option value="commutazione_sicurezza">Commutazione</option>
                      <option value="illuminazione_emergenza">Illuminazione Emergenza</option>
                      <option value="altro">Altro carico antincendio</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="font-medium text-slate-700">Potenza Nominale (W)</span>
                    <input
                      type="number"
                      min={10}
                      step={50}
                      value={lineaAttiva.potenzaNominaleW}
                      onChange={(e) =>
                        updateLinea(
                          lineaAttiva.id,
                          'potenzaNominaleW',
                          Number(e.target.value) || 0,
                          'Potenza (W)'
                        )
                      }
                      className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono text-slate-900"
                    />
                  </label>
                  <label className="block">
                    <span className="font-medium text-slate-700">Tensione (V) & Fasi</span>
                    <div className="mt-1 flex gap-1.5">
                      <select
                        value={lineaAttiva.tipoFornitura}
                        onChange={(e) => {
                          const tf = e.target.value as 'monofase' | 'trifase';
                          updateLinea(lineaAttiva.id, 'tipoFornitura', tf, 'Fasi');
                          updateLinea(lineaAttiva.id, 'tensioneV', tf === 'trifase' ? 400 : 230);
                        }}
                        className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-slate-900"
                      >
                        <option value="monofase">230V 1F</option>
                        <option value="trifase">400V 3F</option>
                      </select>
                    </div>
                  </label>
                  <label className="block">
                    <span className="font-medium text-slate-700">cos φ / Rendimento η</span>
                    <div className="mt-1 flex gap-1.5">
                      <input
                        type="number"
                        step="0.05"
                        min="0.5"
                        max="1"
                        value={lineaAttiva.cosPhi}
                        onChange={(e) =>
                          updateLinea(lineaAttiva.id, 'cosPhi', Number(e.target.value) || 0.9)
                        }
                        className="w-1/2 rounded border border-slate-300 px-2 py-1.5 font-mono text-slate-900"
                      />
                      <input
                        type="number"
                        step="0.05"
                        min="0.4"
                        max="1"
                        value={lineaAttiva.rendimento}
                        onChange={(e) =>
                          updateLinea(lineaAttiva.id, 'rendimento', Number(e.target.value) || 0.9)
                        }
                        className="w-1/2 rounded border border-slate-300 px-2 py-1.5 font-mono text-slate-900"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="font-medium text-slate-700">Lunghezza Linea (m)</span>
                    <input
                      type="number"
                      min={1}
                      value={lineaAttiva.lunghezzaM}
                      onChange={(e) =>
                        updateLinea(
                          lineaAttiva.id,
                          'lunghezzaM',
                          Number(e.target.value) || 1,
                          'Lunghezza (m)'
                        )
                      }
                      className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono text-slate-900"
                    />
                  </label>

                  <label className="block">
                    <span className="font-medium text-slate-700">Tipo di Posa & Raggrupp.</span>
                    <div className="mt-1 flex gap-1.5">
                      <select
                        value={lineaAttiva.tipoPosa}
                        onChange={(e) =>
                          updateLinea(lineaAttiva.id, 'tipoPosa', e.target.value as TipoPosa)
                        }
                        className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-slate-900"
                      >
                        <option value="canale_passerella">Passerella / Canale</option>
                        <option value="tubo_a_vista">Tubo a vista</option>
                        <option value="tubo_incassato">Tubo incassato</option>
                        <option value="aria_libera">Aria libera</option>
                        <option value="interrato">Interrato</option>
                      </select>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={lineaAttiva.circuitiRaggruppati}
                        title="Numero circuiti raggruppati"
                        onChange={(e) =>
                          updateLinea(
                            lineaAttiva.id,
                            'circuitiRaggruppati',
                            Number(e.target.value) || 1
                          )
                        }
                        className="w-14 rounded border border-slate-300 px-2 py-1.5 font-mono text-slate-900"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="font-medium text-slate-700">Resistenza al Fuoco Cavo</span>
                    <div className="mt-1 flex gap-1.5">
                      <select
                        value={lineaAttiva.resistenzaFuocoCavoScelto}
                        onChange={(e) =>
                          updateLinea(
                            lineaAttiva.id,
                            'resistenzaFuocoCavoScelto',
                            e.target.value as ResistenzaFuocoCavo,
                            'Resistenza fuoco cavo'
                          )
                        }
                        className="w-1/2 rounded border border-slate-300 px-2 py-1.5 font-mono text-slate-900"
                      >
                        <option value="PH120">PH120</option>
                        <option value="PH90">PH90</option>
                        <option value="PH60">PH60</option>
                        <option value="PH30">PH30</option>
                        <option value="nessuna">Nessuna</option>
                      </select>
                      <select
                        value={lineaAttiva.classeCPR}
                        onChange={(e) =>
                          updateLinea(lineaAttiva.id, 'classeCPR', e.target.value as ClasseCPR)
                        }
                        className="w-1/2 rounded border border-slate-300 px-1.5 py-1.5 font-mono text-slate-900"
                      >
                        <option value="B2ca-s1a,d1,a1">CPR B2ca</option>
                        <option value="Cca-s1b,d1,a1">CPR Cca</option>
                        <option value="Dca-s2,d2,a2">CPR Dca</option>
                        <option value="Eca">CPR Eca</option>
                      </select>
                    </div>
                  </label>
                  <label className="block">
                    <span className="font-medium text-slate-700">Protezione & Calibro</span>
                    <div className="mt-1 flex gap-1.5">
                      <select
                        value={lineaAttiva.tipoProtezione}
                        onChange={(e) =>
                          updateLinea(
                            lineaAttiva.id,
                            'tipoProtezione',
                            e.target.value as TipoProtezione
                          )
                        }
                        className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-slate-900"
                      >
                        <option value="magnetotermico_differenziale">MTD</option>
                        <option value="magnetotermico">MT</option>
                        <option value="fusibile">Fusibile</option>
                        <option value="sezionatore">Sezionatore</option>
                      </select>
                      <select
                        value={lineaAttiva.curvaProtezione}
                        onChange={(e) =>
                          updateLinea(
                            lineaAttiva.id,
                            'curvaProtezione',
                            e.target.value as CurvaIntervento
                          )
                        }
                        className="w-14 rounded border border-slate-300 px-1.5 py-1.5 font-mono text-slate-900"
                      >
                        <option value="C">C</option>
                        <option value="B">B</option>
                        <option value="D">D</option>
                        <option value="gG">gG</option>
                      </select>
                    </div>
                  </label>
                  <label className="block">
                    <span className="font-medium text-slate-700">Sezione Manuale / In (A)</span>
                    <div className="mt-1 flex gap-1.5">
                      <select
                        value={lineaAttiva.sezioneManualeMm2 ?? ''}
                        onChange={(e) =>
                          updateLinea(
                            lineaAttiva.id,
                            'sezioneManualeMm2',
                            e.target.value === '' ? null : Number(e.target.value),
                            'Sezione mm²'
                          )
                        }
                        className="w-1/2 rounded border border-slate-300 px-1.5 py-1.5 font-mono text-slate-900"
                      >
                        <option value="">Auto</option>
                        {[1.5, 2.5, 4, 6, 10, 16, 25, 35, 50].map((s) => (
                          <option key={s} value={s}>
                            {s} mm²
                          </option>
                        ))}
                      </select>
                      <select
                        value={lineaAttiva.protezioneInManualeA ?? ''}
                        onChange={(e) =>
                          updateLinea(
                            lineaAttiva.id,
                            'protezioneInManualeA',
                            e.target.value === '' ? null : Number(e.target.value),
                            'Calibro In (A)'
                          )
                        }
                        className="w-1/2 rounded border border-slate-300 px-1.5 py-1.5 font-mono text-slate-900"
                      >
                        <option value="">Auto</option>
                        {[6, 10, 16, 20, 25, 32, 40, 50, 63].map((inVal) => (
                          <option key={inVal} value={inVal}>
                            {inVal} A
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-5 border-t border-slate-100 pt-3 text-xs text-slate-700">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lineaAttiva.percorsoProtetto}
                      onChange={(e) =>
                        updateLinea(lineaAttiva.id, 'percorsoProtetto', e.target.checked)
                      }
                    />
                    Percorso protetto (CEI 64-8 Art. 560.7)
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lineaAttiva.separataDaAltriImpianti}
                      onChange={(e) =>
                        updateLinea(
                          lineaAttiva.id,
                          'separataDaAltriImpianti',
                          e.target.checked
                        )
                      }
                    />
                    Separata da circuiti ordinari
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <span>Avviamento:</span>
                    <select
                      value={lineaAttiva.tipoAvviamento}
                      onChange={(e) =>
                        updateLinea(
                          lineaAttiva.id,
                          'tipoAvviamento',
                          e.target.value as TipoAvviamento
                        )
                      }
                      className="rounded border border-slate-300 px-2 py-0.5 text-xs"
                    >
                      <option value="statico">Statico / Elettronico</option>
                      <option value="diretto">Diretto (DOL)</option>
                      <option value="stella_triangolo">Stella-Triangolo</option>
                      <option value="soft_starter">Soft Starter</option>
                      <option value="inverter">Inverter</option>
                    </select>
                  </label>
                </div>
              </div>
            )}

            {nodoAttivo.tipo === 'linee' && modalitaInserimento === 'avanzata' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900">
                    Tabella Avanzata Linee Quadro (Editing Rapido)
                  </h2>
                  <button
                    type="button"
                    onClick={aggiungiLinea}
                    className="inline-flex items-center gap-1 rounded bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nuova Linea
                  </button>
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                      <tr>
                        <th className="px-2.5 py-2">Sigla</th>
                        <th className="px-2.5 py-2">Descrizione</th>
                        <th className="px-2.5 py-2">P (W)</th>
                        <th className="px-2.5 py-2">L (m)</th>
                        <th className="px-2.5 py-2">Cavo PH</th>
                        <th className="px-2.5 py-2">Ib (A)</th>
                        <th className="px-2.5 py-2">Protezione</th>
                        <th className="px-2.5 py-2">Sez. mm²</th>
                        <th className="px-2.5 py-2">ΔV (%)</th>
                        <th className="px-2.5 py-2 text-right">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {progetto.linee.map((l) => {
                        const r = calcolo.linee[l.id];
                        return (
                          <tr
                            key={l.id}
                            onClick={() => setNodoAttivo({ tipo: 'linee', lineaId: l.id })}
                            className="hover:bg-slate-50 cursor-pointer"
                          >
                            <td className="px-2.5 py-1.5 font-mono font-semibold">{l.sigla}</td>
                            <td className="px-2.5 py-1.5">
                              <input
                                type="text"
                                value={l.descrizione}
                                onChange={(e) => updateLinea(l.id, 'descrizione', e.target.value)}
                                className="w-44 rounded border border-slate-200 px-1.5 py-0.5 text-xs"
                              />
                            </td>
                            <td className="px-2.5 py-1.5">
                              <input
                                type="number"
                                value={l.potenzaNominaleW}
                                onChange={(e) =>
                                  updateLinea(l.id, 'potenzaNominaleW', Number(e.target.value) || 0)
                                }
                                className="w-20 rounded border border-slate-200 px-1.5 py-0.5 font-mono text-xs"
                              />
                            </td>
                            <td className="px-2.5 py-1.5">
                              <input
                                type="number"
                                value={l.lunghezzaM}
                                onChange={(e) =>
                                  updateLinea(l.id, 'lunghezzaM', Number(e.target.value) || 1)
                                }
                                className="w-16 rounded border border-slate-200 px-1.5 py-0.5 font-mono text-xs"
                              />
                            </td>
                            <td className="px-2.5 py-1.5 font-mono">{l.resistenzaFuocoCavoScelto}</td>
                            <td className="px-2.5 py-1.5 font-mono">{r?.correnteImpiegoIbA}</td>
                            <td className="px-2.5 py-1.5 font-mono">{r?.protezioneSceltaInA}A {l.curvaProtezione}</td>
                            <td className="px-2.5 py-1.5 font-mono">{r?.sezioneSceltaMm2}</td>
                            <td className="px-2.5 py-1.5 font-mono">{r?.cadutaTensionePct}%</td>
                            <td className="px-2.5 py-1.5 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    duplicaLinea(l.id);
                                  }}
                                  title={`Duplica linea ${l.sigla}`}
                                  className="rounded p-1 text-slate-500 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                                {progetto.linee.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      eliminaLinea(l.id);
                                    }}
                                    title={`Elimina linea ${l.sigla}`}
                                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {nodoAttivo.tipo === 'irai' && sysIraiAttivo && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex-1 min-w-[280px] space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={sysIraiAttivo.sigla}
                        aria-label="Sigla sistema IRAI"
                        onChange={(e) =>
                          onAggiornaProgetto((p) => ({
                            ...p,
                            sistemiIrai: p.sistemiIrai.map((sys) =>
                              sys.id === sysIraiAttivo.id ? { ...sys, sigla: e.target.value } : sys
                            ),
                          }))
                        }
                        className="w-28 rounded border border-slate-300 px-2 py-1 font-mono text-sm font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={sysIraiAttivo.nome}
                        aria-label="Nome sistema centrale IRAI"
                        onChange={(e) =>
                          onAggiornaProgetto((p) => ({
                            ...p,
                            sistemiIrai: p.sistemiIrai.map((sys) =>
                              sys.id === sysIraiAttivo.id ? { ...sys, nome: e.target.value } : sys
                            ),
                          }))
                        }
                        className="flex-1 min-w-[220px] rounded border border-slate-300 px-2.5 py-1 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-mono">
                      <span>Modello centrale:</span>
                      <input
                        type="text"
                        value={sysIraiAttivo.modelloCentrale}
                        aria-label="Modello centrale IRAI"
                        onChange={(e) =>
                          onAggiornaProgetto((p) => ({
                            ...p,
                            sistemiIrai: p.sistemiIrai.map((sys) =>
                              sys.id === sysIraiAttivo.id
                                ? { ...sys, modelloCentrale: e.target.value }
                                : sys
                            ),
                          }))
                        }
                        className="w-40 rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                      />
                      <span>
                        · {sysIraiAttivo.tensioneSistemaV}V CC · Autonomia:{' '}
                        {sysIraiAttivo.autonomiaQuieteRichiestaOre}h +{' '}
                        {sysIraiAttivo.autonomiaAllarmeRichiestaMin}min
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          esportaPdfRiepilogoSistemaIrai(
                            progetto,
                            sysIraiAttivo,
                            calcolo.irai[sysIraiAttivo.id],
                            calcolo,
                            esiti
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                      >
                        <Printer className="h-3.5 w-3.5 text-blue-700" />
                        Export PDF Sistema
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          esportaExcelRiepilogoSistemaIrai(
                            progetto,
                            sysIraiAttivo,
                            calcolo.irai[sysIraiAttivo.id],
                            esiti
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
                        Export Excel Sistema
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1 rounded bg-slate-100 p-1 text-xs">
                      {(
                        [
                          ['zone', `Anagrafica Zone (${sysIraiAttivo.zone.length})`],
                          [
                            'anagrafica',
                            `Anagrafica Componenti (${(sysIraiAttivo.anagraficaComponenti ?? ANAGRAFICA_COMPONENTI_IRAI_DEFAULT).length})`,
                          ],
                          ['loop', `Loop & Dispositivi (${sysIraiAttivo.loop.length})`],
                          ['causa_effetto', `Matrice Causa-Effetto (${sysIraiAttivo.causaEffetto.length})`],
                          ['batterie', 'Alimentatore & Batterie'],
                        ] as const
                      ).map(([id, lbl]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setIraiSubTab(id)}
                          className={`rounded px-2.5 py-1 font-medium cursor-pointer ${
                            iraiSubTab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {iraiSubTab === 'zone' && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-slate-50 p-2.5 text-xs">
                      <span className="font-semibold text-slate-800">Nuova Zona:</span>
                      <input
                        type="text"
                        value={nuovaZonaCodice}
                        onChange={(e) => setNuovaZonaCodice(e.target.value)}
                        placeholder={`Es. Z0${sysIraiAttivo.zone.length + 1}`}
                        className="w-24 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900"
                      />
                      <input
                        type="text"
                        value={nuovaZonaNome}
                        onChange={(e) => setNuovaZonaNome(e.target.value)}
                        placeholder="Denominazione zona (es. Piano Secondo - Direzione)"
                        className="flex-1 min-w-[220px] rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const nextIdx = sysIraiAttivo.zone.length + 1;
                          const codice =
                            nuovaZonaCodice.trim() ||
                            `Z${String(nextIdx).padStart(2, '0')}`;
                          const nome =
                            nuovaZonaNome.trim() || `Zona Rivelazione ${nextIdx}`;
                          const nuovaZona: ZonaIRAI = {
                            id: `z-${Date.now()}`,
                            codice,
                            nome,
                          };
                          onAggiornaProgetto(
                            (p) => ({
                              ...p,
                              sistemiIrai: p.sistemiIrai.map((sys) =>
                                sys.id === sysIraiAttivo.id
                                  ? { ...sys, zone: [...sys.zone, nuovaZona] }
                                  : sys
                              ),
                            }),
                            {
                              sezione: `${sysIraiAttivo.sigla} · Zone`,
                              campo: 'Aggiunta zona',
                              prevVal: '—',
                              newVal: `${nuovaZona.codice} - ${nuovaZona.nome}`,
                            }
                          );
                          setNuovaZonaCodice('');
                          setNuovaZonaNome('');
                        }}
                        className="inline-flex items-center gap-1 rounded bg-blue-700 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Aggiungi Zona
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                          <tr>
                            <th className="px-3 py-2">Codice Zona</th>
                            <th className="px-3 py-2">Denominazione Zona</th>
                            <th className="px-3 py-2">Dispositivi Assegnati</th>
                            <th className="px-3 py-2">Coperta in Causa-Effetto</th>
                            <th className="px-3 py-2 text-right">Azioni</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {sysIraiAttivo.zone.map((z) => {
                            const nDisp = sysIraiAttivo.loop.reduce(
                              (acc, l) =>
                                acc +
                                l.dispositivi
                                  .filter((d) => d.zonaId === z.id)
                                  .reduce((s, d) => s + Math.max(1, d.quantita ?? 1), 0),
                              0
                            );
                            const coperta = sysIraiAttivo.causaEffetto.some(
                              (ce) => ce.causaZonaId === z.id
                            );
                            return (
                              <tr key={z.id} className="hover:bg-slate-50">
                                <td className="px-3 py-2">
                                  <input
                                    type="text"
                                    value={z.codice}
                                    onChange={(e) =>
                                      onAggiornaProgetto((p) => ({
                                        ...p,
                                        sistemiIrai: p.sistemiIrai.map((sys) =>
                                          sys.id === sysIraiAttivo.id
                                            ? {
                                                ...sys,
                                                zone: sys.zone.map((zn) =>
                                                  zn.id === z.id
                                                    ? { ...zn, codice: e.target.value }
                                                    : zn
                                                ),
                                              }
                                            : sys
                                        ),
                                      }))
                                    }
                                    className="w-24 rounded border border-slate-200 px-2 py-1 font-mono font-semibold text-slate-900"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="text"
                                    value={z.nome}
                                    onChange={(e) =>
                                      onAggiornaProgetto((p) => ({
                                        ...p,
                                        sistemiIrai: p.sistemiIrai.map((sys) =>
                                          sys.id === sysIraiAttivo.id
                                            ? {
                                                ...sys,
                                                zone: sys.zone.map((zn) =>
                                                  zn.id === z.id
                                                    ? { ...zn, nome: e.target.value }
                                                    : zn
                                                ),
                                              }
                                            : sys
                                        ),
                                      }))
                                    }
                                    className="w-full min-w-[220px] rounded border border-slate-200 px-2 py-1 text-slate-900"
                                  />
                                </td>
                                <td className="px-3 py-2 font-mono text-slate-700 tabular-nums">
                                  {nDisp}
                                </td>
                                <td className="px-3 py-2">
                                  {coperta ? (
                                    <span className="font-medium text-emerald-700">Sì</span>
                                  ) : (
                                    <span className="font-medium text-amber-700">Mancante</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {sysIraiAttivo.zone.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const fallbackZona =
                                          sysIraiAttivo.zone.find((zn) => zn.id !== z.id)?.id ??
                                          '';
                                        onAggiornaProgetto(
                                          (p) => ({
                                            ...p,
                                            sistemiIrai: p.sistemiIrai.map((sys) =>
                                              sys.id === sysIraiAttivo.id
                                                ? {
                                                    ...sys,
                                                    zone: sys.zone.filter((zn) => zn.id !== z.id),
                                                    loop: sys.loop.map((lp) => ({
                                                      ...lp,
                                                      dispositivi: lp.dispositivi.map((d) =>
                                                        d.zonaId === z.id
                                                          ? { ...d, zonaId: fallbackZona }
                                                          : d
                                                      ),
                                                    })),
                                                    causaEffetto: sys.causaEffetto.filter(
                                                      (ce) => ce.causaZonaId !== z.id
                                                    ),
                                                  }
                                                : sys
                                            ),
                                          }),
                                          {
                                            sezione: `${sysIraiAttivo.sigla} · Zone`,
                                            campo: 'Eliminazione zona',
                                            prevVal: `${z.codice} - ${z.nome}`,
                                            newVal: 'Eliminata',
                                          }
                                        );
                                      }}
                                      title="Elimina zona"
                                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {iraiSubTab === 'anagrafica' && (() => {
                  const anagraficaLista =
                    sysIraiAttivo.anagraficaComponenti ?? ANAGRAFICA_COMPONENTI_IRAI_DEFAULT;

                  const aggiornaAnagrafica = (
                    updater: (curr: ComponenteAnagraficaIRAI[]) => ComponenteAnagraficaIRAI[],
                    audit?: { campo: string; prevVal: string; newVal: string }
                  ) => {
                    onAggiornaProgetto(
                      (p) => ({
                        ...p,
                        sistemiIrai: p.sistemiIrai.map((sys) => {
                          if (sys.id !== sysIraiAttivo.id) return sys;
                          const curr =
                            sys.anagraficaComponenti ?? ANAGRAFICA_COMPONENTI_IRAI_DEFAULT;
                          return { ...sys, anagraficaComponenti: updater(curr) };
                        }),
                      }),
                      audit
                        ? {
                            sezione: `${sysIraiAttivo.sigla} · Anagrafica Componenti`,
                            ...audit,
                          }
                        : undefined
                    );
                  };

                  // Aggregazione quantità installate sui loop per distinta riepilogativa
                  const mappaDistinta = new Map<
                    string,
                    {
                      chiave: string;
                      simboloCodice: string;
                      codice: string;
                      modello: string;
                      costruttore: string;
                      tipo: DispositivoIRAI['tipo'];
                      descrizione: string;
                      quantitaTot: number;
                      iqTotMa: number;
                      iaTotMa: number;
                      loops: Set<string>;
                      zone: Set<string>;
                    }
                  >();

                  sysIraiAttivo.loop.forEach((lp) => {
                    lp.dispositivi.forEach((d) => {
                      const qta = Math.max(1, d.quantita ?? 1);
                      const rifAnag = anagraficaLista.find(
                        (a) =>
                          a.id === d.anagraficaComponenteId ||
                          (d.codiceArticolo && a.codice === d.codiceArticolo)
                      );
                      const codice = d.codiceArticolo || rifAnag?.codice || d.tipo.toUpperCase();
                      const modello =
                        d.modello || rifAnag?.modello || PRESET_DISPOSITIVI_IRAI[d.tipo].label;
                      const costruttore = d.costruttore || rifAnag?.costruttore || 'Standard EN 54';
                      const key = `${codice}::${modello}::${d.tipo}`;
                      const zCod =
                        sysIraiAttivo.zone.find((z) => z.id === d.zonaId)?.codice ?? '—';
                      const existing = mappaDistinta.get(key);
                      if (existing) {
                        existing.quantitaTot += qta;
                        existing.iqTotMa += d.correnteQuieteMa * qta;
                        existing.iaTotMa += d.correnteAllarmeMa * qta;
                        existing.loops.add(lp.sigla);
                        existing.zone.add(zCod);
                      } else {
                        mappaDistinta.set(key, {
                          chiave: key,
                          simboloCodice: d.simboloCodice,
                          codice,
                          modello,
                          costruttore,
                          tipo: d.tipo,
                          descrizione: rifAnag?.descrizione || d.descrizione,
                          quantitaTot: qta,
                          iqTotMa: d.correnteQuieteMa * qta,
                          iaTotMa: d.correnteAllarmeMa * qta,
                          loops: new Set([lp.sigla]),
                          zone: new Set([zCod]),
                        });
                      }
                    });
                  });

                  const distintaInstallati = Array.from(mappaDistinta.values());
                  const totPzDistinta = distintaInstallati.reduce(
                    (s, r) => s + r.quantitaTot,
                    0
                  );
                  const totIqDistinta = distintaInstallati.reduce(
                    (s, r) => s + r.iqTotMa,
                    0
                  );
                  const totIaDistinta = distintaInstallati.reduce(
                    (s, r) => s + r.iaTotMa,
                    0
                  );

                  return (
                    <div className="space-y-4">
                      {/* Form inserimento nuovo componente in anagrafica */}
                      <div className="rounded border border-slate-200 bg-slate-50 p-3 space-y-2.5 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900">
                            Nuovo Componente in Anagrafica ({sysIraiAttivo.sigla})
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              aggiornaAnagrafica(
                                (curr) => {
                                  const existingIds = new Set(curr.map((c) => c.id));
                                  const mancanti = ANAGRAFICA_COMPONENTI_IRAI_DEFAULT.filter(
                                    (def) => !existingIds.has(def.id)
                                  );
                                  return mancanti.length > 0 ? [...curr, ...mancanti] : curr;
                                },
                                {
                                  campo: 'Ripristino catalogo EN 54',
                                  prevVal: `${anagraficaLista.length} voci`,
                                  newVal: 'Integrato catalogo predefinito EN 54',
                                }
                              )
                            }
                            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            Integra Catalogo EN 54 Predefinito
                          </button>
                        </div>
                        <div className="grid gap-2 md:grid-cols-6">
                          <input
                            type="text"
                            value={nuovoCompCodice}
                            onChange={(e) => setNuovoCompCodice(e.target.value)}
                            placeholder="Codice (es. IRAI-OTT-220)"
                            className="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900"
                          />
                          <input
                            type="text"
                            value={nuovoCompCostruttore}
                            onChange={(e) => setNuovoCompCostruttore(e.target.value)}
                            placeholder="Costruttore"
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
                          />
                          <input
                            type="text"
                            value={nuovoCompModello}
                            onChange={(e) => setNuovoCompModello(e.target.value)}
                            placeholder="Modello (es. NFXI-OPT)"
                            className="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900"
                          />
                          <select
                            value={nuovoCompTipo}
                            onChange={(e) => {
                              const t = e.target.value as DispositivoIRAI['tipo'];
                              const p = PRESET_DISPOSITIVI_IRAI[t];
                              setNuovoCompTipo(t);
                              setNuovoCompIq(p.iqMa);
                              setNuovoCompIa(p.iaMa);
                            }}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
                          >
                            <option value="rivelatore_ottico">Rivelatore ottico</option>
                            <option value="rivelatore_termico">Rivelatore termico</option>
                            <option value="pulsante_manuale">Pulsante manuale</option>
                            <option value="targa_ottico_acustica">Targa ottico-acustica</option>
                            <option value="modulo_uscita">Modulo di uscita</option>
                            <option value="modulo_ingresso">Modulo di ingresso</option>
                          </select>
                          <input
                            type="text"
                            value={nuovoCompNorma}
                            onChange={(e) => setNuovoCompNorma(e.target.value)}
                            placeholder="Norma (es. EN 54-7)"
                            className="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900"
                          />
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              step={0.05}
                              min={0}
                              value={nuovoCompIq}
                              onChange={(e) => setNuovoCompIq(Number(e.target.value) || 0)}
                              title="Corrente Quiete (mA)"
                              placeholder="Iq mA"
                              className="w-1/2 rounded border border-slate-300 bg-white px-1.5 py-1 font-mono text-xs text-slate-900"
                            />
                            <input
                              type="number"
                              step={0.1}
                              min={0}
                              value={nuovoCompIa}
                              onChange={(e) => setNuovoCompIa(Number(e.target.value) || 0)}
                              title="Corrente Allarme (mA)"
                              placeholder="Ia mA"
                              className="w-1/2 rounded border border-slate-300 bg-white px-1.5 py-1 font-mono text-xs text-slate-900"
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={nuovoCompDescrizione}
                            onChange={(e) => setNuovoCompDescrizione(e.target.value)}
                            placeholder="Descrizione tecnica componente (es. Rivelatore ottico di fumo con isolatore integrato)"
                            className="flex-1 min-w-[240px] rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const preset = PRESET_DISPOSITIVI_IRAI[nuovoCompTipo];
                              const nextIdx = anagraficaLista.length + 1;
                              const nuovo: ComponenteAnagraficaIRAI = {
                                id: `irai-anag-${Date.now()}`,
                                codice:
                                  nuovoCompCodice.trim() ||
                                  `IRAI-${preset.prefisso}-${String(nextIdx).padStart(3, '0')}`,
                                costruttore: nuovoCompCostruttore.trim() || 'Costruttore EN 54',
                                modello:
                                  nuovoCompModello.trim() || `${preset.prefisso}-STD-${nextIdx}`,
                                tipo: nuovoCompTipo,
                                descrizione:
                                  nuovoCompDescrizione.trim() || preset.descrizioneDefault,
                                correnteQuieteMa: Math.max(0, nuovoCompIq),
                                correnteAllarmeMa: Math.max(0, nuovoCompIa),
                                normaRiferimento: nuovoCompNorma.trim() || 'EN 54',
                                simboloCodice: preset.simbolo,
                              };
                              aggiornaAnagrafica(
                                (curr) => [...curr, nuovo],
                                {
                                  campo: 'Aggiunta componente in anagrafica',
                                  prevVal: `${anagraficaLista.length} componenti`,
                                  newVal: `${nuovo.codice} (${nuovo.modello})`,
                                }
                              );
                              setNuovoCompCodice('');
                              setNuovoCompModello('');
                              setNuovoCompDescrizione('');
                            }}
                            className="inline-flex items-center gap-1 rounded bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Aggiungi a Anagrafica
                          </button>
                        </div>
                      </div>

                      {/* Tabella 1: Anagrafica Articoli e Modelli IRAI */}
                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-slate-800">
                          Catalogo Anagrafica Componenti di Sistema ({anagraficaLista.length} articoli)
                        </div>
                        <div className="overflow-x-auto rounded border border-slate-200">
                          <table className="w-full text-left text-xs">
                            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                              <tr>
                                <th className="px-2.5 py-2">Simb.</th>
                                <th className="px-2.5 py-2">Codice</th>
                                <th className="px-2.5 py-2">Costruttore</th>
                                <th className="px-2.5 py-2">Modello</th>
                                <th className="px-2.5 py-2">Tipologia</th>
                                <th className="px-2.5 py-2">Norma</th>
                                <th className="px-2.5 py-2">Iq (mA)</th>
                                <th className="px-2.5 py-2">Ia (mA)</th>
                                <th className="px-2.5 py-2">Descrizione</th>
                                <th className="px-2.5 py-2">Q.tà Loop</th>
                                <th className="px-2.5 py-2 text-right">Azioni</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {anagraficaLista.map((item) => {
                                const qtaSuLoop = sysIraiAttivo.loop.reduce(
                                  (acc, l) =>
                                    acc +
                                    l.dispositivi
                                      .filter(
                                        (d) =>
                                          d.anagraficaComponenteId === item.id ||
                                          d.codiceArticolo === item.codice
                                      )
                                      .reduce((s, d) => s + Math.max(1, d.quantita ?? 1), 0),
                                  0
                                );
                                return (
                                  <tr key={item.id} className="hover:bg-slate-50">
                                    <td className="px-2.5 py-1.5">
                                      <SymbolSvg codice={item.simboloCodice} size={22} />
                                    </td>
                                    <td className="px-2.5 py-1.5">
                                      <input
                                        type="text"
                                        value={item.codice}
                                        onChange={(e) =>
                                          aggiornaAnagrafica((curr) =>
                                            curr.map((c) =>
                                              c.id === item.id
                                                ? { ...c, codice: e.target.value }
                                                : c
                                            )
                                          )
                                        }
                                        className="w-28 rounded border border-slate-200 px-1.5 py-0.5 font-mono font-semibold text-slate-900"
                                      />
                                    </td>
                                    <td className="px-2.5 py-1.5">
                                      <input
                                        type="text"
                                        value={item.costruttore}
                                        onChange={(e) =>
                                          aggiornaAnagrafica((curr) =>
                                            curr.map((c) =>
                                              c.id === item.id
                                                ? { ...c, costruttore: e.target.value }
                                                : c
                                            )
                                          )
                                        }
                                        className="w-28 rounded border border-slate-200 px-1.5 py-0.5 text-slate-800"
                                      />
                                    </td>
                                    <td className="px-2.5 py-1.5">
                                      <input
                                        type="text"
                                        value={item.modello}
                                        onChange={(e) =>
                                          aggiornaAnagrafica((curr) =>
                                            curr.map((c) =>
                                              c.id === item.id
                                                ? { ...c, modello: e.target.value }
                                                : c
                                            )
                                          )
                                        }
                                        className="w-28 rounded border border-slate-200 px-1.5 py-0.5 font-mono text-slate-900"
                                      />
                                    </td>
                                    <td className="px-2.5 py-1.5">
                                      <select
                                        value={item.tipo}
                                        onChange={(e) => {
                                          const t = e.target.value as DispositivoIRAI['tipo'];
                                          const preset = PRESET_DISPOSITIVI_IRAI[t];
                                          aggiornaAnagrafica((curr) =>
                                            curr.map((c) =>
                                              c.id === item.id
                                                ? { ...c, tipo: t, simboloCodice: preset.simbolo }
                                                : c
                                            )
                                          );
                                        }}
                                        className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-slate-800"
                                      >
                                        <option value="rivelatore_ottico">Rivelatore ottico</option>
                                        <option value="rivelatore_termico">Rivelatore termico</option>
                                        <option value="pulsante_manuale">Pulsante manuale</option>
                                        <option value="targa_ottico_acustica">Targa ottico-acustica</option>
                                        <option value="modulo_uscita">Modulo uscita</option>
                                        <option value="modulo_ingresso">Modulo ingresso</option>
                                      </select>
                                    </td>
                                    <td className="px-2.5 py-1.5">
                                      <input
                                        type="text"
                                        value={item.normaRiferimento}
                                        onChange={(e) =>
                                          aggiornaAnagrafica((curr) =>
                                            curr.map((c) =>
                                              c.id === item.id
                                                ? { ...c, normaRiferimento: e.target.value }
                                                : c
                                            )
                                          )
                                        }
                                        className="w-24 rounded border border-slate-200 px-1.5 py-0.5 font-mono text-slate-700"
                                      />
                                    </td>
                                    <td className="px-2.5 py-1.5">
                                      <input
                                        type="number"
                                        step={0.05}
                                        min={0}
                                        value={item.correnteQuieteMa}
                                        onChange={(e) =>
                                          aggiornaAnagrafica((curr) =>
                                            curr.map((c) =>
                                              c.id === item.id
                                                ? {
                                                    ...c,
                                                    correnteQuieteMa:
                                                      Number(e.target.value) || 0,
                                                  }
                                                : c
                                            )
                                          )
                                        }
                                        className="w-14 rounded border border-slate-200 px-1 py-0.5 font-mono text-slate-900"
                                      />
                                    </td>
                                    <td className="px-2.5 py-1.5">
                                      <input
                                        type="number"
                                        step={0.1}
                                        min={0}
                                        value={item.correnteAllarmeMa}
                                        onChange={(e) =>
                                          aggiornaAnagrafica((curr) =>
                                            curr.map((c) =>
                                              c.id === item.id
                                                ? {
                                                    ...c,
                                                    correnteAllarmeMa:
                                                      Number(e.target.value) || 0,
                                                  }
                                                : c
                                            )
                                          )
                                        }
                                        className="w-14 rounded border border-slate-200 px-1 py-0.5 font-mono text-slate-900"
                                      />
                                    </td>
                                    <td className="px-2.5 py-1.5">
                                      <input
                                        type="text"
                                        value={item.descrizione}
                                        onChange={(e) =>
                                          aggiornaAnagrafica((curr) =>
                                            curr.map((c) =>
                                              c.id === item.id
                                                ? { ...c, descrizione: e.target.value }
                                                : c
                                            )
                                          )
                                        }
                                        className="w-48 rounded border border-slate-200 px-1.5 py-0.5 text-slate-900"
                                      />
                                    </td>
                                    <td className="px-2.5 py-1.5 font-mono font-semibold text-blue-800 tabular-nums">
                                      {qtaSuLoop} pz
                                    </td>
                                    <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                                      {qtaSuLoop > 0 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            onAggiornaProgetto(
                                              (p) => ({
                                                ...p,
                                                sistemiIrai: p.sistemiIrai.map((sys) =>
                                                  sys.id === sysIraiAttivo.id
                                                    ? {
                                                        ...sys,
                                                        loop: sys.loop.map((l) => ({
                                                          ...l,
                                                          dispositivi: l.dispositivi.map((d) =>
                                                            d.anagraficaComponenteId === item.id ||
                                                            d.codiceArticolo === item.codice
                                                              ? {
                                                                  ...d,
                                                                  tipo: item.tipo,
                                                                  codiceArticolo: item.codice,
                                                                  costruttore: item.costruttore,
                                                                  modello: item.modello,
                                                                  correnteQuieteMa:
                                                                    item.correnteQuieteMa,
                                                                  correnteAllarmeMa:
                                                                    item.correnteAllarmeMa,
                                                                  simboloCodice: item.simboloCodice,
                                                                }
                                                              : d
                                                          ),
                                                        })),
                                                      }
                                                    : sys
                                                ),
                                              }),
                                              {
                                                sezione: `${sysIraiAttivo.sigla} · Anagrafica`,
                                                campo: 'Sincronizzazione su loop',
                                                prevVal: item.codice,
                                                newVal: `Aggiornati dati tecnici (${qtaSuLoop} pz)`,
                                              }
                                            )
                                          }
                                          title="Applica assorbimenti e modello ai dispositivi associati sui loop"
                                          className="mr-1 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800 hover:bg-blue-100 cursor-pointer"
                                        >
                                          Sincronizza
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          aggiornaAnagrafica(
                                            (curr) => curr.filter((c) => c.id !== item.id),
                                            {
                                              campo: 'Rimozione da anagrafica',
                                              prevVal: `${item.codice} (${item.modello})`,
                                              newVal: 'Eliminato',
                                            }
                                          )
                                        }
                                        title="Elimina componente dall'anagrafica"
                                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Tabella 2: Riepilogo Distinta Componenti Installati sui Loop */}
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-slate-800">
                            Distinta Riepilogativa Componenti Installati sui Loop ({totPzDistinta} dispositivi totali)
                          </span>
                          <span className="font-mono text-slate-600">
                            Iq campo: {totIqDistinta.toFixed(2)} mA · Ia campo: {totIaDistinta.toFixed(1)} mA
                          </span>
                        </div>
                        <div className="overflow-x-auto rounded border border-slate-200">
                          <table className="w-full text-left text-xs">
                            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                              <tr>
                                <th className="px-2.5 py-2">Simb.</th>
                                <th className="px-2.5 py-2">Codice / Modello</th>
                                <th className="px-2.5 py-2">Tipologia</th>
                                <th className="px-2.5 py-2">Loop di impiego</th>
                                <th className="px-2.5 py-2">Zone</th>
                                <th className="px-2.5 py-2 text-right">Q.tà Totale</th>
                                <th className="px-2.5 py-2 text-right">Iq Tot (mA)</th>
                                <th className="px-2.5 py-2 text-right">Ia Tot (mA)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {distintaInstallati.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={8}
                                    className="px-3 py-4 text-center text-slate-500"
                                  >
                                    Nessun componente ancora installato sui loop di {sysIraiAttivo.sigla}.
                                  </td>
                                </tr>
                              ) : (
                                distintaInstallati.map((row) => (
                                  <tr key={row.chiave} className="hover:bg-slate-50">
                                    <td className="px-2.5 py-1.5">
                                      <SymbolSvg codice={row.simboloCodice} size={20} />
                                    </td>
                                    <td className="px-2.5 py-1.5">
                                      <div className="font-mono font-semibold text-slate-900">
                                        {row.codice} · {row.modello}
                                      </div>
                                      <div className="text-[11px] text-slate-500">
                                        {row.costruttore}
                                      </div>
                                    </td>
                                    <td className="px-2.5 py-1.5 text-slate-700">
                                      {PRESET_DISPOSITIVI_IRAI[row.tipo].label}
                                    </td>
                                    <td className="px-2.5 py-1.5 font-mono text-slate-700">
                                      {Array.from(row.loops).join(', ')}
                                    </td>
                                    <td className="px-2.5 py-1.5 font-mono text-slate-700">
                                      {Array.from(row.zone).join(', ')}
                                    </td>
                                    <td className="px-2.5 py-1.5 text-right font-mono font-semibold text-blue-800">
                                      {row.quantitaTot} pz
                                    </td>
                                    <td className="px-2.5 py-1.5 text-right font-mono text-slate-800">
                                      {row.iqTotMa.toFixed(2)}
                                    </td>
                                    <td className="px-2.5 py-1.5 text-right font-mono text-slate-800">
                                      {row.iaTotMa.toFixed(1)}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {iraiSubTab === 'loop' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                      <div className="text-xs text-slate-700">
                        <span className="font-semibold text-slate-900">
                          Loop configurati su {sysIraiAttivo.sigla}: {sysIraiAttivo.loop.length}
                        </span>
                        <span className="ml-2 text-slate-500">
                          Aggiungi nuovi anelli alla centrale e scegli i componenti per ciascun loop.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextNum = sysIraiAttivo.loop.length + 1;
                          const nuovoLoop: LoopIRAI = {
                            id: `loop-${Date.now()}`,
                            sigla: `LOOP ${nextNum}`,
                            nome: `Anello Zona ${nextNum}`,
                            lunghezzaM: 350,
                            sezioneCavoMm2: 1.5,
                            resistenzaFuoco: 'PH30',
                            tensioneNominaleV: 24,
                            maxDispositiviConsentiti: 128,
                            cadutaTensioneMaxV: 2,
                            dispositivi: [],
                          };
                          onAggiornaProgetto(
                            (p) => ({
                              ...p,
                              sistemiIrai: p.sistemiIrai.map((sys) =>
                                sys.id === sysIraiAttivo.id
                                  ? { ...sys, loop: [...sys.loop, nuovoLoop] }
                                  : sys
                              ),
                            }),
                            {
                              sezione: sysIraiAttivo.sigla,
                              campo: 'Aggiunta Loop',
                              prevVal: `${sysIraiAttivo.loop.length} loop`,
                              newVal: `${nuovoLoop.sigla} (${nuovoLoop.nome})`,
                            }
                          );
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Aggiungi Nuovo Loop
                      </button>
                    </div>

                    {sysIraiAttivo.loop.map((lp, lpIndex) => {
                      const anagraficaLista =
                        sysIraiAttivo.anagraficaComponenti ?? ANAGRAFICA_COMPONENTI_IRAI_DEFAULT;
                      const lpRes = calcolo.irai[sysIraiAttivo.id]?.loopRisultati.find(
                        (r) => r.loopId === lp.id
                      );
                      const anagraficaSelId = nuovoDispAnagraficaPerLoop[lp.id] ?? '';
                      const componenteAnagraficaSel = anagraficaLista.find(
                        (a) => a.id === anagraficaSelId
                      );
                      const tipoSelezionato: DispositivoIRAI['tipo'] =
                        componenteAnagraficaSel?.tipo ??
                        nuovoDispTipoPerLoop[lp.id] ??
                        'rivelatore_ottico';
                      const zonaSelezionata: string =
                        nuovoDispZonaPerLoop[lp.id] ??
                        sysIraiAttivo.zone[0]?.id ??
                        'z-1';
                      const quantitaNuovoDisp: number = Math.max(
                        1,
                        Math.min(
                          lp.maxDispositiviConsentiti,
                          Math.round(nuovoDispQuantitaPerLoop[lp.id] ?? 1)
                        )
                      );

                      const aggiungiComponenteAlLoop = () => {
                        const preset = PRESET_DISPOSITIVI_IRAI[tipoSelezionato];
                        const nextInd =
                          lp.dispositivi.reduce(
                            (m, d) => Math.max(m, d.indirizzo + Math.max(1, d.quantita ?? 1) - 1),
                            0
                          ) + 1;
                        const nuovoDisp: DispositivoIRAI = {
                          id: `disp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                          indirizzo: nextInd,
                          sigla: `${preset.prefisso}${lpIndex + 1}.${String(nextInd).padStart(2, '0')}`,
                          tipo: tipoSelezionato,
                          zonaId: zonaSelezionata,
                          descrizione:
                            componenteAnagraficaSel?.descrizione ?? preset.descrizioneDefault,
                          quantita: quantitaNuovoDisp,
                          anagraficaComponenteId: componenteAnagraficaSel?.id,
                          codiceArticolo: componenteAnagraficaSel?.codice,
                          costruttore: componenteAnagraficaSel?.costruttore,
                          modello: componenteAnagraficaSel?.modello,
                          correnteQuieteMa:
                            componenteAnagraficaSel?.correnteQuieteMa ?? preset.iqMa,
                          correnteAllarmeMa:
                            componenteAnagraficaSel?.correnteAllarmeMa ?? preset.iaMa,
                          simboloCodice:
                            componenteAnagraficaSel?.simboloCodice ?? preset.simbolo,
                        };
                        onAggiornaProgetto(
                          (p) => ({
                            ...p,
                            sistemiIrai: p.sistemiIrai.map((sys) =>
                              sys.id === sysIraiAttivo.id
                                ? {
                                    ...sys,
                                    loop: sys.loop.map((l) =>
                                      l.id === lp.id
                                        ? { ...l, dispositivi: [...l.dispositivi, nuovoDisp] }
                                        : l
                                    ),
                                  }
                                : sys
                            ),
                          }),
                          {
                            sezione: `${sysIraiAttivo.sigla} · ${lp.sigla}`,
                            campo: 'Aggiunta componente',
                            prevVal: '—',
                            newVal: `${nuovoDisp.sigla} ×${quantitaNuovoDisp} (${
                              componenteAnagraficaSel
                                ? `${componenteAnagraficaSel.codice} ${componenteAnagraficaSel.modello}`
                                : preset.label
                            })`,
                          }
                        );
                      };

                      return (
                        <div key={lp.id} className="rounded border border-slate-200 p-3.5 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-mono font-bold text-slate-900">
                                {lp.sigla}
                              </span>
                              <input
                                type="text"
                                value={lp.nome}
                                onChange={(e) =>
                                  onAggiornaProgetto((p) => ({
                                    ...p,
                                    sistemiIrai: p.sistemiIrai.map((sys) =>
                                      sys.id === sysIraiAttivo.id
                                        ? {
                                            ...sys,
                                            loop: sys.loop.map((l) =>
                                              l.id === lp.id ? { ...l, nome: e.target.value } : l
                                            ),
                                          }
                                        : sys
                                    ),
                                  }))
                                }
                                className="rounded border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-900"
                              />
                              <label className="inline-flex items-center gap-1 text-slate-600">
                                <span>L (m):</span>
                                <input
                                  type="number"
                                  min={10}
                                  max={2000}
                                  value={lp.lunghezzaM}
                                  onChange={(e) =>
                                    onAggiornaProgetto((p) => ({
                                      ...p,
                                      sistemiIrai: p.sistemiIrai.map((sys) =>
                                        sys.id === sysIraiAttivo.id
                                          ? {
                                              ...sys,
                                              loop: sys.loop.map((l) =>
                                                l.id === lp.id
                                                  ? { ...l, lunghezzaM: Number(e.target.value) || 100 }
                                                  : l
                                              ),
                                            }
                                          : sys
                                      ),
                                    }))
                                  }
                                  className="w-16 rounded border border-slate-200 px-1.5 py-0.5 font-mono text-xs text-slate-900"
                                />
                              </label>
                              <select
                                value={lp.sezioneCavoMm2}
                                onChange={(e) =>
                                  onAggiornaProgetto((p) => ({
                                    ...p,
                                    sistemiIrai: p.sistemiIrai.map((sys) =>
                                      sys.id === sysIraiAttivo.id
                                        ? {
                                            ...sys,
                                            loop: sys.loop.map((l) =>
                                              l.id === lp.id
                                                ? { ...l, sezioneCavoMm2: Number(e.target.value) || 1.5 }
                                                : l
                                            ),
                                          }
                                        : sys
                                    ),
                                  }))
                                }
                                className="rounded border border-slate-200 px-1.5 py-0.5 font-mono text-xs text-slate-900"
                              >
                                <option value={1.0}>1.0 mm²</option>
                                <option value={1.5}>1.5 mm²</option>
                                <option value={2.5}>2.5 mm²</option>
                              </select>
                              <span className="font-mono text-slate-500">{lp.resistenzaFuoco}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="font-mono text-xs text-blue-800 tabular-nums mr-1">
                                {lpRes?.numeroDispositivi ?? 0}/{lp.maxDispositiviConsentiti} disp · Iq={lpRes?.correnteQuieteMa} mA · Ia={lpRes?.correnteAllarmeMa} mA · ΔV={lpRes?.cadutaTensioneLoopV} V
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const existingSigle = new Set(
                                    sysIraiAttivo.loop.map((l) => l.sigla.toUpperCase())
                                  );
                                  let nextNum = sysIraiAttivo.loop.length + 1;
                                  let nextSigla = `LOOP ${nextNum}`;
                                  while (existingSigle.has(nextSigla.toUpperCase())) {
                                    nextNum += 1;
                                    nextSigla = `LOOP ${nextNum}`;
                                  }
                                  const now = Date.now();
                                  const oldLoopNumMatch = lp.sigla.match(/\d+/);
                                  const oldNumStr = oldLoopNumMatch ? oldLoopNumMatch[0] : null;

                                  const loopClonato: LoopIRAI = {
                                    ...lp,
                                    id: `loop-${now}`,
                                    sigla: nextSigla,
                                    nome: `${lp.nome} (copia)`,
                                    dispositivi: lp.dispositivi.map((d, dIdx) => {
                                      const updatedSigla =
                                        oldNumStr && d.sigla.includes(`${oldNumStr}.`)
                                          ? d.sigla.replace(`${oldNumStr}.`, `${nextNum}.`)
                                          : d.sigla;
                                      return {
                                        ...d,
                                        id: `disp-${now}-${dIdx}`,
                                        sigla: updatedSigla,
                                      };
                                    }),
                                  };

                                  onAggiornaProgetto(
                                    (p) => ({
                                      ...p,
                                      sistemiIrai: p.sistemiIrai.map((sys) => {
                                        if (sys.id !== sysIraiAttivo.id) return sys;
                                        const nextLoops = [...sys.loop];
                                        nextLoops.splice(lpIndex + 1, 0, loopClonato);
                                        return { ...sys, loop: nextLoops };
                                      }),
                                    }),
                                    {
                                      sezione: sysIraiAttivo.sigla,
                                      campo: 'Duplicazione Loop',
                                      prevVal: `${lp.sigla} (${lp.dispositivi.reduce((s, d) => s + Math.max(1, d.quantita ?? 1), 0)} disp)`,
                                      newVal: `${loopClonato.sigla} (${loopClonato.dispositivi.reduce((s, d) => s + Math.max(1, d.quantita ?? 1), 0)} disp)`,
                                    }
                                  );
                                }}
                                title="Duplica questo loop"
                                className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Duplica Loop
                              </button>
                              {sysIraiAttivo.loop.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onAggiornaProgetto(
                                      (p) => ({
                                        ...p,
                                        sistemiIrai: p.sistemiIrai.map((sys) =>
                                          sys.id === sysIraiAttivo.id
                                            ? {
                                                ...sys,
                                                loop: sys.loop.filter((l) => l.id !== lp.id),
                                              }
                                            : sys
                                        ),
                                      }),
                                      {
                                        sezione: sysIraiAttivo.sigla,
                                        campo: 'Rimozione Loop',
                                        prevVal: lp.sigla,
                                        newVal: 'Eliminato',
                                      }
                                    )
                                  }
                                  title="Elimina questo loop"
                                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            {lp.dispositivi.length === 0 ? (
                              <div className="rounded border border-dashed border-slate-200 bg-slate-50 py-4 text-center text-xs text-slate-500">
                                Nessun componente inserito su {lp.sigla}. Seleziona un componente qui sotto per aggiungerlo.
                              </div>
                            ) : (
                              <table className="w-full text-left text-xs">
                                <thead className="text-slate-500 border-b border-slate-100">
                                  <tr>
                                    <th className="py-1.5 pr-2">Ind.</th>
                                    <th className="py-1.5 pr-2">Simbolo</th>
                                    <th className="py-1.5 pr-2">Sigla</th>
                                    <th className="py-1.5 pr-2">Tipo Componente</th>
                                    <th className="py-1.5 pr-2">Zona</th>
                                    <th className="py-1.5 pr-2">Descrizione</th>
                                    <th className="py-1.5 pr-2">Q.tà</th>
                                    <th className="py-1.5 pr-2">Iq (mA)</th>
                                    <th className="py-1.5 pr-2">Ia (mA)</th>
                                    <th className="py-1.5 text-right">Azioni</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {lp.dispositivi.map((d) => {
                                    const qta = Math.max(1, d.quantita ?? 1);
                                    const indFine = d.indirizzo + qta - 1;
                                    return (
                                    <tr key={d.id} className="hover:bg-slate-50">
                                      <td className="py-1.5 pr-2 font-mono whitespace-nowrap">
                                        {qta > 1 ? `${d.indirizzo}÷${indFine}` : d.indirizzo}
                                      </td>
                                      <td className="py-1.5 pr-2">
                                        <SymbolSvg codice={d.simboloCodice} size={22} />
                                      </td>
                                      <td className="py-1.5 pr-2 font-mono font-semibold">{d.sigla}</td>
                                      <td className="py-1.5 pr-2">
                                        <select
                                          value={d.tipo}
                                          onChange={(e) => {
                                            const nuovoTipo = e.target.value as DispositivoIRAI['tipo'];
                                            const preset = PRESET_DISPOSITIVI_IRAI[nuovoTipo];
                                            onAggiornaProgetto((p) => ({
                                              ...p,
                                              sistemiIrai: p.sistemiIrai.map((sys) =>
                                                sys.id === sysIraiAttivo.id
                                                  ? {
                                                      ...sys,
                                                      loop: sys.loop.map((l) =>
                                                        l.id === lp.id
                                                          ? {
                                                              ...l,
                                                              dispositivi: l.dispositivi.map((dev) =>
                                                                dev.id === d.id
                                                                  ? {
                                                                      ...dev,
                                                                      tipo: nuovoTipo,
                                                                      correnteQuieteMa: preset.iqMa,
                                                                      correnteAllarmeMa: preset.iaMa,
                                                                      simboloCodice: preset.simbolo,
                                                                    }
                                                                  : dev
                                                              ),
                                                            }
                                                          : l
                                                      ),
                                                    }
                                                  : sys
                                              ),
                                            }));
                                          }}
                                          className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-800"
                                        >
                                          <option value="rivelatore_ottico">Rivelatore ottico</option>
                                          <option value="rivelatore_termico">Rivelatore termico</option>
                                          <option value="pulsante_manuale">Pulsante manuale</option>
                                          <option value="targa_ottico_acustica">Targa ottico-acustica</option>
                                          <option value="modulo_uscita">Modulo di uscita</option>
                                          <option value="modulo_ingresso">Modulo di ingresso</option>
                                        </select>
                                      </td>
                                      <td className="py-1.5 pr-2">
                                        <select
                                          value={d.zonaId}
                                          onChange={(e) =>
                                            onAggiornaProgetto((p) => ({
                                              ...p,
                                              sistemiIrai: p.sistemiIrai.map((sys) =>
                                                sys.id === sysIraiAttivo.id
                                                  ? {
                                                      ...sys,
                                                      loop: sys.loop.map((l) =>
                                                        l.id === lp.id
                                                          ? {
                                                              ...l,
                                                              dispositivi: l.dispositivi.map((dev) =>
                                                                dev.id === d.id
                                                                  ? { ...dev, zonaId: e.target.value }
                                                                  : dev
                                                              ),
                                                            }
                                                          : l
                                                      ),
                                                    }
                                                  : sys
                                              ),
                                            }))
                                          }
                                          className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-xs text-slate-800"
                                        >
                                          {sysIraiAttivo.zone.map((z) => (
                                            <option key={z.id} value={z.id}>
                                              {z.codice}
                                            </option>
                                          ))}
                                        </select>
                                      </td>
                                      <td className="py-1.5 pr-2">
                                        <input
                                          type="text"
                                          value={d.descrizione}
                                          onChange={(e) =>
                                            onAggiornaProgetto((p) => ({
                                              ...p,
                                              sistemiIrai: p.sistemiIrai.map((sys) =>
                                                sys.id === sysIraiAttivo.id
                                                  ? {
                                                      ...sys,
                                                      loop: sys.loop.map((l) =>
                                                        l.id === lp.id
                                                          ? {
                                                              ...l,
                                                              dispositivi: l.dispositivi.map((dev) =>
                                                                dev.id === d.id
                                                                  ? { ...dev, descrizione: e.target.value }
                                                                  : dev
                                                              ),
                                                            }
                                                          : l
                                                      ),
                                                    }
                                                  : sys
                                              ),
                                            }))
                                          }
                                          className="w-48 rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-900"
                                        />
                                        {(d.codiceArticolo || d.modello) && (
                                          <div className="mt-0.5 font-mono text-[10px] text-slate-500">
                                            {[d.codiceArticolo, d.modello].filter(Boolean).join(' · ')}
                                          </div>
                                        )}
                                      </td>
                                      <td className="py-1.5 pr-2">
                                        <input
                                          type="number"
                                          min={1}
                                          max={lp.maxDispositiviConsentiti}
                                          value={qta}
                                          onChange={(e) => {
                                            const val = Math.max(
                                              1,
                                              Math.min(
                                                lp.maxDispositiviConsentiti,
                                                Math.round(Number(e.target.value) || 1)
                                              )
                                            );
                                            onAggiornaProgetto((p) => ({
                                              ...p,
                                              sistemiIrai: p.sistemiIrai.map((sys) =>
                                                sys.id === sysIraiAttivo.id
                                                  ? {
                                                      ...sys,
                                                      loop: sys.loop.map((l) =>
                                                        l.id === lp.id
                                                          ? {
                                                              ...l,
                                                              dispositivi: l.dispositivi.map((dev) =>
                                                                dev.id === d.id
                                                                  ? { ...dev, quantita: val }
                                                                  : dev
                                                              ),
                                                            }
                                                          : l
                                                      ),
                                                    }
                                                  : sys
                                              ),
                                            }));
                                          }}
                                          className="w-14 rounded border border-slate-200 px-1.5 py-0.5 font-mono text-xs text-slate-900"
                                        />
                                      </td>
                                      <td className="py-1.5 pr-2 font-mono whitespace-nowrap">
                                        {qta > 1
                                          ? `${(d.correnteQuieteMa * qta).toFixed(2)} (${d.correnteQuieteMa})`
                                          : d.correnteQuieteMa}
                                      </td>
                                      <td className="py-1.5 pr-2 font-mono whitespace-nowrap">
                                        {qta > 1
                                          ? `${(d.correnteAllarmeMa * qta).toFixed(1)} (${d.correnteAllarmeMa})`
                                          : d.correnteAllarmeMa}
                                      </td>
                                      <td className="py-1.5 text-right">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            onAggiornaProgetto((p) => ({
                                              ...p,
                                              sistemiIrai: p.sistemiIrai.map((sys) =>
                                                sys.id === sysIraiAttivo.id
                                                  ? {
                                                      ...sys,
                                                      loop: sys.loop.map((l) =>
                                                        l.id === lp.id
                                                          ? {
                                                              ...l,
                                                              dispositivi: l.dispositivi.filter(
                                                                (dev) => dev.id !== d.id
                                                              ),
                                                            }
                                                          : l
                                                      ),
                                                    }
                                                  : sys
                                              ),
                                            }))
                                          }
                                          title="Rimuovi componente"
                                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>

                          {/* Barra di aggiunta componente con scelta da anagrafica/tipo, zona e quantità */}
                          <div className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                            <span className="font-medium text-slate-700">
                              Aggiungi componente:
                            </span>
                            <select
                              value={anagraficaSelId}
                              onChange={(e) => {
                                const idSel = e.target.value;
                                setNuovoDispAnagraficaPerLoop((prev) => ({
                                  ...prev,
                                  [lp.id]: idSel,
                                }));
                                const found = anagraficaLista.find((a) => a.id === idSel);
                                if (found) {
                                  setNuovoDispTipoPerLoop((prev) => ({
                                    ...prev,
                                    [lp.id]: found.tipo,
                                  }));
                                }
                              }}
                              className="max-w-[230px] rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
                            >
                              <option value="">-- Tipologia standard --</option>
                              {anagraficaLista.map((item) => (
                                <option key={item.id} value={item.id}>
                                  [{item.codice}] {item.modello} ({item.correnteQuieteMa}/{item.correnteAllarmeMa} mA)
                                </option>
                              ))}
                            </select>
                            {!anagraficaSelId && (
                              <select
                                value={tipoSelezionato}
                                onChange={(e) =>
                                  setNuovoDispTipoPerLoop((prev) => ({
                                    ...prev,
                                    [lp.id]: e.target.value as DispositivoIRAI['tipo'],
                                  }))
                                }
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
                              >
                                <option value="rivelatore_ottico">Rivelatore ottico (0.35 / 5.5 mA)</option>
                                <option value="rivelatore_termico">Rivelatore termico (0.35 / 5.5 mA)</option>
                                <option value="pulsante_manuale">Pulsante manuale (0.30 / 6.0 mA)</option>
                                <option value="targa_ottico_acustica">Targa ottico-acustica (0.80 / 45.0 mA)</option>
                                <option value="modulo_uscita">Modulo di uscita (0.50 / 12.0 mA)</option>
                                <option value="modulo_ingresso">Modulo di ingresso (0.40 / 5.0 mA)</option>
                              </select>
                            )}
                            <select
                              value={zonaSelezionata}
                              onChange={(e) =>
                                setNuovoDispZonaPerLoop((prev) => ({
                                  ...prev,
                                  [lp.id]: e.target.value,
                                }))
                              }
                              className="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900"
                            >
                              {sysIraiAttivo.zone.map((z) => (
                                <option key={z.id} value={z.id}>
                                  {z.codice} — {z.nome}
                                </option>
                              ))}
                            </select>
                            <label className="inline-flex items-center gap-1 text-slate-700">
                              <span>Q.tà:</span>
                              <input
                                type="number"
                                min={1}
                                max={lp.maxDispositiviConsentiti}
                                value={quantitaNuovoDisp}
                                onChange={(e) =>
                                  setNuovoDispQuantitaPerLoop((prev) => ({
                                    ...prev,
                                    [lp.id]: Math.max(
                                      1,
                                      Math.min(
                                        lp.maxDispositiviConsentiti,
                                        Math.round(Number(e.target.value) || 1)
                                      )
                                    ),
                                  }))
                                }
                                className="w-16 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={aggiungiComponenteAlLoop}
                              className="inline-flex items-center gap-1 rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Inserisci su {lp.sigla}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {iraiSubTab === 'causa_effetto' && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                      <span className="text-slate-700">
                        Configura le associazioni tra zone di rivelazione/allarme e le attivazioni di uscita.
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const mancanti = sysIraiAttivo.zone.filter(
                              (z) =>
                                !sysIraiAttivo.causaEffetto.some(
                                  (ce) => ce.causaZonaId === z.id
                                )
                            );
                            if (mancanti.length === 0) return;
                            const nuoveRighe: RigaCausaEffetto[] = mancanti.map((z, idx) => ({
                              id: `ce-${Date.now()}-${idx}`,
                              causaZonaId: z.id,
                              causaDescrizione: `Allarme Zona ${z.codice} (${z.nome})`,
                              attivaTargheOtticoAcustiche: true,
                              attivaEvac: true,
                              messaggioEvac: `Messaggio Evacuazione ${z.codice}`,
                              sgancioImpiantiTecnologici: true,
                              chiusuraPorteTagliafuoco: true,
                              ritardoSecondi: 0,
                            }));
                            onAggiornaProgetto((p) => ({
                              ...p,
                              sistemiIrai: p.sistemiIrai.map((sys) =>
                                sys.id === sysIraiAttivo.id
                                  ? {
                                      ...sys,
                                      causaEffetto: [...sys.causaEffetto, ...nuoveRighe],
                                    }
                                  : sys
                              ),
                            }));
                          }}
                          className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          Genera Righe Zone Mancanti
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const primaZona = sysIraiAttivo.zone[0];
                            const nuovaRiga: RigaCausaEffetto = {
                              id: `ce-${Date.now()}`,
                              causaZonaId: primaZona?.id ?? '',
                              causaDescrizione: primaZona
                                ? `Allarme Zona ${primaZona.codice} (${primaZona.nome})`
                                : 'Nuovo evento di allarme',
                              attivaTargheOtticoAcustiche: true,
                              attivaEvac: false,
                              messaggioEvac: 'Messaggio M1 - Preallarme',
                              sgancioImpiantiTecnologici: false,
                              chiusuraPorteTagliafuoco: true,
                              ritardoSecondi: 0,
                            };
                            onAggiornaProgetto(
                              (p) => ({
                                ...p,
                                sistemiIrai: p.sistemiIrai.map((sys) =>
                                  sys.id === sysIraiAttivo.id
                                    ? {
                                        ...sys,
                                        causaEffetto: [...sys.causaEffetto, nuovaRiga],
                                      }
                                    : sys
                                ),
                              }),
                              {
                                sezione: `${sysIraiAttivo.sigla} · Causa-Effetto`,
                                campo: 'Aggiunta regola',
                                prevVal: '—',
                                newVal: nuovaRiga.causaDescrizione,
                              }
                            );
                          }}
                          className="inline-flex items-center gap-1 rounded bg-blue-700 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Aggiungi Regola
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                          <tr>
                            <th className="px-2.5 py-2">Zona Causa</th>
                            <th className="px-2.5 py-2">Descrizione Causa / Evento</th>
                            <th className="px-2.5 py-2">Targhe</th>
                            <th className="px-2.5 py-2">EVAC</th>
                            <th className="px-2.5 py-2">Messaggio EVAC</th>
                            <th className="px-2.5 py-2">Sgancio Imp.</th>
                            <th className="px-2.5 py-2">Porte TF</th>
                            <th className="px-2.5 py-2">Ritardo (s)</th>
                            <th className="px-2.5 py-2 text-right">Azioni</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {sysIraiAttivo.causaEffetto.length === 0 ? (
                            <tr>
                              <td
                                colSpan={9}
                                className="px-3 py-6 text-center text-xs text-slate-500"
                              >
                                Nessuna regola nella matrice Causa-Effetto. Usa «Aggiungi Regola» oppure «Genera Righe Zone Mancanti».
                              </td>
                            </tr>
                          ) : (
                            sysIraiAttivo.causaEffetto.map((ce) => (
                            <tr key={ce.id} className="hover:bg-slate-50">
                              <td className="px-2.5 py-2">
                                <select
                                  value={ce.causaZonaId}
                                  onChange={(e) =>
                                    onAggiornaProgetto((p) => ({
                                      ...p,
                                      sistemiIrai: p.sistemiIrai.map((sys) =>
                                        sys.id === sysIraiAttivo.id
                                          ? {
                                              ...sys,
                                              causaEffetto: sys.causaEffetto.map((row) =>
                                                row.id === ce.id
                                                  ? { ...row, causaZonaId: e.target.value }
                                                  : row
                                              ),
                                            }
                                          : sys
                                      ),
                                    }))
                                  }
                                  className="rounded border border-slate-200 bg-white px-1.5 py-1 font-mono text-xs text-slate-900"
                                >
                                  {sysIraiAttivo.zone.map((z) => (
                                    <option key={z.id} value={z.id}>
                                      {z.codice}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-2.5 py-2">
                                <input
                                  type="text"
                                  value={ce.causaDescrizione}
                                  onChange={(e) =>
                                    onAggiornaProgetto((p) => ({
                                      ...p,
                                      sistemiIrai: p.sistemiIrai.map((sys) =>
                                        sys.id === sysIraiAttivo.id
                                          ? {
                                              ...sys,
                                              causaEffetto: sys.causaEffetto.map((row) =>
                                                row.id === ce.id
                                                  ? { ...row, causaDescrizione: e.target.value }
                                                  : row
                                              ),
                                            }
                                          : sys
                                      ),
                                    }))
                                  }
                                  className="w-52 rounded border border-slate-200 px-2 py-1 text-xs text-slate-900"
                                />
                              </td>
                              <td className="px-2.5 py-2">
                                <input
                                  type="checkbox"
                                  checked={ce.attivaTargheOtticoAcustiche}
                                  onChange={(e) =>
                                    onAggiornaProgetto((p) => ({
                                      ...p,
                                      sistemiIrai: p.sistemiIrai.map((sys) =>
                                        sys.id === sysIraiAttivo.id
                                          ? {
                                              ...sys,
                                              causaEffetto: sys.causaEffetto.map((row) =>
                                                row.id === ce.id
                                                  ? {
                                                      ...row,
                                                      attivaTargheOtticoAcustiche: e.target.checked,
                                                    }
                                                  : row
                                              ),
                                            }
                                          : sys
                                      ),
                                    }))
                                  }
                                />
                              </td>
                              <td className="px-2.5 py-2">
                                <input
                                  type="checkbox"
                                  checked={ce.attivaEvac}
                                  onChange={(e) =>
                                    onAggiornaProgetto((p) => ({
                                      ...p,
                                      sistemiIrai: p.sistemiIrai.map((sys) =>
                                        sys.id === sysIraiAttivo.id
                                          ? {
                                              ...sys,
                                              causaEffetto: sys.causaEffetto.map((row) =>
                                                row.id === ce.id
                                                  ? { ...row, attivaEvac: e.target.checked }
                                                  : row
                                              ),
                                            }
                                          : sys
                                      ),
                                    }))
                                  }
                                />
                              </td>
                              <td className="px-2.5 py-2">
                                <input
                                  type="text"
                                  value={ce.messaggioEvac}
                                  onChange={(e) =>
                                    onAggiornaProgetto((p) => ({
                                      ...p,
                                      sistemiIrai: p.sistemiIrai.map((sys) =>
                                        sys.id === sysIraiAttivo.id
                                          ? {
                                              ...sys,
                                              causaEffetto: sys.causaEffetto.map((row) =>
                                                row.id === ce.id
                                                  ? { ...row, messaggioEvac: e.target.value }
                                                  : row
                                              ),
                                            }
                                          : sys
                                      ),
                                    }))
                                  }
                                  className="w-44 rounded border border-slate-200 px-2 py-1 text-xs text-slate-900"
                                />
                              </td>
                              <td className="px-2.5 py-2">
                                <input
                                  type="checkbox"
                                  checked={ce.sgancioImpiantiTecnologici}
                                  onChange={(e) =>
                                    onAggiornaProgetto((p) => ({
                                      ...p,
                                      sistemiIrai: p.sistemiIrai.map((sys) =>
                                        sys.id === sysIraiAttivo.id
                                          ? {
                                              ...sys,
                                              causaEffetto: sys.causaEffetto.map((row) =>
                                                row.id === ce.id
                                                  ? {
                                                      ...row,
                                                      sgancioImpiantiTecnologici: e.target.checked,
                                                    }
                                                  : row
                                              ),
                                            }
                                          : sys
                                      ),
                                    }))
                                  }
                                />
                              </td>
                              <td className="px-2.5 py-2">
                                <input
                                  type="checkbox"
                                  checked={ce.chiusuraPorteTagliafuoco}
                                  onChange={(e) =>
                                    onAggiornaProgetto((p) => ({
                                      ...p,
                                      sistemiIrai: p.sistemiIrai.map((sys) =>
                                        sys.id === sysIraiAttivo.id
                                          ? {
                                              ...sys,
                                              causaEffetto: sys.causaEffetto.map((row) =>
                                                row.id === ce.id
                                                  ? {
                                                      ...row,
                                                      chiusuraPorteTagliafuoco: e.target.checked,
                                                    }
                                                  : row
                                              ),
                                            }
                                          : sys
                                      ),
                                    }))
                                  }
                                />
                              </td>
                              <td className="px-2.5 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={600}
                                  value={ce.ritardoSecondi}
                                  onChange={(e) =>
                                    onAggiornaProgetto((p) => ({
                                      ...p,
                                      sistemiIrai: p.sistemiIrai.map((sys) =>
                                        sys.id === sysIraiAttivo.id
                                          ? {
                                              ...sys,
                                              causaEffetto: sys.causaEffetto.map((row) =>
                                                row.id === ce.id
                                                  ? {
                                                      ...row,
                                                      ritardoSecondi: Math.max(0, Number(e.target.value) || 0),
                                                    }
                                                  : row
                                              ),
                                            }
                                          : sys
                                      ),
                                    }))
                                  }
                                  className="w-16 rounded border border-slate-200 px-1.5 py-1 font-mono text-xs text-slate-900"
                                />
                              </td>
                              <td className="px-2.5 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onAggiornaProgetto((p) => ({
                                      ...p,
                                      sistemiIrai: p.sistemiIrai.map((sys) =>
                                        sys.id === sysIraiAttivo.id
                                          ? {
                                              ...sys,
                                              causaEffetto: sys.causaEffetto.filter(
                                                (row) => row.id !== ce.id
                                              ),
                                            }
                                          : sys
                                      ),
                                    }))
                                  }
                                  title="Elimina riga causa-effetto"
                                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {iraiSubTab === 'batterie' && (
                  <div className="grid gap-4 sm:grid-cols-3 text-xs">
                    <label className="block">
                      <span className="font-medium text-slate-700">Autonomia Quiete Richiesta (h)</span>
                      <input
                        type="number"
                        value={sysIraiAttivo.autonomiaQuieteRichiestaOre}
                        onChange={(e) =>
                          onAggiornaProgetto((p) => ({
                            ...p,
                            sistemiIrai: p.sistemiIrai.map((s) =>
                              s.id === sysIraiAttivo.id
                                ? { ...s, autonomiaQuieteRichiestaOre: Number(e.target.value) || 24 }
                                : s
                            ),
                          }))
                        }
                        className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
                      />
                    </label>
                    <label className="block">
                      <span className="font-medium text-slate-700">Autonomia Allarme (min)</span>
                      <input
                        type="number"
                        value={sysIraiAttivo.autonomiaAllarmeRichiestaMin}
                        onChange={(e) =>
                          onAggiornaProgetto((p) => ({
                            ...p,
                            sistemiIrai: p.sistemiIrai.map((s) =>
                              s.id === sysIraiAttivo.id
                                ? { ...s, autonomiaAllarmeRichiestaMin: Number(e.target.value) || 30 }
                                : s
                            ),
                          }))
                        }
                        className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
                      />
                    </label>
                    <label className="block">
                      <span className="font-medium text-slate-700">Batterie Installate (Ah)</span>
                      <input
                        type="number"
                        value={sysIraiAttivo.capacitaBatterieInstallataAh}
                        onChange={(e) =>
                          onAggiornaProgetto((p) => ({
                            ...p,
                            sistemiIrai: p.sistemiIrai.map((s) =>
                              s.id === sysIraiAttivo.id
                                ? { ...s, capacitaBatterieInstallataAh: Number(e.target.value) || 12 }
                                : s
                            ),
                          }))
                        }
                        className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
                      />
                    </label>
                    <div className="sm:col-span-3 rounded border border-blue-200 bg-blue-50 p-3 font-mono text-xs text-blue-950">
                      {calcolo.irai[sysIraiAttivo.id]?.formulaBatterie} · Alimentatore min:{' '}
                      {calcolo.irai[sysIraiAttivo.id]?.correnteAlimentatoreMinimaA} A
                    </div>
                  </div>
                )}
              </div>
            )}

            {nodoAttivo.tipo === 'evac' && sysEvacAttivo && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      {sysEvacAttivo.sigla} — {sysEvacAttivo.nome}
                    </h2>
                    <div className="text-xs text-slate-500 font-mono">
                      Carico altoparlanti: {calcolo.evac[sysEvacAttivo.id]?.potenzaTotaleAltoparlantiW} W · Amplificatori attivi: {calcolo.evac[sysEvacAttivo.id]?.potenzaAmplificatoriAttiviW} W · Riserva N+1: {sysEvacAttivo.ridondanzaAmplificatoriN1 ? 'Attiva' : 'Assente'}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sysEvacAttivo.interfacciaIraiCollegata}
                        onChange={(e) =>
                          onAggiornaProgetto((p) => ({
                            ...p,
                            sistemiEvac: p.sistemiEvac.map((s) =>
                              s.id === sysEvacAttivo.id
                                ? { ...s, interfacciaIraiCollegata: e.target.checked }
                                : s
                            ),
                          }))
                        }
                      />
                      Interfaccia IRAI
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sysEvacAttivo.separazioneCircuitiPotenza}
                        onChange={(e) =>
                          onAggiornaProgetto((p) => ({
                            ...p,
                            sistemiEvac: p.sistemiEvac.map((s) =>
                              s.id === sysEvacAttivo.id
                                ? { ...s, separazioneCircuitiPotenza: e.target.checked }
                                : s
                            ),
                          }))
                        }
                      />
                      Separazione circuiti potenza
                    </label>
                    <button
                      type="button"
                      onClick={() => duplicaSistemaEvac(sysEvacAttivo.id)}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                    >
                      <Copy className="h-3.5 w-3.5 text-blue-700" />
                      Duplica Sistema
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextIdx = sysEvacAttivo.lineeAltoparlanti.length + 1;
                        const newLine: LineaAltoparlantiEVAC = {
                          id: `spk-${Date.now()}`,
                          sigla: `EV-Z${nextIdx}`,
                          zonaNome: `Zona ${nextIdx} - Nuova Zona Altoparlanti`,
                          topologia: 'anello',
                          distribuzioneCarico: 'concentrato',
                          tensioneLineaV: 100,
                          numeroAltoparlanti: 10,
                          potenzaTotaleAltoparlantiW: 120,
                          lunghezzaM: 180,
                          sezioneMm2: 1.5,
                          resistenzaFuoco: 'PH30',
                          cadutaTensioneMaxPct: 10,
                          amplificatoreId:
                            sysEvacAttivo.amplificatori.find((a) => !a.diRiserva)?.id ??
                            sysEvacAttivo.amplificatori[0]?.id ??
                            '',
                        };
                        onAggiornaProgetto((p) => ({
                          ...p,
                          sistemiEvac: p.sistemiEvac.map((s) =>
                            s.id === sysEvacAttivo.id
                              ? { ...s, lineeAltoparlanti: [...s.lineeAltoparlanti, newLine] }
                              : s
                          ),
                        }));
                      }}
                      className="inline-flex items-center gap-1 rounded bg-blue-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-800 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Aggiungi Linea Altoparlanti
                    </button>
                  </div>
                </div>

                {(() => {
                  const updateLineaEvac = (
                    lineaId: string,
                    patch: Partial<LineaAltoparlantiEVAC>
                  ) => {
                    onAggiornaProgetto((p) => ({
                      ...p,
                      sistemiEvac: p.sistemiEvac.map((s) =>
                        s.id === sysEvacAttivo.id
                          ? {
                              ...s,
                              lineeAltoparlanti: s.lineeAltoparlanti.map((x) =>
                                x.id === lineaId ? { ...x, ...patch } : x
                              ),
                            }
                          : s
                      ),
                    }));
                  };

                  const resSysEvac = calcolo.evac[sysEvacAttivo.id];
                  const lineeNonConformi =
                    resSysEvac?.lineeRisultati.filter((r) => !r.conformeCadutaTensione) ?? [];

                  return (
                    <>
                      <div className="overflow-x-auto rounded border border-slate-200">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                            <tr>
                              <th className="px-2.5 py-2">Linea & Zona</th>
                              <th className="px-2.5 py-2">Topologia / Carico</th>
                              <th className="px-2.5 py-2">U (V)</th>
                              <th className="px-2.5 py-2">Diffusori / Potenza (W)</th>
                              <th className="px-2.5 py-2">Lunghezza (m)</th>
                              <th className="px-2.5 py-2">Sezione / Cavo</th>
                              <th className="px-2.5 py-2">ΔV Max (%)</th>
                              <th className="px-2.5 py-2">ΔV Calcolata</th>
                              <th className="px-2.5 py-2">Esito Verifica</th>
                              <th className="px-2.5 py-2 text-right">Azioni</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {sysEvacAttivo.lineeAltoparlanti.map((ln) => {
                              const res = resSysEvac?.lineeRisultati.find(
                                (r) => r.lineaId === ln.id
                              );
                              const ok = res?.conformeCadutaTensione ?? true;
                              return (
                                <tr
                                  key={ln.id}
                                  className={!ok ? 'bg-red-50/40' : undefined}
                                >
                                  <td className="px-2.5 py-2 space-y-1">
                                    <input
                                      type="text"
                                      value={ln.sigla}
                                      onChange={(e) =>
                                        updateLineaEvac(ln.id, { sigla: e.target.value })
                                      }
                                      className="w-20 rounded border border-slate-200 px-1.5 py-0.5 font-mono font-semibold text-xs"
                                    />
                                    <input
                                      type="text"
                                      value={ln.zonaNome}
                                      onChange={(e) =>
                                        updateLineaEvac(ln.id, { zonaNome: e.target.value })
                                      }
                                      className="block w-44 rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-700"
                                    />
                                  </td>
                                  <td className="px-2.5 py-2 space-y-1">
                                    <select
                                      value={ln.topologia}
                                      onChange={(e) =>
                                        updateLineaEvac(ln.id, {
                                          topologia: e.target.value as 'radiale' | 'anello',
                                        })
                                      }
                                      className="block w-28 rounded border border-slate-200 px-1.5 py-0.5 text-xs"
                                    >
                                      <option value="anello">Anello (×0.5)</option>
                                      <option value="radiale">Radiale (×1.0)</option>
                                    </select>
                                    <select
                                      value={ln.distribuzioneCarico ?? 'concentrato'}
                                      onChange={(e) =>
                                        updateLineaEvac(ln.id, {
                                          distribuzioneCarico: e.target
                                            .value as DistribuzioneCaricoEVAC,
                                        })
                                      }
                                      className="block w-28 rounded border border-slate-200 px-1.5 py-0.5 text-xs"
                                    >
                                      <option value="concentrato">Concentrato</option>
                                      <option value="distribuito">Distribuito (×0.5)</option>
                                    </select>
                                  </td>
                                  <td className="px-2.5 py-2 font-mono">
                                    <select
                                      value={ln.tensioneLineaV}
                                      onChange={(e) =>
                                        updateLineaEvac(ln.id, {
                                          tensioneLineaV: Number(e.target.value) as 100 | 70,
                                        })
                                      }
                                      className="rounded border border-slate-200 px-1.5 py-0.5 text-xs"
                                    >
                                      <option value={100}>100 V</option>
                                      <option value={70}>70 V</option>
                                    </select>
                                  </td>
                                  <td className="px-2.5 py-2 font-mono">
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        min={1}
                                        value={ln.numeroAltoparlanti}
                                        onChange={(e) =>
                                          updateLineaEvac(ln.id, {
                                            numeroAltoparlanti: Math.max(
                                              1,
                                              Number(e.target.value) || 1
                                            ),
                                          })
                                        }
                                        className="w-12 rounded border border-slate-200 px-1 py-0.5 text-xs"
                                      />
                                      <span className="text-slate-500">pz</span>
                                    </div>
                                    <div className="mt-1 flex items-center gap-1">
                                      <input
                                        type="number"
                                        min={0}
                                        value={ln.potenzaTotaleAltoparlantiW}
                                        onChange={(e) =>
                                          updateLineaEvac(ln.id, {
                                            potenzaTotaleAltoparlantiW: Math.max(
                                              0,
                                              Number(e.target.value) || 0
                                            ),
                                          })
                                        }
                                        className="w-16 rounded border border-slate-200 px-1 py-0.5 text-xs font-semibold"
                                      />
                                      <span>W</span>
                                    </div>
                                  </td>
                                  <td className="px-2.5 py-2 font-mono">
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        min={1}
                                        value={ln.lunghezzaM}
                                        onChange={(e) =>
                                          updateLineaEvac(ln.id, {
                                            lunghezzaM: Math.max(
                                              0,
                                              Number(e.target.value) || 0
                                            ),
                                          })
                                        }
                                        className="w-16 rounded border border-slate-200 px-1 py-0.5 text-xs font-semibold"
                                      />
                                      <span>m</span>
                                    </div>
                                    <div className="mt-1 text-[11px] text-slate-500">
                                      L_max: {res?.lunghezzaMassimaAmmissibileM ?? 0} m
                                    </div>
                                  </td>
                                  <td className="px-2.5 py-2 font-mono space-y-1">
                                    <select
                                      value={ln.sezioneMm2}
                                      onChange={(e) =>
                                        updateLineaEvac(ln.id, {
                                          sezioneMm2: Number(e.target.value) || 1.5,
                                        })
                                      }
                                      className="block w-24 rounded border border-slate-200 px-1.5 py-0.5 text-xs font-semibold"
                                    >
                                      {SEZIONI_EVAC_STANDARD.map((s) => (
                                        <option key={s} value={s}>
                                          {s} mm²
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      value={ln.resistenzaFuoco}
                                      onChange={(e) =>
                                        updateLineaEvac(ln.id, {
                                          resistenzaFuoco: e.target
                                            .value as ResistenzaFuocoCavo,
                                        })
                                      }
                                      className="block w-24 rounded border border-slate-200 px-1.5 py-0.5 text-xs"
                                    >
                                      {(['PH30', 'PH60', 'PH90', 'PH120'] as ResistenzaFuocoCavo[]).map(
                                        (ph) => (
                                          <option key={ph} value={ph}>
                                            {ph}
                                          </option>
                                        )
                                      )}
                                    </select>
                                  </td>
                                  <td className="px-2.5 py-2 font-mono">
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        min={1}
                                        max={20}
                                        step={0.5}
                                        value={ln.cadutaTensioneMaxPct ?? 10}
                                        onChange={(e) =>
                                          updateLineaEvac(ln.id, {
                                            cadutaTensioneMaxPct: Math.max(
                                              1,
                                              Number(e.target.value) || 10
                                            ),
                                          })
                                        }
                                        className="w-14 rounded border border-slate-200 px-1 py-0.5 text-xs"
                                      />
                                      <span>%</span>
                                    </div>
                                  </td>
                                  <td className="px-2.5 py-2 font-mono">
                                    <div
                                      className={`font-bold ${
                                        ok ? 'text-emerald-700' : 'text-red-700'
                                      }`}
                                    >
                                      {res?.cadutaTensionePct.toFixed(2) ?? '0.00'}%
                                    </div>
                                    <div className="text-[11px] text-slate-600">
                                      {res?.cadutaTensioneV.toFixed(2) ?? '0.00'} V ·{' '}
                                      {res?.attenuazioneDb.toFixed(2) ?? '0.00'} dB
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      I={res?.correnteLineaA ?? 0} A
                                    </div>
                                  </td>
                                  <td className="px-2.5 py-2">
                                    {ok ? (
                                      <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Conforme
                                      </span>
                                    ) : (
                                      <div className="space-y-1">
                                        <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">
                                          <AlertTriangle className="h-3 w-3" />
                                          Superata
                                        </span>
                                        {res && res.sezioneMinimaConsigliataMm2 > ln.sezioneMm2 && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              updateLineaEvac(ln.id, {
                                                sezioneMm2: res.sezioneMinimaConsigliataMm2,
                                              })
                                            }
                                            className="block rounded border border-blue-300 bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-800 hover:bg-blue-100 cursor-pointer whitespace-nowrap"
                                          >
                                            Applica {res.sezioneMinimaConsigliataMm2} mm²
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-2.5 py-2 text-right">
                                    <div className="inline-flex items-center gap-1">
                                      <button
                                        type="button"
                                        title="Duplica linea altoparlanti"
                                        onClick={() => {
                                          const copyLine: LineaAltoparlantiEVAC = {
                                            ...ln,
                                            id: `spk-${Date.now()}`,
                                            sigla: `${ln.sigla}-BIS`,
                                          };
                                          onAggiornaProgetto((p) => ({
                                            ...p,
                                            sistemiEvac: p.sistemiEvac.map((s) =>
                                              s.id === sysEvacAttivo.id
                                                ? {
                                                    ...s,
                                                    lineeAltoparlanti: [
                                                      ...s.lineeAltoparlanti,
                                                      copyLine,
                                                    ],
                                                  }
                                                : s
                                            ),
                                          }));
                                        }}
                                        className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                                      >
                                        <Copy className="h-3.5 w-3.5" />
                                      </button>
                                      {sysEvacAttivo.lineeAltoparlanti.length > 1 && (
                                        <button
                                          type="button"
                                          title="Elimina linea altoparlanti"
                                          onClick={() =>
                                            onAggiornaProgetto((p) => ({
                                              ...p,
                                              sistemiEvac: p.sistemiEvac.map((s) =>
                                                s.id === sysEvacAttivo.id
                                                  ? {
                                                      ...s,
                                                      lineeAltoparlanti:
                                                        s.lineeAltoparlanti.filter(
                                                          (x) => x.id !== ln.id
                                                        ),
                                                    }
                                                  : s
                                              ),
                                            }))
                                          }
                                          className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Modulo Analitico Verifica Caduta di Tensione Linee EVAC */}
                      <div className="rounded border border-slate-200 bg-slate-50 p-3 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                            Modulo Verifica Caduta di Tensione Linee EVAC (UNI ISO 7240-19 / EN 54-24)
                          </h3>
                          <span
                            className={`text-xs font-semibold ${
                              lineeNonConformi.length === 0
                                ? 'text-emerald-700'
                                : 'text-red-700'
                            }`}
                          >
                            {lineeNonConformi.length === 0
                              ? 'Tutte le linee altoparlanti verificate conformi'
                              : `${lineeNonConformi.length} linea/e oltre la soglia di caduta ammessa`}
                          </span>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          {sysEvacAttivo.lineeAltoparlanti.map((ln) => {
                            const res = resSysEvac?.lineeRisultati.find(
                              (r) => r.lineaId === ln.id
                            );
                            if (!res) return null;
                            return (
                              <div
                                key={ln.id}
                                className={`rounded border bg-white p-2.5 text-xs ${
                                  res.conformeCadutaTensione
                                    ? 'border-slate-200'
                                    : 'border-red-300 bg-red-50/30'
                                }`}
                              >
                                <div className="flex items-center justify-between font-semibold text-slate-900">
                                  <span>
                                    <span className="font-mono text-blue-700 mr-1.5">
                                      {ln.sigla}
                                    </span>
                                    {ln.zonaNome}
                                  </span>
                                  <span
                                    className={`font-mono ${
                                      res.conformeCadutaTensione
                                        ? 'text-emerald-700'
                                        : 'text-red-700'
                                    }`}
                                  >
                                    ΔV = {res.cadutaTensionePct.toFixed(2)}% (≤ {res.sogliaMaxPct}%)
                                  </span>
                                </div>
                                <div className="mt-1 grid grid-cols-3 gap-1.5 font-mono text-[11px] text-slate-600">
                                  <div>I = {res.correnteLineaA} A</div>
                                  <div>Z_carico = {res.impedenzaCaricoOhm} Ω</div>
                                  <div>R_eff = {res.resistenzaEffettivaOhm} Ω</div>
                                  <div>Att. = {res.attenuazioneDb} dB</div>
                                  <div>ΔP = {res.perditaPotenzaPct}%</div>
                                  <div>
                                    L_max = {res.lunghezzaMassimaAmmissibileM} m (S_min{' '}
                                    {res.sezioneMinimaConsigliataMm2} mm²)
                                  </div>
                                </div>
                                <div className="mt-1.5 border-t border-slate-100 pt-1 font-mono text-[10.5px] text-slate-500">
                                  {res.formulaDettaglio}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  );
                })()}

                <div className="rounded border border-blue-200 bg-blue-50 p-3 font-mono text-xs text-blue-950">
                  {calcolo.evac[sysEvacAttivo.id]?.formulaBatterie} · Installata:{' '}
                  {sysEvacAttivo.capacitaBatterieInstallataAh} Ah
                </div>
              </div>
            )}
          </div>
        )}

        {/* Anteprima Vettoriale Live dello Schema Unifilare */}
        {vistaLayout !== 'dati' && (
          <SchematicCanvas
            progetto={progetto}
            calcolo={calcolo}
            esiti={esiti}
            template={template}
            lineaSelezionataId={lineaSelezionataId}
            onSelezionaLinea={(id) => setNodoAttivo({ tipo: 'linee', lineaId: id })}
            onAggiornaOverride={(lineaId: string, ov: LayoutNodeOverride) =>
              onAggiornaProgetto((p) => ({
                ...p,
                layoutOverrides: { ...p.layoutOverrides, [lineaId]: ov },
              }))
            }
            onRipristinaLayout={() =>
              onAggiornaProgetto((p) => ({ ...p, layoutOverrides: {} }))
            }
            onAggiungiAnnotazione={(ann) =>
              onAggiornaProgetto((p) => ({
                ...p,
                annotazioni: [...p.annotazioni, ann],
              }))
            }
            onEliminaAnnotazione={(id) =>
              onAggiornaProgetto((p) => ({
                ...p,
                annotazioni: p.annotazioni.filter((a) => a.id !== id),
              }))
            }
          />
        )}
      </main>

      {/* Ispettore Destro Richiudibile: Formule e Verifiche Contestuali */}
      {ispettoreAperto && (
        <aside className="w-full shrink-0 border-t border-slate-200 bg-white p-4 lg:w-80 lg:border-t-0 lg:border-l space-y-4">
          <div className="border-b border-slate-200 pb-2.5">
            <h3 className="text-sm font-semibold text-slate-900">
              Ispettore Calcoli & Verifiche
            </h3>
            <p className="text-xs text-slate-500">
              Tracciabilità formule ed esiti normativi in tempo reale.
            </p>
          </div>

          {lineaAttiva && calcolo.linee[lineaAttiva.id] && (
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-slate-800">
                Calcolo Linea {lineaAttiva.sigla}
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 p-2.5 font-mono text-[11px] text-slate-800 space-y-1">
                {calcolo.linee[lineaAttiva.id].formuleDettaglio.map((f, i) => (
                  <div key={i} className="leading-relaxed">
                    {f}
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-slate-500">
                Fonte: {calcolo.linee[lineaAttiva.id].fonteNormativa}
              </div>
            </div>
          )}

          <div className="border-t border-slate-200 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                Verifiche Attive ({esiti.length})
              </span>
              <button
                type="button"
                onClick={() => onVaiARegole('regole')}
                className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
              >
                Dettaglio & Deroghe
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-1.5 pr-1">
              {esiti.map((e) => (
                <div
                  key={e.id}
                  className="rounded border border-slate-200 px-2.5 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-slate-900">
                      {e.codice} · {e.targetLabel}
                    </span>
                    {e.stato === 'conforme' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                    ) : e.stato === 'non_conforme' ? (
                      <XCircle className="h-3.5 w-3.5 shrink-0 text-red-700" />
                    ) : (
                      <HelpCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-600">
                    {e.messaggio}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};
