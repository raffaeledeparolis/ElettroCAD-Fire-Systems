import React, { useRef, useState } from 'react';
import { Check, FileCode2, Star, Upload } from 'lucide-react';
import { SIMBOLI_NORMATIVI } from '../data/rulesAndLibrary';
import { parseDxfTemplate } from '../engine/dxfEngine';
import {
  ComponenteLibreria,
  MappaturaCampoDXF,
  TemplateTavolaDXF,
} from '../types/elettrocad';
import { SymbolSvg } from './SymbolSvg';

interface LibraryAndTemplatesViewProps {
  componenti: ComponenteLibreria[];
  templates: TemplateTavolaDXF[];
  templateAttivoId: string;
  onTogglePreferitoComponente: (id: string) => void;
  onImportaComponenti: (nuovi: ComponenteLibreria[]) => void;
  onAggiungiTemplate: (tpl: TemplateTavolaDXF) => void;
  onAggiornaMappaturaTemplate: (
    templateId: string,
    mappatura: MappaturaCampoDXF[]
  ) => void;
  onSelezionaTemplateProgetto: (templateId: string) => void;
}

const ETICHETTE_CAMPI: Record<MappaturaCampoDXF['campoProgetto'], string> = {
  commessa: 'Numero Commessa',
  cliente: 'Cliente / Committente',
  progettista: 'Progettista Abilitato',
  titoloTavola: 'Titolo Tavola',
  scala: 'Scala Disegno',
  data: 'Data Emissione',
  revisione: 'Revisione Corrente',
  numeroTavola: 'Numero Tavola (es. 1/2)',
};

export const LibraryAndTemplatesView: React.FC<
  LibraryAndTemplatesViewProps
