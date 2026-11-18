import { Fragment, useEffect, useState } from 'react';
import Button from './ui/Button.jsx';
import {
  BLOCOS,
  LIMITE_COMENTARIO,
  PASSO_NOTA,
  TOTAL_MAXIMO,
  arredondar,
  blocoCompleto,
  calcularTotal,
  formatarNota,
  itemValido,
  somarBloco,
} from '../lib/criteriosAvaliacao.js';

/**
 * Converte as notas salvas (números) em texto para os campos do formulário.
 * Todo tópico começa vazio quando não há nota salva.
 *
 * @param {Object|null|undefined} itens Notas por bloco e por tópico.
 * @returns {Object<string, Object<string, string>>} Valores em texto.
 */
function itensParaTexto(itens) {
  const resultado = {};
  for (const bloco of BLOCOS) {
    resultado[bloco.id] = {};
    for (const item of bloco.itens) {
      const valor = itens?.[bloco.id]?.[item.id];
      resultado[bloco.id][item.id] = valor === undefined || valor === null ? '' : String(valor);
    }
  }
  return resultado;
}

/**
 * Formulário de avaliação bimestral de um grupo, com a nota de cada TÓPICO.
 *
 * Cada tópico recebe uma nota de 0 até o seu máximo, de 0,05 em 0,05
 * (Tópicos obrigatórios: até 0,10 | Normas ABNT: até 0,50 | Oral e Pitch: até 0,20).
 * A nota de cada bloco é a soma dos tópicos e o total aparece conforme o avaliador preenche.
 *
 * Avaliações antigas (uma nota por bloco) continuam valendo: aparecem com a nota
 * antiga até o avaliador preencher os tópicos para alterá-las.
 *
 * @param {object}   props
 * @param {{notas?: Record<string, number>, itens?: Object|null, comentario?: string}} [props.valoresIniciais]
 *        Avaliação já salva (ou vazio para uma nova).
 * @param {boolean}  [props.somenteLeitura] true quando o período está fechado.
 * @param {boolean}  [props.salvando]       true enquanto envia ao servidor.
 * @param {(dados: {itens: Object, comentario: string}) => void} [props.onSalvar]
 */
export default function FormularioAvaliacao({
  valoresIniciais,
  somenteLeitura = false,
  salvando = false,
  onSalvar,
}) {
  const [itens, setItens] = useState(() => itensParaTexto(valoresIniciais?.itens));
  const [comentario, setComentario] = useState(valoresIniciais?.comentario ?? '');

  // Atualiza o formulário quando troca de bimestre/grupo (chega outra avaliação)
  const chave = JSON.stringify(valoresIniciais ?? {});
  useEffect(() => {
    setItens(itensParaTexto(valoresIniciais?.itens));
    setComentario(valoresIniciais?.comentario ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  /** Avaliação antiga: salva com uma nota por bloco, sem notas por tópico. */
  const legado = Boolean(valoresIniciais?.notas) && !valoresIniciais?.itens;
  const algumPreenchido = BLOCOS.some((bloco) => bloco.itens.some((item) => itens[bloco.id][item.id] !== ''));
  const mostrarLegado = legado && !algumPreenchido;

  const faltando = BLOCOS.filter((bloco) => !blocoCompleto(bloco, itens[bloco.id]));
  const total = mostrarLegado
    ? calcularTotal(valoresIniciais.notas)
    : arredondar(BLOCOS.reduce((soma, bloco) => soma + somarBloco(bloco, itens[bloco.id]), 0));

  function alterar(blocoId, itemId, valor) {
    if (somenteLeitura) return;
    setItens((atual) => ({ ...atual, [blocoId]: { ...atual[blocoId], [itemId]: valor } }));
  }

  function handleSubmit(evento) {
    evento.preventDefault();
    if (somenteLeitura || faltando.length > 0 || !onSalvar) return;

    const numeros = {};
    for (const bloco of BLOCOS) {
      numeros[bloco.id] = {};
      for (const item of bloco.itens) {
        numeros[bloco.id][item.id] = Number(itens[bloco.id][item.id]);
      }
    }
    onSalvar({ itens: numeros, comentario: comentario.trim() });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {mostrarLegado && (
        <div className="rounded-lg border border-warning-soft bg-warning-soft px-3 py-2 text-sm font-medium text-warning">
          Esta avaliação foi lançada no modelo antigo (uma nota por bloco) e continua valendo. Para alterá-la,
          preencha a nota de todos os tópicos abaixo e salve.
        </div>
      )}

      {BLOCOS.map((bloco, indice) => {
        const mostrarGrupo = indice === 0 || BLOCOS[indice - 1].grupo !== bloco.grupo;
        const valores = itens[bloco.id];
        const algumNoBloco = bloco.itens.some((item) => valores[item.id] !== '');

        let notaDoBloco = '—';
        if (mostrarLegado) {
          notaDoBloco = `${formatarNota(valoresIniciais.notas?.[bloco.id] ?? 0)} (modelo antigo)`;
        } else if (algumNoBloco) {
          notaDoBloco = formatarNota(somarBloco(bloco, valores));
        }

        return (
          <Fragment key={bloco.id}>
            {mostrarGrupo && (
              <h2 className="pt-2 font-display text-lg font-bold text-primary">{bloco.grupo}</h2>
            )}

            <section className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-base font-bold text-text">{bloco.titulo}</h3>
                <span className="text-sm font-semibold text-text-muted">
                  Nota: {notaDoBloco} / {formatarNota(bloco.maximo)}
                </span>
              </div>

              <p className="mt-3 text-sm font-medium text-text">
                O que avaliar{' '}
                <span className="font-normal text-text-muted">
                  (cada tópico vale até {formatarNota(bloco.maximoItem)}, de {formatarNota(PASSO_NOTA)} em{' '}
                  {formatarNota(PASSO_NOTA)}):
                </span>
              </p>

              <ul className="mt-2 space-y-2">
                {bloco.itens.map((item) => {
                  const valor = valores[item.id];
                  const invalido = valor !== '' && !itemValido(valor, bloco.maximoItem);
                  const idCampo = `nota-${bloco.id}-${item.id}`;
                  return (
                    <li key={item.id} className="flex items-center justify-between gap-3">
                      <label htmlFor={idCampo} className="min-w-0 flex-1 text-sm text-text-muted">
                        {item.rotulo}
                      </label>
                      <div className="shrink-0 text-right">
                        <input
                          id={idCampo}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max={bloco.maximoItem}
                          step={PASSO_NOTA}
                          value={valor}
                          disabled={somenteLeitura}
                          onChange={(e) => alterar(bloco.id, item.id, e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          aria-invalid={invalido}
                          placeholder="0,00"
                          className={`h-10 w-24 rounded-xl border bg-canvas px-3 text-right text-base text-text transition-all focus:outline-none focus:ring-4 disabled:opacity-60 ${
                            invalido
                              ? 'border-danger focus:border-danger focus:ring-danger/15'
                              : 'border-border focus:border-primary focus:ring-primary/15'
                          }`}
                        />
                        {invalido && (
                          <p className="mt-0.5 text-xs text-danger">
                            0 a {formatarNota(bloco.maximoItem)}, de {formatarNota(PASSO_NOTA)} em{' '}
                            {formatarNota(PASSO_NOTA)}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
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
                Falta preencher: {faltando.map((bloco) => bloco.titulo).join(', ')}
              </p>
            )}
          </div>
        )}
      </div>
    </form>
  );
}