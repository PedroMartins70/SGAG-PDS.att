import { cn } from '../../lib/cn.js';

/**
 * Mascote lúdica do sistema: a Coruja "Sabedoria".
 * Ilustração SVG própria (sem dependências), suave e acolhedora.
 *
 * @param {Object} props Propriedades do mascote.
 * @param {string} [props.className] Classes extras (controla o tamanho).
 * @returns {JSX.Element} Elemento SVG da coruja.
 */
export default function Mascot({ className = '' }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn('h-16 w-16', className)}
      role="img"
      aria-label="Coruja Sabedoria"
    >
      <circle cx="50" cy="50" r="46" fill="#DBEAFE" />
      {/* corpo */}
      <path d="M25 46c0-13 11-22 25-22s25 9 25 22c0 17-11 27-25 27S25 63 25 46Z" fill="#2563EB" />
      {/* asas */}
      <path d="M22 42c-7 2-10 8-8 15 1 6 5 10 10 11l-3-13Z" fill="#1D4ED8" />
      <path d="M78 42c7 2 10 8 8 15-1 6-5 10-10 11l3-13Z" fill="#1D4ED8" />
      {/* olhos */}
      <circle cx="37" cy="45" r="9.5" fill="#F8FAFC" />
      <circle cx="63" cy="45" r="9.5" fill="#F8FAFC" />
      <circle cx="37" cy="45" r="3.6" fill="#1E293B" />
      <circle cx="63" cy="45" r="3.6" fill="#1E293B" />
      {/* bico */}
      <path d="M46 52h8l-4 6Z" fill="#F59E0B" />
      {/* livro nas asas */}
      <path d="M38 62h24v4H38Z" rx="2" fill="#F8FAFC" />
      <path d="M50 62v4" stroke="#10B981" strokeWidth="2" />
    </svg>
  );
}
