import { useEffect, useMemo, useState } from 'react';
import { DesignWorkspace } from './components/DesignWorkspace';
import { ExportView } from './components/ExportView';
import { LibraryAndTemplatesView } from './components/LibraryAndTemplatesView';
import { ProjectsView } from './components/ProjectsView';
import { RulesView } from './components/RulesView';
import { SezioneApp, TopBar } from './components/TopBar';
import { TEMPLATE_PROGETTO_DISPONIBILI } from './data/rulesAndLibrary';
import { calcolaProgettoCompleto } from './engine/calculator';
import { valutaRegoleProgetto } from './engine/ruleEvaluator';
import {
  loadActiveProjectId,
  loadLibrary,
  loadProjects,
  loadTemplates,
  saveActiveProjectId,
  saveLibrary,
  saveProjects,
  saveTemplates,
} from './engine/storage';
import {
  ComponenteLibreria,
  DerogaRegola,
  MappaturaCampoDXF,
  ProgettoAntincendio,
  TemplateTavolaDXF,
} from './types/elettrocad';

export default function App() {
  const [progetti, setProgetti] = useState<ProgettoAntincendio[]>(() =>
    loadProjects()
  );
  const [progettoAttivoId, setProgettoAttivoId] = useState<string>(() =>
    loadActiveProjectId(progetti[0]?.id ?? 'proj-direzionale-01')
  );
  const [templates, setTemplates] = useState<TemplateTavolaDXF[]>(() =>
    loadTemplates()
  );
  const [componenti, setComponenti] = useState<ComponenteLibreria[]>(() =>
    loadLibrary()
  );
  const [sezione, setSezione] = useState<SezioneApp>('progettazione');

  useEffect(() => {
    saveProjects(progetti);
  }, [progetti]);

  useEffect(() => {
    saveActiveProjectId(progettoAttivoId);
  }, [progettoAttivoId]);

  useEffect(() => {
    saveTemplates(templates);
  }, [templates]);

  useEffect(() => {
    saveLibrary(componenti);
  }, [componenti]);

  const progettoAttivo = useMemo(
    () => progetti.find((p) => p.id === progettoAttivoId) ?? progetti[0],
    [progetti, progettoAttivoId]
  );

  const templateAttivo = useMemo(
    () =>
      templates.find((t) => t.id === progettoAttivo?.templateIdAssociato) ??
      templates[0],
    [templates, progettoAttivo?.templateIdAssociato]
  );

  const calcolo = useMemo(
    () => calcolaProgettoCompleto(progettoAttivo),
    [progettoAttivo]
  );

  const esiti = useMemo(
    () => valutaRegoleProgetto(progettoAttivo, calcolo),
    [progettoAttivo, calcolo]
  );

  const aggiornaProgettoAttivo = (
    updater: (prev: ProgettoAntincendio) => ProgettoAntincendio,
    audit?: { sezione: string; campo: string; prevVal: string; newVal: string }
  ) => {
    const oggi = new Date().toISOString().slice(0, 10);
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    setProgetti((prevList) =>
      prevList.map((p) => {
        if (p.id !== progettoAttivo.id) return p;
        const updated = updater(p);
        const newAudit = audit
          ? [
              {
                id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                timestamp: nowStr,
                autore: updated.identificativi.autoreModificaCorrente || updated.identificativi.progettista,
                sezione: audit.sezione,
                campo: audit.campo,
                valorePrecedente: audit.prevVal,
                valoreNuovo: audit.newVal,
              },
              ...updated.auditLog,
            ]
          : updated.auditLog;
        return {
          ...updated,
          ultimoAggiornamento: oggi,
          auditLog: newAudit,
        };
      })
    );
  };

  const handleCreaDaTemplate = (templateId: string) => {
    const found = TEMPLATE_PROGETTO_DISPONIBILI.find((t) => t.id === templateId);
    if (!found) return;
    const nuovo = found.crea();
    const oggi = new Date().toISOString().slice(0, 10);
    const id = `proj-${Date.now()}`;
    const commessa = `COM-2026-${Math.floor(200 + Math.random() * 799)}`;
    const pronto: ProgettoAntincendio = {
      ...nuovo,
      id,
      dataCreazione: oggi,
      ultimoAggiornamento: oggi,
      identificativi: {
        ...nuovo.identificativi,
        commessa,
        revisione: 'Rev. 00',
        data: oggi,
      },
    };
    setProgetti((prev) => [pronto, ...prev]);
    setProgettoAttivoId(id);
    setSezione('progettazione');
  };

  const handleDuplicaProgetto = (id: string) => {
    const src = progetti.find((p) => p.id === id);
    if (!src) return;
    const nuovoId = `proj-dup-${Date.now()}`;
    const copia: ProgettoAntincendio = {
      ...JSON.parse(JSON.stringify(src)),
      id: nuovoId,
      archiviato: false,
      identificativi: {
        ...src.identificativi,
        commessa: `${src.identificativi.commessa}-COP`,
      },
    };
    setProgetti((prev) => [copia, ...prev]);
    setProgettoAttivoId(nuovoId);
  };

  const handleArchiviaProgetto = (id: string) => {
    setProgetti((prev) =>
      prev.map((p) => (p.id === id ? { ...p, archiviato: !p.archiviato } : p))
    );
  };

  const handleCreaNuovaRevisione = (note: string) => {
    const numMatch = progettoAttivo.identificativi.revisione.match(/\d+/);
    const nextNum = numMatch ? Number(numMatch[0]) + 1 : 1;
    const nextRev = `Rev. ${String(nextNum).padStart(2, '0')}`;
    const oggi = new Date().toISOString().slice(0, 10);
    const snapshot = JSON.stringify(progettoAttivo);

    aggiornaProgettoAttivo(
      (p) => ({
        ...p,
        identificativi: { ...p.identificativi, revisione: nextRev, data: oggi },
        revisioni: [
          {
            id: `rev-${Date.now()}`,
            revisione: p.identificativi.revisione,
            data: p.identificativi.data,
            autore: p.identificativi.progettista,
            note,
            snapshotJson: snapshot,
          },
          ...p.revisioni,
        ],
      }),
      {
        sezione: 'Revisioni',
        campo: 'Emissione revisione',
        prevVal: progettoAttivo.identificativi.revisione,
        newVal: nextRev,
      }
    );
  };

  const handleSalvaDeroga = (deroga: DerogaRegola) => {
    aggiornaProgettoAttivo(
      (p) => ({
        ...p,
        deroghe: [
          ...p.deroghe.filter(
            (d) => !(d.regolaId === deroga.regolaId && d.targetId === deroga.targetId)
          ),
          deroga,
        ],
      }),
      {
        sezione: 'Regole Antincendio',
        campo: `Deroga ${deroga.regolaId}`,
        prevVal: 'Attiva',
        newVal: `Derogata: ${deroga.motivazione}`,
      }
    );
  };

  const handleRimuoviDeroga = (regolaId: string, targetId: string) => {
    aggiornaProgettoAttivo(
      (p) => ({
        ...p,
        deroghe: p.deroghe.filter(
          (d) => !(d.regolaId === regolaId && d.targetId === targetId)
        ),
      }),
      {
        sezione: 'Regole Antincendio',
        campo: `Ripristino ${regolaId}`,
        prevVal: 'Derogata',
        newVal: 'Attiva',
      }
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopBar
        sezioneAttiva={sezione}
        onCambiaSezione={setSezione}
        onEsportaRapido={() => setSezione('esportazione')}
      />

      {/* Navigazione compatta mobile */}
      <div className="no-print flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 md:hidden">
        {(
          [
            ['progetti', 'Progetti'],
            ['progettazione', 'Progettazione'],
            ['regole', 'Regole'],
            ['libreria', 'Libreria'],
            ['esportazione', 'Esporta'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSezione(id)}
            className={`rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 ${
              sezione === id
                ? 'bg-blue-700 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {sezione === 'progetti' && (
        <ProjectsView
          progetti={progetti}
          progettoAttivo={progettoAttivo}
          onSelezionaProgetto={(id) => {
            setProgettoAttivoId(id);
            setSezione('progettazione');
          }}
          onCreaDaTemplate={handleCreaDaTemplate}
          onDuplicaProgetto={handleDuplicaProgetto}
          onArchiviaProgetto={handleArchiviaProgetto}
          onImportaProgettoJson={(imp) => {
            setProgetti((prev) => [imp, ...prev]);
            setProgettoAttivoId(imp.id);
          }}
          onCreaNuovaRevisione={handleCreaNuovaRevisione}
          onImportaLineeFoglio={(nuoveLinee) => {
            aggiornaProgettoAttivo(
              (p) => ({ ...p, linee: [...p.linee, ...nuoveLinee] }),
              {
                sezione: 'Importazione',
                campo: 'Importazione foglio',
                prevVal: `${progettoAttivo.linee.length} linee`,
                newVal: `${progettoAttivo.linee.length + nuoveLinee.length} linee`,
              }
            );
          }}
        />
      )}

      {sezione === 'progettazione' && (
        <DesignWorkspace
          progetto={progettoAttivo}
          calcolo={calcolo}
          esiti={esiti}
          template={templateAttivo}
          onAggiornaProgetto={aggiornaProgettoAttivo}
          onVaiARegole={setSezione}
        />
      )}

      {sezione === 'regole' && (
        <RulesView
          progetto={progettoAttivo}
          calcolo={calcolo}
          esiti={esiti}
          onSalvaDeroga={handleSalvaDeroga}
          onRimuoviDeroga={handleRimuoviDeroga}
          onToggleNorma={(codice) =>
            aggiornaProgettoAttivo((p) => ({
              ...p,
              norme: p.norme.map((n) =>
                n.codice === codice ? { ...n, attivo: !n.attivo } : n
              ),
            }))
          }
        />
      )}

      {sezione === 'libreria' && (
        <LibraryAndTemplatesView
          componenti={componenti}
          templates={templates}
          templateAttivoId={templateAttivo.id}
          onTogglePreferitoComponente={(id) =>
            setComponenti((prev) =>
              prev.map((c) =>
                c.id === id ? { ...c, preferito: !c.preferito } : c
              )
            )
          }
          onImportaComponenti={(nuovi) =>
            setComponenti((prev) => [...nuovi, ...prev])
          }
          onAggiungiTemplate={(tpl) => setTemplates((prev) => [tpl, ...prev])}
          onAggiornaMappaturaTemplate={(
            tplId: string,
            mappatura: MappaturaCampoDXF[]
          ) =>
            setTemplates((prev) =>
              prev.map((t) => (t.id === tplId ? { ...t, mappatura } : t))
            )
          }
          onSelezionaTemplateProgetto={(tplId) =>
            aggiornaProgettoAttivo((p) => ({
              ...p,
              templateIdAssociato: tplId,
            }))
          }
        />
      )}

      {sezione === 'esportazione' && (
        <ExportView
          progetto={progettoAttivo}
          calcolo={calcolo}
          esiti={esiti}
          template={templateAttivo}
        />
      )}
    </div>
  );
}
