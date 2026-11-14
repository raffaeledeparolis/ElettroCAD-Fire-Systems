import React, { useRef, useState } from 'react';
import {
  Maximize2,
  MessageSquarePlus,
  RotateCcw,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { AVVISO_RESPONSABILITA_LEGALE } from '../data/rulesAndLibrary';
import { LINEE_PER_TAVOLA } from '../engine/dxfEngine';
import {
  AnnotazioneSchema,
  EsitoVerifica,
  LayoutNodeOverride,
  ProgettoAntincendio,
  RisultatoCalcoloCompleto,
  TemplateTavolaDXF,
} from '../types/elettrocad';

interface SchematicCanvasProps {
  progetto: ProgettoAntincendio;
  calcolo: RisultatoCalcoloCompleto;
  esiti: EsitoVerifica[];
  template: TemplateTavolaDXF;
  lineaSelezionataId: string | null;
  onSelezionaLinea: (id: string) => void;
  onAggiornaOverride: (lineaId: string, ov: LayoutNodeOverride) => void;
  onRipristinaLayout: () => void;
  onAggiungiAnnotazione: (ann: AnnotazioneSchema) => void;
  onEliminaAnnotazione: (id: string) => void;
}

export const SchematicCanvas: React.FC<SchematicCanvasProps> = ({
  progetto,
  calcolo,
  esiti,
  template,
  lineaSelezionataId,
  onSelezionaLinea,
  onAggiornaOverride,
  onRipristinaLayout,
  onAggiungiAnnotazione,
  onEliminaAnnotazione,
}) => {
  const [zoom, setZoom] = useState(0.92);
  const [foglioCorrente, setFoglioCorrente] = useState(1);
  const [modalitaNota, setModalitaNota] = useState(false);
  const [testoNuovaNota, setTestoNuovaNota] = useState('');
  const [dragging, setDragging] = useState<{
    lineaId: string;
    startX: number;
    startY: number;
    origDx: number;
    origDy: number;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const quadro = progetto.quadri[0];
  const linee = progetto.linee;
  const numTavole = Math.max(1, Math.ceil(linee.length / LINEE_PER_TAVOLA));
  const foglioSicuro = Math.min(foglioCorrente, numTavole);
  const sliceLinee = linee.slice(
    (foglioSicuro - 1) * LINEE_PER_TAVOLA,
    foglioSicuro * LINEE_PER_TAVOLA
  );

  const W = 1120;
  const H = 780;
  const busY = 175;
  const colStart = 175;
  const colSpan = sliceLinee.length > 1 ? 820 / (sliceLinee.length - 1) : 0;

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const dx = (e.clientX - dragging.startX) / zoom;
    const dy = (e.clientY - dragging.startY) / zoom;
    onAggiornaOverride(dragging.lineaId, {
      dx: Math.max(-90, Math.min(90, Math.round(dragging.origDx + dx))),
      dy: Math.max(-45, Math.min(45, Math.round(dragging.origDy + dy))),
    });
  };

  const handleSvgPointerUp = () => {
    setDragging(null);
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!modalitaNota || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * W);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * H);
    const testo =
      testoNuovaNota.trim() || 'Nota tecnica: verificare percorso protetto in opera';
    onAggiungiAnnotazione({
      id: `ann-${Date.now()}`,
      foglio: foglioSicuro,
      x,
      y,
      testo,
    });
    setModalitaNota(false);
    setTestoNuovaNota('');
  };

  const statoLinea = (lineaId: string): 'ok' | 'ko' | 'warn' => {
    const rel = esiti.filter((e) => e.targetId === lineaId);
    if (rel.some((r) => r.stato === 'non_conforme')) return 'ko';
    if (rel.some((r) => r.stato === 'dato_mancante' || r.stato === 'da_verificare'))
      return 'warn';
    return 'ok';
  };

  const annotazioniFoglio = progetto.annotazioni.filter(
    (a) => a.foglio === foglioSicuro
  );

  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-white">
      {/* Barra strumenti disegno */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-900">
            Anteprima Unifilare CAD
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {template.formatoFoglio} {template.orientamento}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">
            Tavola {foglioSicuro}/{numTavole}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {numTavole > 1 && (
            <div className="flex items-center gap-1 rounded border border-slate-200 bg-white p-0.5">
              {Array.from({ length: numTavole }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setFoglioCorrente(i + 1)}
                  className={`rounded px-2 py-1 text-xs font-medium cursor-pointer ${
                    foglioSicuro === i + 1
                      ? 'bg-blue-700 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Tav. {i + 1}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 rounded border border-slate-200 bg-white px-1 py-0.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.55, Number((z - 0.1).toFixed(2))))}
              title="Riduci zoom"
              className="rounded p-1 text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="px-1.5 font-mono text-xs text-slate-700 tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.5, Number((z + 0.1).toFixed(2))))}
              title="Aumenta zoom"
              className="rounded p-1 text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(0.92)}
              title="Adatta vista"
              className="rounded p-1 text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setModalitaNota((m) => !m)}
            className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium cursor-pointer ${
              modalitaNota
                ? 'border-blue-700 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            {modalitaNota ? 'Clicca sul foglio per posare la nota' : 'Aggiungi Nota'}
          </button>

          <button
            type="button"
            onClick={onRipristinaLayout}
            className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Ripristina Posizioni
          </button>
        </div>
      </div>

      {modalitaNota && (
        <div className="flex items-center gap-2 border-b border-blue-200 bg-blue-50 px-4 py-2 text-xs">
          <span className="font-medium text-blue-900">Testo annotazione:</span>
          <input
            type="text"
            value={testoNuovaNota}
            onChange={(e) => setTestoNuovaNota(e.target.value)}
            placeholder="Scrivi il testo della nota tecnica e clicca sullo schema..."
            className="flex-1 rounded border border-blue-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>
      )}

      {/* Viewport Tavola Tecnica */}
      <div className="cad-grid-bg overflow-auto p-4">
        <div
          style={{
            width: `${W * zoom}px`,
            height: `${H * zoom}px`,
            margin: '0 auto',
          }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className={`h-full w-full select-none bg-white shadow-sm ${
              modalitaNota ? 'cursor-crosshair' : 'cursor-default'
            }`}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
            onClick={handleSvgClick}
          >
            {/* Squadratura Foglio */}
            <rect
              x="14"
              y="14"
              width={W - 28}
              height={H - 28}
              fill="none"
              stroke="#0F172A"
              strokeWidth="1.6"
            />
            <rect
              x="22"
              y="22"
              width={W - 44}
              height={H - 44}
              fill="none"
              stroke="#CBD5E1"
              strokeWidth="0.8"
            />

            {/* Intestazione quadro */}
            <text
              x="34"
              y="46"
              fontSize="14"
              fontWeight="700"
              fill="#0F172A"
              fontFamily="Plus Jakarta Sans, sans-serif"
            >
              {quadro ? `${quadro.sigla} — ${quadro.nome}` : 'Quadro Antincendio'}
            </text>
            <text
              x="34"
              y="63"
              fontSize="10"
              fill="#475569"
              fontFamily="JetBrains Mono, monospace"
            >
              Fornitura: {progetto.fornitura.tensioneNominaleV}V{' '}
              {progetto.fornitura.tipoFornitura.toUpperCase()}{' '}
              {progetto.fornitura.sistemaDistribuzione} · Icc:{' '}
              {progetto.fornitura.iccPuntoConsegnaKa ?? 'N.D.'} kA · Quadro:{' '}
              {quadro?.gradoIP ?? 'IP54'} ({quadro?.formaSegregazione ?? 'Forma 2b'})
            </text>

            {/* Linea Preferenziale di Arrivo & Interruttore Generale */}
            <g>
              <rect
                x="44"
                y="84"
                width="178"
                height="44"
                rx="3"
                fill={quadro?.alimentazionePreferenzialeAMonte ? '#EFF6FF' : '#FEF2F2'}
                stroke={quadro?.alimentazionePreferenzialeAMonte ? '#1D4ED8' : '#B91C1C'}
                strokeWidth="1.2"
              />
              <text x="54" y="102" fontSize="9.5" fontWeight="700" fill="#0F172A">
                {quadro?.alimentazionePreferenzialeAMonte
                  ? 'ALIMENTAZIONE PREFERENZIALE'
                  : 'ALIMENTAZIONE ORDINARIA'}
              </text>
              <text x="54" y="117" fontSize="8.5" fill="#334155" fontFamily="JetBrains Mono, monospace">
                {quadro?.alimentazionePreferenzialeAMonte
                  ? 'Derivata a monte I.G. (CEI 64-8)'
                  : 'ATTENZIONE: A valle I.G.'}
              </text>

              {/* Conduttore arrivo verso Interruttore Generale */}
              <line x1="133" y1="128" x2="133" y2="175" stroke="#0F172A" strokeWidth="2" />
              <rect
                x="122"
                y="138"
                width="22"
                height="24"
                fill="#FFFFFF"
                stroke="#0F172A"
                strokeWidth="1.5"
              />
              <line x1="126" y1="145" x2="140" y2="155" stroke="#0F172A" strokeWidth="1.5" />
              <text x="150" y="150" fontSize="9" fontWeight="600" fill="#0F172A" fontFamily="JetBrains Mono, monospace">
                Q.GEN {quadro?.interruttoreGeneraleInA ?? 40}A ({quadro?.interruttoreGeneraleIcuKa ?? 16}kA)
              </text>
            </g>

            {/* Sbarra Collettrice Principale */}
            <line x1="90" y1={busY} x2={W - 60} y2={busY} stroke="#1D4ED8" strokeWidth="3.5" />
            <line x1="90" y1={busY + 4} x2={W - 60} y2={busY + 4} stroke="#93C5FD" strokeWidth="1.2" />
            <text
              x="255"
              y={busY - 8}
              fontSize="10"
              fontWeight="600"
              fill="#1D4ED8"
              fontFamily="JetBrains Mono, monospace"
            >
              BARRA PRINCIPALE {quadro?.sigla ?? ''} · In={quadro?.correnteNominaleBarraA ?? 63}A · P_cont=
              {quadro ? calcolo.quadri[quadro.id]?.potenzaContemporaneaKw ?? 0 : 0} kW
            </text>

            {/* Ramo Partenze Utenze */}
            {sliceLinee.map((linea, idx) => {
              const baseX = sliceLinee.length === 1 ? 420 : colStart + idx * colSpan;
              const ov = progetto.layoutOverrides[linea.id] ?? { dx: 0, dy: 0 };
              const cx = baseX + ov.dx;
              const topY = busY;
              const symY = 335 + ov.dy;
              const res = calcolo.linee[linea.id];
              const st = statoLinea(linea.id);
              const selected = lineaSelezionataId === linea.id;
              const strokeCol =
                st === 'ko' ? '#B91C1C' : st === 'warn' ? '#B45309' : '#0F172A';

              return (
                <g
                  key={linea.id}
                  onClick={(e) => {
                    if (modalitaNota) return;
                    e.stopPropagation();
                    onSelezionaLinea(linea.id);
                  }}
                  onPointerDown={(e) => {
                    if (modalitaNota) return;
                    e.stopPropagation();
                    onSelezionaLinea(linea.id);
                    setDragging({
                      lineaId: linea.id,
                      startX: e.clientX,
                      startY: e.clientY,
                      origDx: ov.dx,
                      origDy: ov.dy,
                    });
                  }}
                  className="cursor-grab active:cursor-grabbing"
                >
                  {/* Evidenziazione selezione */}
                  {selected && (
                    <rect
                      x={cx - 48}
                      y={topY + 12}
                      width="96"
                      height={symY - topY + 34}
                      rx="4"
                      fill="rgba(29, 78, 216, 0.05)"
                      stroke="#1D4ED8"
                      strokeDasharray="4 3"
                      strokeWidth="1.2"
                    />
                  )}

                  {/* Nodo su sbarra */}
                  <circle cx={baseX} cy={busY} r="4" fill="#1D4ED8" />
                  <polyline
                    points={`${baseX},${busY} ${baseX},${busY + 18} ${cx},${busY + 18} ${cx},${topY + 36}`}
                    fill="none"
                    stroke={strokeCol}
                    strokeWidth="1.6"
                  />

                  {/* Interruttore di protezione (CEI 60617) */}
                  <rect
                    x={cx - 12}
                    y={topY + 36}
                    width="24"
                    height="34"
                    fill="#FFFFFF"
                    stroke={st === 'ko' ? '#B91C1C' : '#15803D'}
                    strokeWidth="1.6"
                  />
                  <line
                    x1={cx - 6}
                    y1={topY + 45}
                    x2={cx + 6}
                    y2={topY + 58}
                    stroke="#0F172A"
                    strokeWidth="1.6"
                  />
                  {linea.tipoProtezione === 'magnetotermico_differenziale' && (
                    <ellipse
                      cx={cx}
                      cy={topY + 64}
                      rx="7"
                      ry="3"
                      fill="none"
                      stroke="#1D4ED8"
                      strokeWidth="1.2"
                    />
                  )}

                  {/* Etichetta protezione */}
                  <text
                    x={cx + 16}
                    y={topY + 50}
                    fontSize="8.5"
                    fontWeight="600"
                    fill="#0F172A"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {res ? `${res.protezioneSceltaInA}A ${linea.curvaProtezione}` : ''}
                  </text>
                  <text
                    x={cx + 16}
                    y={topY + 62}
                    fontSize="7.8"
                    fill="#475569"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {linea.differenzialeIdnMa ? `${linea.differenzialeIdnMa}mA` : `Icu ${linea.protezioneIcuKa}kA`}
                  </text>

                  {/* Linea verso utenza */}
                  <line
                    x1={cx}
                    y1={topY + 70}
                    x2={cx}
                    y2={symY - 22}
                    stroke={strokeCol}
                    strokeWidth="1.6"
                  />

                  {/* Etichette cavo & ΔV lungo la linea */}
                  <text
                    x={cx + 6}
                    y={topY + 100}
                    fontSize="8"
                    fill="#334155"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {res ? `${res.sezioneSceltaMm2}mm² ${linea.resistenzaFuocoCavoScelto}` : ''}
                  </text>
                  <text
                    x={cx + 6}
                    y={topY + 114}
                    fontSize="8"
                    fill={res && res.cadutaTensionePct > 4 ? '#B91C1C' : '#475569'}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {res ? `Ib ${res.correnteImpiegoIbA}A · ΔV ${res.cadutaTensionePct}%` : ''}
                  </text>

                  {/* Blocco utenza (D.M. 30/11/1983 / ISO 7010) */}
                  <rect
                    x={cx - 32}
                    y={symY - 22}
                    width="64"
                    height="36"
                    rx="3"
                    fill={
                      linea.tipoUtenza.includes('irai') || linea.tipoUtenza.includes('evac')
                        ? '#FEF2F2'
                        : '#EFF6FF'
                    }
                    stroke={
                      linea.tipoUtenza.includes('irai') || linea.tipoUtenza.includes('evac')
                        ? '#B91C1C'
                        : '#1D4ED8'
                    }
                    strokeWidth="1.8"
                  />
                  <text
                    x={cx}
                    y={symY - 6}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill={
                      linea.tipoUtenza.includes('irai') || linea.tipoUtenza.includes('evac')
                        ? '#B91C1C'
                        : '#1D4ED8'
                    }
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {linea.sigla}
                  </text>
                  <text
                    x={cx}
                    y={symY + 7}
                    textAnchor="middle"
                    fontSize="8"
                    fill="#334155"
                  >
                    {linea.potenzaNominaleW} W
                  </text>

                  {/* Collegamento verticale verso colonna tabella dati */}
                  <line
                    x1={cx}
                    y1={symY + 14}
                    x2={cx}
                    y2={415}
                    stroke="#CBD5E1"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                </g>
              );
            })}

            {/* Annotazioni manuali posizionate dall'utente */}
            {annotazioniFoglio.map((ann) => (
              <g key={ann.id}>
                <rect
                  x={ann.x}
                  y={ann.y}
                  width={Math.min(280, Math.max(120, ann.testo.length * 5.6 + 26))}
                  height="24"
                  rx="3"
                  fill="#FEFCE8"
                  stroke="#CA8A04"
                  strokeWidth="1"
                />
                <text x={ann.x + 8} y={ann.y + 15} fontSize="9" fill="#713F12">
                  {ann.testo}
                </text>
                <g
                  onClick={(e) => {
                    e.stopPropagation();
                    onEliminaAnnotazione(ann.id);
                  }}
                  className="cursor-pointer"
                >
                  <circle
                    cx={ann.x + Math.min(280, Math.max(120, ann.testo.length * 5.6 + 26)) - 10}
                    cy={ann.y + 12}
                    r="6"
                    fill="#FEF08A"
                  />
                  <text
                    x={ann.x + Math.min(280, Math.max(120, ann.testo.length * 5.6 + 26)) - 10}
                    y={ann.y + 15}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="700"
                    fill="#854D0E"
                  >
                    ×
                  </text>
                </g>
              </g>
            ))}

            {/* Tabella Dati Sotto lo Schema (RF-21) */}
            <g transform="translate(30, 418)">
              <rect
                x="0"
                y="0"
                width={W - 60}
                height="242"
                fill="#F8FAFC"
                stroke="#64748B"
                strokeWidth="1"
              />
              {[
                'SIGLA',
                'DESCRIZIONE UTENZA',
                'POTENZA (W)',
                'CORRENTE Ib (A)',
                'COS φ / η',
                'PROTEZIONE',
                'CADUTA ΔV (%)',
                'CAVO & CLASSE CPR',
                'POSA & PORTATA Iz',
              ].map((label, rIdx) => {
                const rowY = rIdx * 26.8;
                return (
                  <g key={label}>
                    <line
                      x1="0"
                      y1={rowY}
                      x2={W - 60}
                      y2={rowY}
                      stroke="#CBD5E1"
                      strokeWidth="0.8"
                    />
                    <rect x="0" y={rowY} width="125" height="26.8" fill="#F1F5F9" />
                    <text
                      x="8"
                      y={rowY + 17}
                      fontSize="8.2"
                      fontWeight="700"
                      fill="#334155"
                    >
                      {label}
                    </text>
                    {sliceLinee.map((linea, idx) => {
                      const baseX =
                        (sliceLinee.length === 1 ? 420 : colStart + idx * colSpan) - 30;
                      const res = calcolo.linee[linea.id];
                      const valore = [
                        linea.sigla,
                        linea.descrizione.slice(0, 20),
                        `${linea.potenzaNominaleW} W`,
                        res ? `${res.correnteImpiegoIbA.toFixed(2)} A` : '—',
                        `${linea.cosPhi.toFixed(2)} / ${linea.rendimento.toFixed(2)}`,
                        res ? `${res.protezioneSceltaInA}A ${linea.curvaProtezione}` : '—',
                        res ? `${res.cadutaTensionePct.toFixed(2)}%` : '—',
                        res ? `${res.sezioneSceltaMm2}mm² ${linea.resistenzaFuocoCavoScelto}` : '—',
                        res ? `Iz ${res.portataCorrettaIzA} A` : '—',
                      ][rIdx];

                      return (
                        <text
                          key={`${linea.id}-${rIdx}`}
                          x={baseX}
                          y={rowY + 17}
                          textAnchor="middle"
                          fontSize={rIdx === 0 ? '9.5' : '8.2'}
                          fontWeight={rIdx === 0 ? '700' : '500'}
                          fill={rIdx === 0 ? '#1D4ED8' : '#0F172A'}
                          fontFamily={rIdx === 1 ? 'Public Sans, sans-serif' : 'JetBrains Mono, monospace'}
                        >
                          {valore}
                        </text>
                      );
                    })}
                  </g>
                );
              })}
              <line x1="125" y1="0" x2="125" y2="242" stroke="#64748B" strokeWidth="1" />
            </g>

            {/* Cartiglio Tecnico (RF-22 & RF-51) + Avviso Responsabilità (Sez. 9) */}
            <g transform={`translate(30, ${H - 96})`}>
              {/* Avviso legale */}
              <rect
                x="0"
                y="0"
                width={W - 550}
                height="66"
                fill="#FEF2F2"
                stroke="#FCA5A5"
                strokeWidth="0.9"
              />
              <text x="10" y="15" fontSize="8" fontWeight="700" fill="#991B1B">
                RESPONSABILITÀ DEL PROGETTISTA ABILITATO & TRACCIABILITÀ
              </text>
              <text x="10" y="29" fontSize="7.5" fill="#7F1D1D">
                {AVVISO_RESPONSABILITA_LEGALE.slice(0, 96)}
              </text>
              <text x="10" y="40" fontSize="7.5" fill="#7F1D1D">
                {AVVISO_RESPONSABILITA_LEGALE.slice(96, 194)}
              </text>
              <text x="10" y="54" fontSize="7.5" fontWeight="600" fill="#334155" fontFamily="JetBrains Mono, monospace">
                App {calcolo.versioneApp} · Regole {calcolo.versioneRegole} · Libreria {calcolo.versioneLibreria}
              </text>

              {/* Cartiglio */}
              <g transform={`translate(${W - 540}, 0)`}>
                <rect
                  x="0"
                  y="0"
                  width="480"
                  height="66"
                  fill="#FFFFFF"
                  stroke="#0F172A"
                  strokeWidth="1.3"
                />
                <line x1="0" y1="33" x2="480" y2="33" stroke="#0F172A" strokeWidth="0.8" />
                <line x1="315" y1="0" x2="315" y2="66" stroke="#0F172A" strokeWidth="0.8" />
                <text x="10" y="14" fontSize="8" fontWeight="700" fill="#1D4ED8">
                  {progetto.identificativi.logoTestoStudio}
                </text>
                <text x="10" y="26" fontSize="9.5" fontWeight="700" fill="#0F172A">
                  {progetto.identificativi.titoloTavola.slice(0, 48)}
                </text>
                <text x="10" y="46" fontSize="8" fill="#334155">
                  Cliente: {progetto.identificativi.cliente} · Commessa: {progetto.identificativi.commessa}
                </text>
                <text x="10" y="59" fontSize="8" fill="#334155">
                  Progettista: {progetto.identificativi.progettista}
                </text>

                <text x="325" y="15" fontSize="8" fontWeight="600" fill="#0F172A" fontFamily="JetBrains Mono, monospace">
                  Rev: {progetto.identificativi.revisione}
                </text>
                <text x="325" y="27" fontSize="8" fill="#475569" fontFamily="JetBrains Mono, monospace">
                  Data: {progetto.identificativi.data}
                </text>
                <text x="325" y="46" fontSize="8" fill="#0F172A" fontFamily="JetBrains Mono, monospace">
                  Tavola: {foglioSicuro}/{numTavole} ({template.formatoFoglio})
                </text>
                <text x="325" y="59" fontSize="7.5" fill="#475569" fontFamily="JetBrains Mono, monospace">
                  Scala: {progetto.identificativi.scala}
                </text>
              </g>
            </g>
          </svg>
        </div>
      </div>

      {/* Lista annotazioni esistenti per rapida gestione */}
      {annotazioniFoglio.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs">
          <span className="font-medium text-slate-600">Annotazioni sulla tavola:</span>
          {annotazioniFoglio.map((ann) => (
            <span
              key={ann.id}
              className="inline-flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-900"
            >
              <span>{ann.testo}</span>
              <button
                type="button"
                onClick={() => onEliminaAnnotazione(ann.id)}
                className="text-amber-700 hover:text-red-700 cursor-pointer"
                title="Elimina annotazione"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
