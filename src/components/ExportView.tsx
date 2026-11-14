import React, { useState } from 'react';
import {
  FileCode2,
  FileSpreadsheet,
  FileText,
  Printer,
  ShieldAlert,
} from 'lucide-react';
import { AVVISO_RESPONSABILITA_LEGALE } from '../data/rulesAndLibrary';
import {
  generaDxfElencoCavi,
  generaDxfFronteQuadro,
  generaDxfMorsettiera,
  generaDxfSchema,
} from '../engine/dxfEngine';
import {
  esportaComputoXlsx,
  esportaDxfDocumento,
  esportaExcelRiepilogoSistemaIrai,
  esportaJsonProgetto,
  esportaPdfMultiFoglio,
  esportaPdfRiepilogoSistemaIrai,
  esportaRelazioneTecnicaModificabile,
} from '../engine/exporters';
import {
  EsitoVerifica,
  ProgettoAntincendio,
  RisultatoCalcoloCompleto,
  TemplateTavolaDXF,
} from '../types/elettrocad';

interface ExportViewProps {
  progetto: ProgettoAntincendio;
  calcolo: RisultatoCalcoloCompleto;
  esiti: EsitoVerifica[];
  template: TemplateTavolaDXF;
}

export const ExportView: React.FC<ExportViewProps> = ({
  progetto,
  calcolo,
  esiti,
  template,
}) => {
  const [formatoPdf, setFormatoPdf] = useState<'A3' | 'A4'>('A3');
  const [ultimoExport, setUltimoExport] = useState<string | null>(null);

  const nonConformi = esiti.filter((e) => e.stato === 'non_conforme').length;
  const mancanti = esiti.filter((e) => e.stato === 'dato_mancante').length;

  type TipoElaboratoDxf =
    | 'unifilare'
    | 'fronte_quadro'
    | 'morsettiera'
    | 'elenco_cavi';

  const [dxfSelezionati, setDxfSelezionati] = useState<Record<TipoElaboratoDxf, boolean>>({
    unifilare: true,
    fronte_quadro: true,
    morsettiera: true,
    elenco_cavi: true,
  });

  const ELABORATI_DXF: Array<{
    id: TipoElaboratoDxf;
    titolo: string;
    descrizione: string;
    suffisso: string;
  }> = [
    {
      id: 'unifilare',
      titolo: 'Schema Unifilare',
      descrizione: 'Sbarra, protezioni CEI EN 60617, simboli D.M. 83, barra PE e tabella analitica.',
      suffisso: 'Schema_Unifilare',
    },
    {
      id: 'fronte_quadro',
      titolo: 'Schema Fronte Quadro',
      descrizione: 'Vista frontale carpenteria con file DIN, moduli apparecchiature e distinta.',
      suffisso: 'Schema_Fronte_Quadro',
    },
    {
      id: 'morsettiera',
      titolo: 'Schema Morsettiera',
      descrizione: 'Morsettiera X1 numerata (CBD), collegamenti quadro/campo e morsetti segnali.',
      suffisso: 'Schema_Morsettiera',
    },
    {
      id: 'elenco_cavi',
      titolo: 'Elenco Cavi (DXF)',
      descrizione: 'Tabella grafica posa CEI 64-8 con icone posa, Ib/In/Iz, lunghezze ed estremi.',
      suffisso: 'Elenco_Cavi',
    },
  ];

  const countDxfSelezionati = ELABORATI_DXF.filter((e) => dxfSelezionati[e.id]).length;
  const tuttiSelezionati = countDxfSelezionati === ELABORATI_DXF.length;

  const toggleTuttiDxf = () => {
    const nextVal = !tuttiSelezionati;
    setDxfSelezionati({
      unifilare: nextVal,
      fronte_quadro: nextVal,
      morsettiera: nextVal,
      elenco_cavi: nextVal,
    });
  };

  const handleDxfSelezionati = () => {
    const daEsportare = ELABORATI_DXF.filter((el) => dxfSelezionati[el.id]);
    if (daEsportare.length === 0) return;

    daEsportare.forEach((el, idx) => {
      const genera = () => {
        let content = '';
        if (el.id === 'unifilare') {
          content = generaDxfSchema(progetto, calcolo, template);
        } else if (el.id === 'fronte_quadro') {
          content = generaDxfFronteQuadro(progetto, calcolo, template);
        } else if (el.id === 'morsettiera') {
          content = generaDxfMorsettiera(progetto, calcolo, template);
        } else {
          content = generaDxfElencoCavi(progetto, calcolo, template);
        }
        esportaDxfDocumento(content, progetto.identificativi.commessa, el.suffisso);
      };

      if (idx === 0) {
        genera();
      } else {
        window.setTimeout(genera, idx * 180);
      }
    });

    setUltimoExport(
      `Esportati ${daEsportare.length} file DXF R2000 con template unificato (${daEsportare
        .map((e) => e.titolo)
        .join(', ')}).`
    );
  };

  const handlePdf = () => {
    esportaPdfMultiFoglio(progetto, calcolo, esiti, template, formatoPdf);
    setUltimoExport(`PDF multi-foglio formato ${formatoPdf} generato e scaricato.`);
  };

  const handleXlsx = (fmt: 'xlsx' | 'csv') => {
    esportaComputoXlsx(progetto, calcolo, esiti, fmt);
    setUltimoExport(`Computo materiali ed elenchi esportati in formato ${fmt.toUpperCase()}.`);
  };

  const handleRelazione = () => {
    esportaRelazioneTecnicaModificabile(progetto, calcolo, esiti);
    setUltimoExport('Relazione tecnica di calcolo modificabile (.doc) generata.');
  };

  const handleJson = () => {
    esportaJsonProgetto(progetto);
    setUltimoExport('Pacchetto dati aperto JSON esportato.');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">
          Esportazione Elaborati CAD, Tabelle e Relazione Tecnica
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Commessa {progetto.identificativi.commessa} · {progetto.identificativi.cliente} · Template attivo: {template.nome}
        </p>
      </div>

      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
          <div>
            <strong>{AVVISO_RESPONSABILITA_LEGALE}</strong>
            <div className="mt-1 font-mono text-[11px] text-red-800">
              Tracciabilità integrata in ogni elaborato: App {calcolo.versioneApp} · Regole {calcolo.versioneRegole} · Libreria {calcolo.versioneLibreria}
            </div>
          </div>
        </div>
      </div>

      {(nonConformi > 0 || mancanti > 0) && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950">
          Attenzione prima dell’emissione: risultano{' '}
          <strong className="font-mono">{nonConformi}</strong> verifiche non conformi e{' '}
          <strong className="font-mono">{mancanti}</strong> dati critici mancanti. Controlla la sezione «Regole e Verifiche» o inserisci eventuali deroghe motivate.
        </div>
      )}

      {ultimoExport && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900">
          {ultimoExport}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {/* DXF AutoCAD Multi-Elaborato */}
        <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-blue-700">
                <FileCode2 className="h-5 w-5 shrink-0" />
                <h2 className="text-base font-semibold text-slate-900">
                  Elaborati Grafici CAD in Formato DXF
                </h2>
              </div>
              <button
                type="button"
                onClick={toggleTuttiDxf}
                className="text-xs font-medium text-blue-700 hover:underline cursor-pointer whitespace-nowrap"
              >
                {tuttiSelezionati ? 'Deseleziona tutti' : 'Seleziona tutti'}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              Tutti gli elaborati DXF (AC1015 / AutoCAD R2000) utilizzano lo stesso template con squadratura <span className="font-mono">A–F</span> / <span className="font-mono">1–8</span> bianca, simboli normati e cartiglio di commessa.
            </p>

            <div className="mt-3 space-y-2">
              {ELABORATI_DXF.map((el) => (
                <label
                  key={el.id}
                  className={`flex items-start gap-2.5 rounded border px-3 py-2 text-xs cursor-pointer transition-colors ${
                    dxfSelezionati[el.id]
                      ? 'border-blue-300 bg-blue-50/50 text-slate-900'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={dxfSelezionati[el.id]}
                    onChange={(e) =>
                      setDxfSelezionati((prev) => ({
                        ...prev,
                        [el.id]: e.target.checked,
                      }))
                    }
                    className="mt-0.5 cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{el.titolo}</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        _{el.suffisso}.dxf
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-600">
                      {el.descrizione}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <button
              type="button"
              disabled={countDxfSelezionati === 0}
              onClick={handleDxfSelezionati}
              className="w-full rounded-md bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 cursor-pointer whitespace-nowrap"
            >
              {countDxfSelezionati === 0
                ? 'Seleziona almeno un elaborato DXF'
                : `Scarica Elaborati DXF Selezionati (${countDxfSelezionati})`}
            </button>
          </div>
        </div>

        {/* PDF Multi-Foglio */}
        <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5">
          <div>
            <div className="flex items-center gap-2 text-slate-900">
              <Printer className="h-5 w-5 text-blue-700" />
              <h2 className="text-base font-semibold text-slate-900">
                Stampa PDF Multi-Foglio con Riquadro e Cartiglio
              </h2>
            </div>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Esporta gli schemi unifilari suddivisi automaticamente su più tavole con tabella dati, matrice causa-effetto IRAI, riepilogo verifiche normative, cartiglio personalizzato e avviso di responsabilità.
            </p>
            <div className="mt-3 flex items-center gap-3 text-xs">
              <span className="font-medium text-slate-700">Formato foglio:</span>
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  checked={formatoPdf === 'A3'}
                  onChange={() => setFormatoPdf('A3')}
                />
                A3 Orizzontale
              </label>
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  checked={formatoPdf === 'A4'}
                  onChange={() => setFormatoPdf('A4')}
                />
                A4 Orizzontale
              </label>
            </div>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={handlePdf}
              className="w-full rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
            >
              Esporta PDF Multi-Foglio ({formatoPdf})
            </button>
          </div>
        </div>

        {/* XLSX / CSV */}
        <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-700" />
              <h2 className="text-base font-semibold text-slate-900">
                Tabelle, Elenco Cavi, Protezioni e Causa-Effetto
              </h2>
            </div>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Esporta il computo completo su fogli di calcolo multi-scheda (Elenco Cavi con sezioni e CPR, Elenco Protezioni, Matrice Causa-Effetto IRAI ed Esiti Verifiche).
            </p>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => handleXlsx('xlsx')}
              className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              Scarica Excel (.XLSX)
            </button>
            <button
              type="button"
              onClick={() => handleXlsx('csv')}
              className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              Scarica CSV
            </button>
          </div>
        </div>

        {/* Relazione Tecnica & JSON */}
        <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-700" />
              <h2 className="text-base font-semibold text-slate-900">
                Relazione Tecnica Modificabile & Interscambio JSON
              </h2>
            </div>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Genera la relazione tecnica specialistica in formato modificabile (.doc compatibile Word / LibreOffice) completa di formule applicate, edizioni normative e motivazioni delle eventuali deroghe, oppure salva il file JSON aperto.
            </p>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleRelazione}
              className="flex-1 rounded-md border border-blue-700 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 cursor-pointer"
            >
              Relazione Tecnica (.DOC)
            </button>
            <button
              type="button"
              onClick={handleJson}
              className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              Dati Aperti (.JSON)
            </button>
          </div>
        </div>
      </div>

      {progetto.sistemiIrai.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-slate-900">
              Riepilogo per Singolo Sistema IRAI (PDF & Excel)
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Esporta un fascicolo di riepilogo dedicato per ciascuna centrale IRAI comprensivo di anagrafica zone, elenco loop e dispositivi, matrice causa-effetto, dimensionamento batterie e verifiche normative.
            </p>
          </div>
          <div className="divide-y divide-slate-200 rounded border border-slate-200">
            {progetto.sistemiIrai.map((sys) => {
              const totDisp = sys.loop.reduce((acc, l) => acc + l.dispositivi.length, 0);
              return (
                <div
                  key={sys.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
                >
                  <div>
                    <div className="font-semibold text-slate-900">
                      <span className="font-mono text-blue-700 mr-2">{sys.sigla}</span>
                      {sys.nome}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                      {sys.modelloCentrale} · {sys.zone.length} zone · {sys.loop.length} loop · {totDisp} dispositivi · {sys.causaEffetto.length} regole Causa-Effetto
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        esportaPdfRiepilogoSistemaIrai(
                          progetto,
                          sys,
                          calcolo.irai[sys.id],
                          calcolo,
                          esiti
                        );
                        setUltimoExport(`Riepilogo PDF del sistema ${sys.sigla} esportato.`);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                    >
                      <Printer className="h-3.5 w-3.5 text-blue-700" />
                      PDF Sistema
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        esportaExcelRiepilogoSistemaIrai(
                          progetto,
                          sys,
                          calcolo.irai[sys.id],
                          esiti
                        );
                        setUltimoExport(`Riepilogo Excel (.xlsx) del sistema ${sys.sigla} esportato.`);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
                      Excel Sistema (.XLSX)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
