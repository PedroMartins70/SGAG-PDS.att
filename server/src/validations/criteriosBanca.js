/**
 * Blocos e tópicos da ficha de avaliação da banca (lado servidor).
 *
 * IMPORTANTE: os ids e os valores máximos precisam ser IGUAIS aos de
 * client/src/lib/criteriosAvaliacao.js. Se mudar um, mude o outro.
 *
 * Cada tópico recebe uma nota de 0 até "maximoItem", de 0,05 em 0,05.
 * A nota do bloco é a SOMA dos tópicos (e vale no máximo 1,00 em todos os blocos):
 *   - topicos:            10 tópicos x 0,10
 *   - abnt_coerencia:      2 tópicos x 0,50
 *   - apresentacao_oral:   5 tópicos x 0,20
 *   - pitch:               5 tópicos x 0,20
 */
export const BLOCOS_BANCA = [
  {
    id: 'topicos',
    maximoItem: 0.1,
    itens: [
      'introducao',
      'objetivos',
      'problema',
      'cronograma',
      'gantt',
      'desenvolvimento',
      'riscos',
      'requisitos',
      'conclusao',
      'referencias',
    ],
  },
  {
    id: 'abnt_coerencia',
    maximoItem: 0.5,
    itens: ['abnt', 'coerencia'],
  },
  {
    id: 'apresentacao_oral',
    maximoItem: 0.2,
    itens: ['comunicacao', 'clareza', 'tempo', 'recursos_visuais', 'respostas'],
  },
  {
    id: 'pitch',
    maximoItem: 0.2,
    itens: ['comunicacao', 'clareza', 'tempo', 'recursos_visuais', 'empresa'],
  },
];

/** Evita erros de arredondamento (ex.: 0.1 + 0.2). */
export function arredondar(numero) {
  return Math.round(numero * 100) / 100;
}

/**
 * Soma os tópicos de cada bloco. Usa centavos inteiros para não acumular erro de ponto flutuante.
 *
 * @param {Object<string, Object<string, number>>} itens Notas por bloco e por tópico.
 * @returns {{topicos: number, abnt_coerencia: number, apresentacao_oral: number, pitch: number}} Nota de cada bloco.
 */
export function somarBlocos(itens) {
  return Object.fromEntries(
    BLOCOS_BANCA.map((bloco) => {
      const centavos = bloco.itens.reduce((soma, id) => soma + Math.round(itens[bloco.id][id] * 100), 0);
      return [bloco.id, arredondar(centavos / 100)];
    })
  );
}