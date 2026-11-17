import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, X } from 'lucide-react';

/** Quanto tempo (ms) o aviso fica na tela antes de sumir sozinho. */
const DURACAO_PADRAO = 4000;

/** Máximo de avisos na tela ao mesmo tempo (o mais antigo sai). */
const MAXIMO_NA_TELA = 3;

const ToastContext = createContext(null);

/** Estilo de cada tipo de aviso (usa as mesmas cores dos avisos que já existem no sistema). */
const TIPOS = {
  sucesso: {
    icone: CheckCircle,
    classe: 'border-success-soft bg-success-soft text-success',
  },
  erro: {
    icone: AlertCircle,
    classe: 'border-danger-soft bg-danger-soft text-danger',
  },
};

/**
 * Provedor de avisos. Fica no topo da aplicação (App.jsx), acima das rotas,
 * por isso o aviso continua visível mesmo depois que uma tela ou um modal fecha.
 *
 * @param {Object} props Propriedades.
 * @param {React.ReactNode} props.children Aplicação.
 * @returns {JSX.Element} Provedor com a área onde os avisos aparecem.
 */
export function ToastProvider({ children }) {
  const [avisos, setAvisos] = useState([]);
  const proximoId = useRef(1);
  const timers = useRef(new Map());

  const remover = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setAvisos((atuais) => atuais.filter((aviso) => aviso.id !== id));
  }, []);

  const mostrar = useCallback(
    (texto, tipo = 'sucesso', duracao = DURACAO_PADRAO) => {
      const id = proximoId.current++;
      setAvisos((atuais) => [...atuais.slice(-(MAXIMO_NA_TELA - 1)), { id, texto, tipo }]);
      timers.current.set(
        id,
        setTimeout(() => remover(id), duracao)
      );
      return id;
    },
    [remover]
  );

  // Ao desmontar, cancela os temporizadores pendentes
  useEffect(() => {
    const temporizadores = timers.current;
    return () => {
      temporizadores.forEach((timer) => clearTimeout(timer));
      temporizadores.clear();
    };
  }, []);

  const valor = useMemo(
    () => ({
      sucesso: (texto, duracao) => mostrar(texto, 'sucesso', duracao),
      erro: (texto, duracao) => mostrar(texto, 'erro', duracao),
      remover,
    }),
    [mostrar, remover]
  );

  return (
    <ToastContext.Provider value={valor}>
      {children}

      {/* Área dos avisos: topo da tela, não bloqueia cliques fora dos avisos */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end"
      >
        {avisos.map((aviso) => {
          const config = TIPOS[aviso.tipo] ?? TIPOS.sucesso;
          const Icone = config.icone;
          return (
            <div
              key={aviso.id}
              role={aviso.tipo === 'erro' ? 'alert' : 'status'}
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${config.classe}`}
            >
              <Icone className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 break-words">{aviso.texto}</span>
              <button
                type="button"
                aria-label="Fechar aviso"
                onClick={() => remover(aviso.id)}
                className="shrink-0 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Hook para mostrar avisos em qualquer tela.
 *
 * Exemplo:
 *   const toast = useToast();
 *   toast.sucesso('Perfil cadastrado com sucesso!');
 *   toast.erro('Não foi possível salvar.');
 *
 * @returns {{sucesso: Function, erro: Function, remover: Function}} Funções de aviso.
 * @throws {Error} Se usado fora do ToastProvider.
 */
export function useToast() {
  const contexto = useContext(ToastContext);
  if (!contexto) {
    throw new Error('useToast precisa estar dentro de <ToastProvider>');
  }
  return contexto;
}
