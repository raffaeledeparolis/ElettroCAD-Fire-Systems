import React from 'react';

interface SymbolSvgProps {
  codice: string;
  size?: number;
  className?: string;
}

export const SymbolSvg: React.FC<SymbolSvgProps> = ({
  codice,
  size = 36,
  className = '',
}) => {
  const s = size;
  switch (codice) {
    case 'DM83-CENTRALE':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40" className={className}>
          <rect x="4" y="8" width="32" height="24" fill="#FEF2F2" stroke="#B91C1C" strokeWidth="2" />
          <line x1="4" y1="15" x2="36" y2="15" stroke="#B91C1C" strokeWidth="1.2" />
          <text x="20" y="27" textAnchor="middle" fontSize="9" fontWeight="700" fill="#B91C1C">
            IRAI
          </text>
        </svg>
      );
    case 'DM83-RIVELATORE':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40" className={className}>
          <circle cx="20" cy="20" r="13" fill="#FEF2F2" stroke="#B91C1C" strokeWidth="2" />
          <circle cx="20" cy="20" r="3.5" fill="#B91C1C" />
          <line x1="20" y1="7" x2="20" y2="13" stroke="#B91C1C" strokeWidth="1.5" />
        </svg>
      );
    case 'DM83-PULSANTE':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40" className={className}>
          <rect x="7" y="7" width="26" height="26" fill="#DC2626" stroke="#991B1B" strokeWidth="2" />
          <circle cx="20" cy="20" r="6" fill="#FFFFFF" />
          <circle cx="20" cy="20" r="2.5" fill="#DC2626" />
        </svg>
      );
    case 'DM83-SIRENA':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40" className={className}>
          <polygon points="8,15 18,15 28,8 28,32 18,25 8,25" fill="#FEF2F2" stroke="#B91C1C" strokeWidth="2" />
          <path d="M31 14 Q35 20 31 26" fill="none" stroke="#B91C1C" strokeWidth="2" />
        </svg>
      );
    case 'ISO7010-F005':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40" className={className}>
          <rect x="4" y="4" width="32" height="32" rx="3" fill="#DC2626" />
          <circle cx="20" cy="20" r="8" fill="none" stroke="#FFFFFF" strokeWidth="2" />
          <line x1="20" y1="8" x2="20" y2="14" stroke="#FFFFFF" strokeWidth="2" />
          <circle cx="20" cy="20" r="2.5" fill="#FFFFFF" />
        </svg>
      );
    case 'ISO7010-W012':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40" className={className}>
          <polygon points="20,5 36,34 4,34" fill="#FACC15" stroke="#0F172A" strokeWidth="2" />
          <polygon points="21,13 15,23 20,23 18,31 26,20 21,20" fill="#0F172A" />
        </svg>
      );
    case 'ISO7010-E001':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40" className={className}>
          <rect x="4" y="8" width="32" height="24" rx="2" fill="#FEF2F2" stroke="#B91C1C" strokeWidth="2" />
          <polygon points="10,16 17,16 24,11 24,29 17,24 10,24" fill="#B91C1C" />
          <path d="M28 15 Q32 20 28 25" fill="none" stroke="#B91C1C" strokeWidth="2" />
        </svg>
      );
    case 'CEI60617-MTD':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40" className={className}>
          <line x1="20" y1="3" x2="20" y2="12" stroke="#0F172A" strokeWidth="2" />
          <line x1="20" y1="28" x2="20" y2="37" stroke="#0F172A" strokeWidth="2" />
          <line x1="20" y1="28" x2="13" y2="14" stroke="#0F172A" strokeWidth="2" />
          <line x1="17" y1="11" x2="23" y2="15" stroke="#0F172A" strokeWidth="1.5" />
          <ellipse cx="20" cy="31" rx="6" ry="2.5" fill="none" stroke="#1D4ED8" strokeWidth="1.5" />
        </svg>
      );
    case 'CEI60617-UPS':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40" className={className}>
          <rect x="5" y="7" width="30" height="26" fill="#EFF6FF" stroke="#1D4ED8" strokeWidth="2" />
          <line x1="5" y1="33" x2="35" y2="7" stroke="#1D4ED8" strokeWidth="1.5" />
          <text x="13" y="18" fontSize="8" fontWeight="700" fill="#1D4ED8">~</text>
          <text x="25" y="29" fontSize="8" fontWeight="700" fill="#1D4ED8">=</text>
        </svg>
      );
    case 'CEI60617-BAT':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40" className={className}>
          <rect x="5" y="9" width="30" height="22" fill="#F8FAFC" stroke="#0F172A" strokeWidth="1.8" />
          <line x1="15" y1="13" x2="15" y2="27" stroke="#0F172A" strokeWidth="2.5" />
          <line x1="20" y1="16" x2="20" y2="24" stroke="#0F172A" strokeWidth="1.5" />
          <line x1="25" y1="13" x2="25" y2="27" stroke="#0F172A" strokeWidth="2.5" />
        </svg>
      );
    default:
      // CEI60617-MT
      return (
        <svg width={s} height={s} viewBox="0 0 40 40" className={className}>
          <line x1="20" y1="3" x2="20" y2="12" stroke="#0F172A" strokeWidth="2" />
          <line x1="20" y1="28" x2="20" y2="37" stroke="#0F172A" strokeWidth="2" />
          <line x1="20" y1="28" x2="13" y2="14" stroke="#0F172A" strokeWidth="2" />
          <line x1="17" y1="11" x2="23" y2="15" stroke="#0F172A" strokeWidth="1.5" />
        </svg>
      );
  }
};
