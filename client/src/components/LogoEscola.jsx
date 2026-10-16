/**
 * Logo da escola (CEMI) exibida no canto superior esquerdo.
 * Fica sobre um fundo branco para continuar visível no tema escuro.
 *
 * @param {Object} props Propriedades.
 * @param {string} [props.className] Classes de tamanho (padrão: h-10 w-10).
 * @returns {JSX.Element} Logo da escola.
 */
export default function LogoEscola({ className = 'h-10 w-10' }) {
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-sm ${className}`}>
      <img src="/logo-cemi.png" alt="Logo do CEMI" className="h-full w-full object-contain" />
    </div>
  );
}