> = ({
  componenti,
  templates,
  templateAttivoId,
  onTogglePreferitoComponente,
  onImportaComponenti,
  onAggiungiTemplate,
  onAggiornaMappaturaTemplate,
  onSelezionaTemplateProgetto,
}) => {
  const [tab, setTab] = useState<'template' | 'componenti' | 'simboli'>('template');
  const [filtroCat, setFiltroCat] = useState<string>('tutti');
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const dxfInputRef = useRef<HTMLInputElement | null>(null);
  const catInputRef = useRef<HTMLInputElement | null>(null);

  const templateAttivo =
    templates.find((t) => t.id === templateAttivoId) ?? templates[0];

  const handleUploadDxf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      const parsed = parseDxfTemplate(file.name, content);
      onAggiungiTemplate(parsed);
      onSelezionaTemplateProgetto(parsed.id);
      setMessaggio(
        `Template DXF "${parsed.nome}" analizzato: rilevati ${parsed.layerRilevati.length} layer, ${parsed.blocchiRilevati.length} blocchi e ${parsed.attributiRilevati.length} attributi.`
      );
    } catch {
      setMessaggio('Impossibile analizzare il file DXF selezionato.');
    }
    e.target.value = '';
  };

  const handleImportCatalogo = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const txt = await file.text();
      if (file.name.endsWith('.json')) {
        const arr = JSON.parse(txt) as ComponenteLibreria[];
        if (Array.isArray(arr)) {
          onImportaComponenti(arr);
          setMessaggio(`Importati ${arr.length} componenti da catalogo JSON.`);
        }
      } else {
        // CSV semplice: codice;costruttore;categoria;descrizione;In;Icu;versione
        const lines = txt.split(/\r?\n/).filter(Boolean).slice(1);
        const parsed: ComponenteLibreria[] = lines.map((line, i) => {
          const cols = line.split(/[;,]/);
          return {
            id: `comp-imp-${Date.now()}-${i}`,
            codiceCostruttore: cols[0]?.trim() || `COD-${i}`,
            costruttore: cols[1]?.trim() || 'Costruttore Esterno',
            categoria:
              (cols[2]?.trim() as ComponenteLibreria['categoria']) ||
              'protezione',
            descrizione: cols[3]?.trim() || 'Componente importato da catalogo',
            correnteNominaleA: Number(cols[4]) || undefined,
            potereInterruzioneKa: Number(cols[5]) || undefined,
            versioneCatalogo: cols[6]?.trim() || '2026.1',
            dataCatalogo: new Date().toISOString().slice(0, 10),
            approvatoAziendale: true,
            preferito: false,
          };
        });
        onImportaComponenti(parsed);
        setMessaggio(`Importati ${parsed.length} componenti da catalogo CSV.`);
      }
    } catch {
      setMessaggio('Errore durante l’importazione del catalogo componenti.');
    }
    e.target.value = '';
  };

  const componentiFiltrati = componenti.filter((c) =>
    filtroCat === 'tutti' ? true : c.categoria === filtroCat
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Libreria Componenti, Simbologia e Template DXF
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Gestione template di tavola AutoCAD (layer, blocchi, attributi), archivio tecnico componenti e simboli normativi.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-md bg-slate-100 p-1">
          {(
            [
              ['template', 'Template Tavola DXF'],
              ['componenti', 'Archivio Componenti'],
              ['simboli', 'Simbologia Normativa'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded px-3 py-1.5 text-xs font-medium cursor-pointer ${
                tab === id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {messaggio && (
        <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-900">
          <span>{messaggio}</span>
          <button
            type="button"
            onClick={() => setMessaggio(null)}
            className="font-semibold text-blue-700 hover:underline cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      )}

      {tab === 'template' && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">
                  Template Disponibili
                </h2>
                <input
                  ref={dxfInputRef}
                  type="file"
                  accept=".dxf"
                  onChange={handleUploadDxf}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => dxfInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Carica Template DXF
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Carica un file .DXF esportato da Autodesk AutoCAD contenente cornice, cartiglio e attributi.
              </p>

              <div className="mt-4 space-y-2.5">
                {templates.map((t) => {
                  const attivo = t.id === templateAttivo.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => onSelezionaTemplateProgetto(t.id)}
                      className={`rounded-md border p-3.5 cursor-pointer transition-colors ${
                        attivo
                          ? 'border-blue-600 bg-blue-50/50'
                          : 'border-slate-200 bg-slate-50 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900">
                          {t.nome}
                        </span>
                        {attivo && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
                            <Check className="h-3.5 w-3.5" />
                            Associato
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-slate-600 font-mono">
                        {t.formatoFoglio} {t.orientamento} ({t.larghezzaMm}×{t.altezzaMm} mm) · {t.versione}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Cliente: {t.clienteAssociato}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-4 lg:col-span-7">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <FileCode2 className="h-4 w-4 text-blue-700" />
                <h2 className="text-base font-semibold text-slate-900">
                  Ispezione DXF & Mappatura Campi Variabili: {templateAttivo.nome}
                </h2>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3 text-xs">
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="font-semibold text-slate-700">
                    Layer Rilevati ({templateAttivo.layerRilevati.length})
                  </div>
                  <div className="mt-1.5 font-mono text-[11px] text-slate-600 leading-relaxed">
                    {templateAttivo.layerRilevati.join(', ')}
                  </div>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="font-semibold text-slate-700">
                    Blocchi Rilevati ({templateAttivo.blocchiRilevati.length})
                  </div>
                  <div className="mt-1.5 font-mono text-[11px] text-slate-600 leading-relaxed">
                    {templateAttivo.blocchiRilevati.join(', ')}
                  </div>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="font-semibold text-slate-700">
                    Attributi Cartiglio ({templateAttivo.attributiRilevati.length})
                  </div>
                  <div className="mt-1.5 font-mono text-[11px] text-slate-600 leading-relaxed">
                    {templateAttivo.attributiRilevati.join(', ')}
                  </div>
                </div>
              </div>

              <h3 className="mt-5 text-sm font-semibold text-slate-900">
                Associazione Dati Progetto ↔ Tag Attributi DXF
              </h3>
              <div className="mt-2 overflow-hidden rounded border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Campo Variabile ElettroCAD</th>
                      <th className="px-3 py-2">Tag Attributo nel Template DXF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {templateAttivo.mappatura.map((m, idx) => (
                      <tr key={m.campoProgetto}>
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {ETICHETTE_CAMPI[m.campoProgetto]}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={m.tagAttributoDXF}
                            onChange={(e) => {
                              const next = templateAttivo.mappatura.map((item, i) =>
                                i === idx
                                  ? { ...item, tagAttributoDXF: e.target.value.toUpperCase() }
                                  : item
                              );
                              onAggiornaMappaturaTemplate(templateAttivo.id, next);
                            }}
                            className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'componenti' && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
            <div className="flex items-center gap-1 rounded-md bg-slate-100 p-1">
              {(
                [
                  ['tutti', 'Tutti'],
                  ['protezione', 'Protezioni'],
                  ['cavo', 'Cavi PH/CPR'],
                  ['irai', 'IRAI EN 54'],
                  ['evac', 'EVAC EN 54-16'],
                  ['ups', 'UPS'],
                ] as const
              ).map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setFiltroCat(val)}
                  className={`rounded px-2.5 py-1 text-xs font-medium cursor-pointer ${
                    filtroCat === val
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            <div>
              <input
                ref={catInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleImportCatalogo}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => catInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                Importa Catalogo Costruttore (CSV / JSON)
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-2.5">Preferito</th>
                  <th className="px-4 py-2.5">Codice</th>
                  <th className="px-4 py-2.5">Costruttore</th>
                  <th className="px-4 py-2.5">Descrizione Tecnica</th>
                  <th className="px-4 py-2.5">Parametri</th>
                  <th className="px-4 py-2.5">Catalogo & Stato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {componentiFiltrati.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => onTogglePreferitoComponente(c.id)}
                        className="cursor-pointer"
                        title="Segna come componente preferito"
                      >
                        <Star
                          className={`h-4 w-4 ${
                            c.preferito
                              ? 'fill-amber-400 text-amber-500'
                              : 'text-slate-300'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-2.5 font-mono font-semibold text-slate-900">
                      {c.codiceCostruttore}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{c.costruttore}</td>
                    <td className="px-4 py-2.5 text-slate-800">{c.descrizione}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-700">
                      {[
                        c.correnteNominaleA ? `In=${c.correnteNominaleA}A` : '',
                        c.potereInterruzioneKa ? `Icu=${c.potereInterruzioneKa}kA` : '',
                        c.curva ? `Curva ${c.curva}` : '',
                        c.sezioneMm2 ? `${c.sezioneMm2}mm²` : '',
                        c.resistenzaFuoco ?? '',
                        c.potenzaW ? `${c.potenzaW}W` : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 font-mono">
                      v{c.versioneCatalogo} ({c.dataCatalogo}) ·{' '}
                      {c.approvatoAziendale ? 'Approvato' : 'In valutazione'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'simboli' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SIMBOLI_NORMATIVI.map((sym) => (
            <div
              key={sym.codice}
              className="flex items-start gap-4 rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50">
                <SymbolSvg codice={sym.codice} size={42} />
              </div>
              <div className="min-w-0">
                <div className="font-mono text-xs font-semibold text-blue-700">
                  {sym.codice}
                </div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {sym.nome}
                </h3>
                <div className="mt-0.5 text-xs font-medium text-slate-600">
                  Norma: {sym.normaOrigine}
                </div>
                <p className="mt-1 text-xs text-slate-500">{sym.descrizione}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
