import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  HelpCircle,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import {
  AVVISO_RESPONSABILITA_LEGALE,
  REGOLE_ANTINCENDIO_CATALOGO,
  VERSIONE_REGOLE,
} from '../data/rulesAndLibrary';
import {
  EsitoTestRegressione,
  eseguiTestRegressione,
} from '../engine/ruleEvaluator';
import {
  DerogaRegola,
  EsitoVerifica,
  ProgettoAntincendio,
  RisultatoCalcoloCompleto,
  StatoVerifica,
} from '../types/elettrocad';

interface RulesViewProps {
  progetto: ProgettoAntincendio;
  calcolo: RisultatoCalcoloCompleto;
  esiti: EsitoVerifica[];
  onSalvaDeroga: (deroga: DerogaRegola) => void;
  onRimuoviDeroga: (regolaId: string, targetId: string) => void;
  onToggleNorma: (codice: string) => void;
}

export const RulesView: React.FC<RulesViewProps> = ({
  progetto,
  calcolo,
  esiti,
  onSalvaDeroga,
  onRimuoviDeroga,
  onToggleNorma,
}) => {
  const [filtroStato, setFiltroStato] = useState<'tutti' | StatoVerifica>('tutti');
  const [derogaForm, setDerogaForm] = useState<{
    regolaId: string;
    targetId: string;
    targetLabel: string;
  } | null>(null);
  const [motivazione, setMotivazione] = useState('');
  const [testRisultati, setTestRisultati] = useState<EsitoTestRegressione[] | null>(
    null
  );

  const esitiFiltrati = esiti.filter((e) =>
    filtroStato === 'tutti' ? true : e.stato === filtroStato
  );

  const conta = (st: StatoVerifica) => esiti.filter((e) => e.stato === st).length;

  const badgeStato = (st: StatoVerifica, derogata: boolean) => {
    if (derogata) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5" />
          Derogata (Da verificare)
        </span>
      );
    }
    switch (st) {
      case 'conforme':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Conforme
          </span>
        );
      case 'non_conforme':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
            <XCircle className="h-3.5 w-3.5" />
            Non conforme
          </span>
        );
      case 'dato_mancante':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
            <HelpCircle className="h-3.5 w-3.5" />
            Dato mancante
          </span>
        );
      case 'da_verificare':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Da verificare
          </span>
        );
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-6">
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
          <div>
            <span className="font-semibold">{AVVISO_RESPONSABILITA_LEGALE}</span>
            <span className="ml-2 font-mono text-red-800">
              Versione Motore Regole: {VERSIONE_REGOLE}
            </span>
          </div>
        </div>
      </div>

      {/* Riepilogo Verifiche */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Verifiche Conformi</div>
          <div className="mt-1 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
            {conta('conforme')}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Non Conformi</div>
          <div className="mt-1 font-mono text-2xl font-bold text-red-700 tabular-nums">
            {conta('non_conforme')}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Dati Mancanti</div>
          <div className="mt-1 font-mono text-2xl font-bold text-amber-700 tabular-nums">
            {conta('dato_mancante')}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Da Verificare / Deroghe</div>
          <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {conta('da_verificare')}
          </div>
        </div>
      </div>

      {/* Tabella Esiti Verifiche */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Registro Verifiche Normative e Deroghe Motivate
            </h2>
            <p className="text-xs text-slate-600">
              Ogni verifica riporta formula applicata, riferimento normativo e consente deroga motivata per la relazione tecnica.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-md bg-slate-100 p-1">
            {(
              [
                ['tutti', 'Tutte'],
                ['non_conforme', 'Non conformi'],
                ['dato_mancante', 'Dati mancanti'],
                ['conforme', 'Conformi'],
              ] as const
            ).map(([val, lbl]) => (
              <button
                key={val}
                type="button"
                onClick={() => setFiltroStato(val)}
                className={`rounded px-2.5 py-1 text-xs font-medium cursor-pointer ${
                  filtroStato === val
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-2.5">Regola</th>
                <th className="px-4 py-2.5">Oggetto</th>
                <th className="px-4 py-2.5">Esito</th>
                <th className="px-4 py-2.5">Valore Calcolato vs Soglia</th>
                <th className="px-4 py-2.5">Formula / Norma</th>
                <th className="px-4 py-2.5 text-right">Deroga</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {esitiFiltrati.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                    {e.codice}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {e.targetLabel}
                    <div className="text-[11px] font-normal text-slate-500">
                      {e.titolo}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {badgeStato(e.stato, e.derogata)}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-800">
                    <div>{e.valoreCalcolato}</div>
                    <div className="text-[11px] text-slate-500">
                      Atteso: {e.sogliaAttesa}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-[11px] text-slate-700">
                      {e.formula}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {e.normaRiferimento}
                    </div>
                    {e.derogata && e.motivazioneDeroga && (
                      <div className="mt-1 text-[11px] font-medium text-amber-800">
                        Motivazione deroga: {e.motivazioneDeroga}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {e.derogata ? (
                      <button
                        type="button"
                        onClick={() => onRimuoviDeroga(e.regolaId, e.targetId)}
                        className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        Ripristina Regola
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setDerogaForm({
                            regolaId: e.regolaId,
                            targetId: e.targetId,
                            targetLabel: e.targetLabel,
                          });
                          setMotivazione('');
                        }}
                        className="rounded border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 cursor-pointer"
                      >
                        Deroga con Motivazione
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {derogaForm && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-950">
            Inserisci Motivazione Scritta per Deroga ({derogaForm.targetLabel})
          </h3>
          <p className="mt-1 text-xs text-amber-900">
            La motivazione sarà registrata nel progetto e inclusa nella Relazione Tecnica di Calcolo.
          </p>
          <textarea
            rows={2}
            value={motivazione}
            onChange={(e) => setMotivazione(e.target.value)}
            placeholder="Es. Valutazione rischio specifica concordata con comando VV.F. / prescrizione costruttore..."
            className="mt-2 w-full rounded-md border border-amber-300 bg-white p-2 text-xs text-slate-900 focus:outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDerogaForm(null)}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="button"
              disabled={motivazione.trim().length < 5}
              onClick={() => {
                onSalvaDeroga({
                  regolaId: derogaForm.regolaId,
                  targetId: derogaForm.targetId,
                  disattivata: true,
                  motivazione: motivazione.trim(),
                  autore: progetto.identificativi.progettista,
                  data: new Date().toISOString().slice(0, 10),
                });
                setDerogaForm(null);
              }}
              className="rounded bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
            >
              Conferma Deroga
            </button>
          </div>
        </div>
      )}

      {/* Suite di Test di Regressione (Sezione 8.1) & Elenco Norme */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Suite di Test di Regressione (Casi di Riferimento)
              </h2>
              <p className="text-xs text-slate-600">
                Confronta i risultati del motore di calcolo rispetto ai casi calcolati manualmente (Sezione 8.1 e 12).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTestRisultati(eseguiTestRegressione())}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              Esegui Suite Test
            </button>
          </div>

          {testRisultati && (
            <div className="mt-4 space-y-2">
              {testRisultati.map((t) => (
                <div
                  key={t.id}
                  className="rounded border border-slate-200 bg-slate-50 p-3 text-xs"
                >
                  <div className="flex items-center justify-between font-semibold text-slate-900">
                    <span>{t.titolo}</span>
                    <span
                      className={
                        t.superato ? 'text-emerald-700' : 'text-red-700'
                      }
                    >
                      {t.superato
                        ? `SUPERATO (scarto ${t.scartoPct}%)`
                        : `FALLITO (scarto ${t.scartoPct}%)`}
                    </span>
                  </div>
                  <div className="mt-1 text-slate-600">{t.riferimentoManuale}</div>
                  <div className="mt-1 font-mono text-[11px] text-slate-800">
                    Atteso: {t.atteso} · Calcolato: {t.calcolato}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">
            Riferimenti Normativi ed Edizioni Registrati nel Progetto
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Elenco delle norme applicabili alla data del progetto ({REGOLE_ANTINCENDIO_CATALOGO.length} regole dichiarative collegate).
          </p>
          <div className="mt-3 max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded">
            {progetto.norme.map((n) => (
              <label
                key={n.codice}
                className="flex items-start gap-2.5 px-3 py-2 text-xs cursor-pointer hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={n.attivo}
                  onChange={() => onToggleNorma(n.codice)}
                  className="mt-0.5 rounded border-slate-300"
                />
                <div>
                  <span className="font-semibold text-slate-900">{n.codice}</span>
                  <span className="mx-1.5 text-slate-400">·</span>
                  <span className="font-mono text-slate-600">{n.edizione}</span>
                  <div className="text-slate-600">{n.titolo}</div>
                </div>
              </label>
            ))}
          </div>
          <div className="mt-3 text-xs text-slate-500 font-mono">
            Motore Calcolo: App {calcolo.versioneApp} · Libreria {calcolo.versioneLibreria}
          </div>
        </section>
      </div>
    </div>
  );
};
