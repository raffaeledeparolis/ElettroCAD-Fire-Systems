import React from 'react';

export type SezioneApp = 'progetti' | 'progettazione' | 'regole' | 'libreria' | 'esportazione';

interface TopBarProps {
  sezioneAttiva: SezioneApp;
  onCambiaSezione: (sezione: SezioneApp) => void;
  onEsportaRapido: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  sezioneAttiva,
  onCambiaSezione,
  onEsportaRapido,
}) => {
  const voci: Array<{ id: SezioneApp; label: string }> = [
    { id: 'progetti', label: 'Progetti' },
    { id: 'progettazione', label: 'Progettazione' },
    { id: 'regole', label: 'Regole e Verifiche' },
    { id: 'libreria', label: 'Libreria e Template' },
    { id: 'esportazione', label: 'Esportazione' },
  ];

  return (
    <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-8 border-b border-slate-200 bg-white px-6 py-3.5">
      <button
        type="button"
        onClick={() => onCambiaSezione('progettazione')}
        className="text-left text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
      >
        ElettroCAD Fire Systems
      </button>

      <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
        {voci.map((v) => {
          const active = sezioneAttiva === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onCambiaSezione(v.id)}
              className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors cursor-pointer ${
                active
                  ? 'border-b-2 border-blue-700 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {v.label}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onEsportaRapido}
          className="rounded-md bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
        >
          Esporta Elaborati
        </button>
      </div>
    </header>
  );
};
