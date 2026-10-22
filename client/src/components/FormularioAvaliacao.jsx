import { Fragment, useEffect, useState } from 'react';
import Button from './ui/Button.jsx';
import {
  BLOCOS,
  ESCALA,
  LIMITE_COMENTARIO,
  TOTAL_MAXIMO,
  calcularTotal,
  formatarNota,
} from '../lib/criteriosAvaliacao.js';

/**
 * Formulário de avaliação bimestral de um grupo.
 *
 * @param {object}   props
 * @param {{notas?: Record<string, number>, comentario?: string}} [props.valoresIniciais]
 *        Avaliação já salva (ou vazio para uma nova).
 * @param {boolean}  [props.somenteLeitura] true para professor, líder e vice-líder.
 * @param {boolean}  [props.salvando]       true enquanto envia ao servidor.
 * @param {(dados: {notas: Record<string, number>, comentario: string}) => void} [props.onSalvar]
 */
export default function FormularioAvaliacao({
  valoresIniciais,
  somenteLeitura = false,
  salvando = false,
  onSalvar,
}) {
  const [notas, setNotas] = useState(valoresIniciais?.notas ?? {});
  const [comentario, setComentario] = useState(valoresIniciais?.comentario ?? '');

  // Atualiza o formulário quando troca de bimestre/grupo (chega outra avaliação)
  const chave = JSON.stringify(valoresIniciais ?? {});
  useEffect(() => {
    setNotas(valoresIniciais?.notas ?? {});
    setComentario(valoresIniciais?.comentario ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const faltando = BLOCOS.filter((bloco) => notas[bloco.id] === undefined);
  const total = calcularTotal(notas);

  function escolher(blocoId, valor) {
    if (somenteLeitura) return;
    setNotas((atual) => ({ ...atual, [blocoId]: valor }));
  }

  function handleSubmit(evento) {
    evento.preventDefault();
    if (somenteLeitura || faltando.length > 0 || !onSalvar) return;
    onSalvar({ notas, comentario: comentario.trim() });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {BLOCOS.map((bloco, indice) => {
        const notaAtual = notas[bloco.id];
        const mostrarGrupo = indice === 0 || BLOCOS[indice - 1].grupo !== bloco.grupo;

        return (
          <Fragment key={bloco.id}>
            {mostrarGrupo && (
              <h2 className="pt-2 font-display text-lg font-bold text-primary">{bloco.grupo}</h2>
            )}

            <section className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-base font-bold text-text">{bloco.titulo}</h3>
                <span className="text-sm font-semibold text-text-muted">
                  Nota: {notaAtual === undefined ? '—' : formatarNota(notaAtual)} / 1,00
                </span>
              </div>

              <p className="mt-3 text-sm font-medium text-text">O que avaliar:</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-text-muted">
                {bloco.criterios.map((criterio) => (
                  <li key={criterio}>{criterio}</li>
                ))}
              </ul>

              <div
                role="radiogroup"
                aria-label={`Nota do bloco ${bloco.titulo}`}
                className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
              >
                {ESCALA.map((opcao) => {
                  const selecionada = notaAtual === opcao.valor;
                  return (
                    <button
                      key={opcao.valor}
                      type="button"
                      role="radio"
                      aria-checked={selecionada}
                      disabled={somenteLeitura}
                      onClick={() => escolher(bloco.id, opcao.valor)}
                      className={[
                        'rounded-xl border px-2 py-2 text-center text-sm transition-colors',
                        selecionada
                          ? 'border-primary bg-primary font-semibold text-white'
                          : 'border-border bg-canvas text-text',
                        somenteLeitura
                          ? selecionada
                            ? 'cursor-default'
                            : 'cursor-default opacity-50'
                          : selecionada
                            ? ''
                            : 'hover:border-primary',
                      ].join(' ')}
                    >
                      <span className="block text-base font-bold">{formatarNota(opcao.valor)}</span>
                      <span className="block text-xs">{opcao.rotulo}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </Fragment>
        );
      })}

      {/* Comentários */}
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <label htmlFor="comentario-avaliacao" className="font-display text-base font-bold text-text">
          Comentários do avaliador
        </label>

        {somenteLeitura ? (
          <p className="mt-3 whitespace-pre-wrap text-sm text-text">
            {comentario || <span className="text-text-muted">Nenhum comentário.</span>}
          </p>
        ) : (
          <>
            <textarea
              id="comentario-avaliacao"
              value={comentario}
              onChange={(e) => setComentario(e.target.value.slice(0, LIMITE_COMENTARIO))}
              maxLength={LIMITE_COMENTARIO}
              rows={6}
              placeholder="Escreva suas observações, avaliações e sugestões para o grupo."
              className="mt-3 w-full rounded-xl border border-border bg-canvas p-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
            />
            <p className="mt-1 text-right text-xs text-text-muted">
              {comentario.length} / {LIMITE_COMENTARIO}
            </p>
          </>
        )}
      </section>

      {/* Total e botão */}
      <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:p-6">
        <div>
          <p className="text-sm text-text-muted">Total</p>
          <p className="font-display text-2xl font-bold text-primary">
            {formatarNota(total)} <span className="text-base text-text-muted">/ {formatarNota(TOTAL_MAXIMO)}</span>
          </p>
        </div>

        {!somenteLeitura && (
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <Button type="submit" disabled={salvando || faltando.length > 0}>
              {salvando ? 'Salvando...' : 'Salvar avaliação'}
            </Button>
            {faltando.length > 0 && (
              <p className="text-xs text-text-muted">
                Falta avaliar: {faltando.map((bloco) => bloco.titulo).join(', ')}
              </p>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
