import React, { useRef, useState } from 'react';
import {
  Archive,
  Copy,
  Download,
  FileSpreadsheet,
  FolderOpen,
  GitCompare,
  History,
  Plus,
  Upload,
} from 'lucide-react';
import { TEMPLATE_PROGETTO_DISPONIBILI } from '../data/rulesAndLibrary';
import { esportaJsonProgetto, importaLineeDaFoglio } from '../engine/exporters';
import { ProgettoAntincendio } from '../types/elettrocad';

interface ProjectsViewProps {
  progetti: ProgettoAntincendio[];
  progettoAttivo: ProgettoAntincendio;
  onSelezionaProgetto: (id: string) => void;
  onCreaDaTemplate: (templateId: string) => void;
  onDuplicaProgetto: (id: string) => void;
  onArchiviaProgetto: (id: string) => void;
  onImportaProgettoJson: (progetto: ProgettoAntincendio) => void;
  onCreaNuovaRevisione: (note: string) => void;
  onImportaLineeFoglio: (linee: ProgettoAntincendio['linee']) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  progetti,
  progettoAttivo,
  onSelezionaProgetto,
  onCreaDaTemplate,
  onDuplicaProgetto,
  onArchiviaProgetto,
  onImportaProgettoJson,
  onCreaNuovaRevisione,
  onImportaLineeFoglio,
}) => {
  const [mostraArchiviati, setMostraArchiviati] = useState(false);
  const [noteRevisione, setNoteRevisione] = useState('');
  const [revConfrontoId, setRevConfrontoId] = useState<string>('');
  const [messaggioImport, setMessaggioImport] = useState<string | null>(null);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);
  const sheetInputRef = useRef<HTMLInputElement | null>(null);

  const visibili = progetti.filter((p) => (mostraArchiviati ? true : !p.archiviato));

  const handleJsonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const txt = await file.text();
      const parsed = JSON.parse(txt) as ProgettoAntincendio;
      if (!parsed.identificativi || !parsed.linee) {
        setMessaggioImport('File JSON non valido per ElettroCAD Fire Systems.');
        return;
      }
      onImportaProgettoJson({
        ...parsed,
        id: `proj-imp-${Date.now()}`,
        ultimoAggiornamento: new Date().toISOString().slice(0, 10),
      });
      setMessaggioImport(`Progetto "${parsed.identificativi.commessa}" importato correttamente.`);
    } catch {
      setMessaggioImport('Errore durante la lettura del file JSON.');
    }
    e.target.value = '';
  };

  const handleSheetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const quadroId = progettoAttivo.quadri[0]?.id ?? 'q-ant-01';
      const nuoveLinee = await importaLineeDaFoglio(file, quadroId);
      onImportaLineeFoglio(nuoveLinee);
      setMessaggioImport(`Importate ${nuoveLinee.length} linee da "${file.name}" nel progetto attivo.`);
    } catch {
      setMessaggioImport('Errore durante la lettura del foglio CSV/XLSX.');
    }
    e.target.value = '';
  };

  const revConfronto = progettoAttivo.revisioni.find((r) => r.id === revConfrontoId);
  const diffSummary = (() => {
    if (!revConfronto || !revConfronto.snapshotJson) return null;
    try {
      const oldProj = JSON.parse(revConfronto.snapshotJson) as ProgettoAntincendio;
      const diffs: string[] = [];
      if (oldProj.linee.length !== progettoAttivo.linee.length) {
        diffs.push(
          `Numero linee quadro: ${oldProj.linee.length} → ${progettoAttivo.linee.length}`
        );
      }
      if (oldProj.livelloPrestazione !== progettoAttivo.livelloPrestazione) {
        diffs.push(
          `Livello di prestazione: ${oldProj.livelloPrestazione} → ${progettoAttivo.livelloPrestazione}`
        );
      }
      if (oldProj.fornitura.iccPuntoConsegnaKa !== progettoAttivo.fornitura.iccPuntoConsegnaKa) {
        diffs.push(
          `Icc consegna: ${oldProj.fornitura.iccPuntoConsegnaKa} kA → ${progettoAttivo.fornitura.iccPuntoConsegnaKa} kA`
        );
      }
      if (oldProj.sistemiIrai.length !== progettoAttivo.sistemiIrai.length) {
        diffs.push(
          `Centrali IRAI: ${oldProj.sistemiIrai.length} → ${progettoAttivo.sistemiIrai.length}`
        );
      }
      if (oldProj.sistemiEvac.length !== progettoAttivo.sistemiEvac.length) {
        diffs.push(
          `Sistemi EVAC: ${oldProj.sistemiEvac.length} → ${progettoAttivo.sistemiEvac.length}`
        );
      }
      return diffs.length > 0 ? diffs : ['Nessuna differenza strutturale rispetto allo snapshot selezionato.'];
    } catch {
      return ['Snapshot precedente creato senza dati comparabili.'];
    }
  })();

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Gestione Progetti, Revisioni e Template
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Workspace locale persistente per commesse antincendio IRAI, EVAC e alimentazioni di sicurezza.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={jsonInputRef}
            type="file"
            accept=".json"
            onChange={handleJsonUpload}
            className="hidden"
          />
          <input
            ref={sheetInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleSheetUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => jsonInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" />
            Importa Progetto JSON
          </button>
          <button
            type="button"
            onClick={() => sheetInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Importa Linee CSV / XLSX
          </button>
        </div>
      </div>

      {messaggioImport && (
        <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900">
          <span>{messaggioImport}</span>
          <button
            type="button"
            onClick={() => setMessaggioImport(null)}
            className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      )}

      {/* Template di progetto ricorrenti */}
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">
          Nuovo Progetto da Template Tipologico
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          Avvia rapidamente una commessa preconfigurata con dati elettrici, loop IRAI, zone EVAC e regole attive.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {TEMPLATE_PROGETTO_DISPONIBILI.map((tpl) => (
            <div
              key={tpl.id}
              className="flex flex-col justify-between rounded-md border border-slate-200 bg-slate-50 p-4"
            >
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{tpl.nome}</h3>
                <p className="mt-1 text-xs text-slate-600">{tpl.descrizione}</p>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => onCreaDaTemplate(tpl.id)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Crea da Template
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Elenco commesse */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-base font-semibold text-slate-900">
            Commesse Salvate ({visibili.length})
          </h2>
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={mostraArchiviati}
              onChange={(e) => setMostraArchiviati(e.target.checked)}
              className="rounded border-slate-300"
            />
            Mostra progetti archiviati
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-2.5">Commessa</th>
                <th className="px-4 py-2.5">Cliente & Sito</th>
                <th className="px-4 py-2.5">Sistemi</th>
                <th className="px-4 py-2.5">Rev.</th>
                <th className="px-4 py-2.5">Aggiornato</th>
                <th className="px-4 py-2.5 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibili.map((p) => {
                const attivo = p.id === progettoAttivo.id;
                return (
                  <tr
                    key={p.id}
                    className={attivo ? 'bg-blue-50/50' : 'hover:bg-slate-50'}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900">
                      {p.identificativi.commessa}
                      {attivo && (
                        <span className="ml-2 text-blue-700 font-sans">· Attivo</span>
                      )}
                      {p.archiviato && (
                        <span className="ml-2 text-slate-500 font-sans">· Archiviato</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {p.identificativi.cliente}
                      </div>
                      <div className="text-xs text-slate-500">
                        {p.identificativi.sito}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 tabular-nums">
                      {p.linee.length} linee · {p.sistemiIrai.length} IRAI ·{' '}
                      {p.sistemiEvac.length} EVAC
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">
                      {p.identificativi.revisione}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {p.ultimoAggiornamento}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {!attivo && (
                          <button
                            type="button"
                            onClick={() => onSelezionaProgetto(p.id)}
                            className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 cursor-pointer"
                          >
                            <FolderOpen className="h-3 w-3" />
                            Apri
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDuplicaProgetto(p.id)}
                          title="Duplica progetto"
                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <Copy className="h-3 w-3" />
                          Duplica
                        </button>
                        <button
                          type="button"
                          onClick={() => esportaJsonProgetto(p)}
                          title="Esporta JSON aperto"
                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <Download className="h-3 w-3" />
                          JSON
                        </button>
                        <button
                          type="button"
                          onClick={() => onArchiviaProgetto(p.id)}
                          title={p.archiviato ? 'Ripristina' : 'Archivia'}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <Archive className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Gestione Revisioni, Confronto Versioni & Audit Log */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-blue-700" />
            <h2 className="text-base font-semibold text-slate-900">
              Revisioni Progetto & Confronto Versioni
            </h2>
          </div>

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={noteRevisione}
              onChange={(e) => setNoteRevisione(e.target.value)}
              placeholder="Note per nuova revisione (es. Aggiornamento potenza EVAC)..."
              className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                onCreaNuovaRevisione(
                  noteRevisione.trim() || 'Emissione revisione successiva'
                );
                setNoteRevisione('');
              }}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap cursor-pointer"
            >
              Emetti Nuova Revisione
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {progettoAttivo.revisioni.map((rev) => (
              <div
                key={rev.id}
                className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
              >
                <div>
                  <span className="font-mono font-semibold text-slate-900">
                    {rev.revisione}
                  </span>
                  <span className="mx-1.5 text-slate-400">·</span>
                  <span className="font-mono text-slate-600">{rev.data}</span>
                  <span className="mx-1.5 text-slate-400">·</span>
                  <span className="text-slate-700">{rev.note}</span>
                </div>
                {rev.snapshotJson && (
                  <button
                    type="button"
                    onClick={() => setRevConfrontoId(rev.id)}
                    className={`rounded px-2 py-0.5 text-xs font-medium cursor-pointer ${
                      revConfrontoId === rev.id
                        ? 'bg-blue-700 text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Confronta
                  </button>
                )}
              </div>
            ))}
          </div>

          {diffSummary && (
            <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950">
              <div className="font-semibold">Differenze rispetto alla revisione selezionata:</div>
              <ul className="mt-1 list-disc pl-4 space-y-0.5">
                {diffSummary.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Storico modifiche (RF-03) */}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-blue-700" />
            <h2 className="text-base font-semibold text-slate-900">
              Storico Modifiche Input (Tracciabilità)
            </h2>
          </div>
          <div className="mt-3 max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded">
            {progettoAttivo.auditLog.slice(0, 30).map((entry) => (
              <div key={entry.id} className="px-3 py-2 text-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="font-medium text-slate-700">{entry.autore}</span>
                  <span className="font-mono">{entry.timestamp}</span>
                </div>
                <div className="mt-0.5 text-slate-800">
                  <span className="font-semibold">{entry.sezione}</span> · {entry.campo}:{' '}
                  <span className="font-mono text-slate-500">{entry.valorePrecedente}</span> →{' '}
                  <span className="font-mono font-semibold text-blue-800">
                    {entry.valoreNuovo}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
