import { cn } from '../../lib/cn.js';

/**
 * Botão do design system Soft Dashboard.
 * Confortável e de fácil leitura: altura generosa (alvo de toque ≥ 44px),
 * cantos arredondados, contraste elevado e microinteração sutil no clique.
 * O texto nunca quebra em várias linhas dentro do botão.
 *
 * @param {Object} props Propriedades do botão.
 * @param {React.ReactNode} props.children Conteúdo do botão.
 * @param {('primary'|'secondary'|'success'|'warning'|'danger'|'ghost'|'outline')} [props.variant] Variante visual.
 * @param {('sm'|'md'|'lg')} [props.size] Tamanho.
 * @param {string} [props.className] Classes extras.
 * @param {Function} [props.onClick] Callback de clique.
 * @returns {JSX.Element} Elemento botão.
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold leading-none ' +
    'select-none transition-all duration-150 ease-out ' +
    'disabled:opacity-50 disabled:cursor-not-allowed ' +
    'active:scale-[0.98]';

  const sizes = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-12 px-5 text-base',
    lg: 'h-14 px-6 text-lg',
  };

  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary-hover shadow-sm',
    success: 'bg-success text-white hover:opacity-90 shadow-sm',
    warning: 'bg-warning text-white hover:opacity-90 shadow-sm',
    danger: 'bg-danger text-white hover:opacity-90 shadow-sm',
    ghost: 'bg-transparent text-primary hover:bg-primary-soft',
    outline: 'border border-border bg-surface text-primary hover:border-primary hover:bg-primary-soft',
  };

  return (
    <button type={type} className={cn(base, sizes[size], variants[variant], className)} {...props}>
      {children}
    </button>
  );
}