/**
 * Critérios da ficha "Modelo Planilha avaliação Projeto Final".
 *
 * Cada TÓPICO recebe a sua própria nota, de 0 até o máximo do tópico, de 0,05 em 0,05.
 * A nota do BLOCO é a soma dos seus tópicos e vale no máximo 1,00 em todos os blocos:
 *   - Tópicos obrigatórios:      10 tópicos x 0,10
 *   - Normas ABNT e coerência:    2 tópicos x 0,50
 *   - Apresentação oral:          5 tópicos x 0,20
 *   - Apresentação pitch:         5 tópicos x 0,20
 * Total máximo: 4,00.
 *
 * IMPORTANTE: os ids e os máximos precisam ser IGUAIS aos de
 * server/src/validations/criteriosBanca.js. Se mudar um, mude o outro.
 */

/** Passo da nota de cada tópico. */
export const PASSO_NOTA = 0.05;

/**
 * Escala antiga (uma nota por bloco). Não é mais usada no formulário, mas
 * continua aqui para mostrar o rótulo das avaliações antigas.
 */
export const ESCALA = [
  { valor: 0, rotulo: 'Não contempla' },
  { valor: 0.2, rotulo: 'Ruim' },
  { valor: 0.4, rotulo: 'Regular' },
  { valor: 0.6, rotulo: 'Bom' },
  { valor: 0.8, rotulo: 'Muito bom' },
  { valor: 1, rotulo: 'Excelente' },
];

/** Evita erros de arredondamento (ex.: 0.1 + 0.2). */
export function arredondar(numero) {
  return Math.round(numero * 100) / 100;
}

/** Monta um bloco: "criterios" (só os textos) e "maximo" (soma dos máximos dos tópicos). */
function criarBloco({ id, grupo, titulo, maximoItem, itens }) {
  return {
    id,
    grupo,
    titulo,
    maximoItem,
    itens,
    criterios: itens.map((item) => item.rotulo),
    maximo: arredondar(maximoItem * itens.length),
  };
}

export const BLOCOS = [
  criarBloco({
    id: 'topicos',
    grupo: 'Parte documental — até 2,00 pontos',
    titulo: 'Tópicos obrigatórios',
    maximoItem: 0.1,
    itens: [
      { id: 'introducao', rotulo: 'Introdução' },
      { id: 'objetivos', rotulo: 'Objetivos Geral e Específicos' },
      { id: 'problema', rotulo: 'Definição do Problema' },
      { id: 'cronograma', rotulo: 'Cronograma' },
      { id: 'gantt', rotulo: 'Gráficos de Gantt' },
      { id: 'desenvolvimento', rotulo: 'Desenvolvimento' },
      { id: 'riscos', rotulo: 'Análise e Gerência de Riscos' },
      { id: 'requisitos', rotulo: 'Levantamento de Requisitos Funcionais e Não-funcionais' },
      { id: 'conclusao', rotulo: 'Conclusão' },
      { id: 'referencias', rotulo: 'Referências (ABNT)' },
    ],
  }),
  criarBloco({
    id: 'abnt_coerencia',
    grupo: 'Parte documental — até 2,00 pontos',
    titulo: 'Normas ABNT e coerência',
    maximoItem: 0.5,
    itens: [
      {
        id: 'abnt',
        rotulo: 'Adequações às normas ABNT, texto, aspectos visuais e dimensões, referências etc.',
      },
      { id: 'coerencia', rotulo: 'Coerência e coesão do trabalho' },
    ],
  }),
  criarBloco({
    id: 'apresentacao_oral',
    grupo: 'Apresentação oral — até 1,00 ponto',
    titulo: 'Apresentação oral',
    maximoItem: 0.2,
    itens: [
      { id: 'comunicacao', rotulo: 'O grupo apresenta habilidades comunicativas.' },
      {
        id: 'clareza',
        rotulo: 'A apresentação é clara e apresenta estrutura lógica condizente com o desenvolvimento do sistema.',
      },
      { id: 'tempo', rotulo: 'O tempo utilizado na comunicação oral foi adequado.' },
      { id: 'recursos_visuais', rotulo: 'Recursos visuais.' },
      { id: 'respostas', rotulo: 'As respostas às perguntas foram precisas e coerentes.' },
    ],
  }),
  criarBloco({
    id: 'pitch',
    grupo: 'Apresentação pitch — até 1,00 ponto',
    titulo: 'Apresentação pitch',
    maximoItem: 0.2,
    itens: [
      {
        id: 'comunicacao',
        rotulo:
          'O grupo apresenta habilidades comunicativas. Apresentação pessoal e o que realiza no grupo (estavam uniformizados).',
      },
      {
        id: 'clareza',
        rotulo: 'A apresentação é clara e apresenta estrutura lógica condizente com o desenvolvimento do sistema.',
      },
      {
        id: 'tempo',
        rotulo: 'O tempo utilizado na comunicação oral foi adequado (até 6 min de gravação, tolerância de 30 seg).',
      },
      { id: 'recursos_visuais', rotulo: 'Recursos visuais.' },
      {
        id: 'empresa',
        rotulo:
          'Apresentação da empresa: ramo, localização atual do parceiro, situação ou problema atual e em que o software propõe melhoria.',
      },
    ],
  }),
];

export const TOTAL_MAXIMO = 4;
export const LIMITE_COMENTARIO = 2500;

/** Confere se o valor é uma das notas da escala antiga (avaliações antigas). */
export function notaValida(valor) {
  return ESCALA.some((item) => item.valor === valor);
}

/**
 * Confere se a nota de um tópico está preenchida e é válida:
 * número entre 0 e o máximo do tópico, de 0,05 em 0,05.
 *
 * @param {string|number} valor Valor digitado.
 * @param {number} maximo Máximo do tópico.
 * @returns {boolean} true se for válida.
 */
export function itemValido(valor, maximo) {
  if (valor === '' || valor === null || valor === undefined) return false;
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return false;
  if (numero < 0 || numero > maximo + 1e-9) return false;
  const centavos = Math.round(numero * 100);
  return Math.abs(numero * 100 - centavos) < 1e-6 && centavos % 5 === 0;
}

/**
 * Soma as notas válidas de um bloco (tópicos vazios ou inválidos contam zero).
 *
 * @param {Object} bloco Bloco da ficha.
 * @param {Object<string, string|number>} valores Notas digitadas, por id do tópico.
 * @returns {number} Soma do bloco.
 */
export function somarBloco(bloco, valores) {
  const centavos = bloco.itens.reduce((soma, item) => {
    const valor = valores?.[item.id];
    return itemValido(valor, bloco.maximoItem) ? soma + Math.round(Number(valor) * 100) : soma;
  }, 0);
  return arredondar(centavos / 100);
}

/** true se todos os tópicos do bloco estão preenchidos com notas válidas. */
export function blocoCompleto(bloco, valores) {
  return bloco.itens.every((item) => itemValido(valores?.[item.id], bloco.maximoItem));
}

/** Soma das notas dos blocos. Ex.: { topicos: 0.6, pitch: 1 } -> 1.6 */
export function calcularTotal(notas) {
  const soma = BLOCOS.reduce((acc, bloco) => acc + (Number(notas?.[bloco.id]) || 0), 0);
  return arredondar(soma);
}

/** Formata no padrão brasileiro: 0.6 -> "0,60" */
export function formatarNota(valor) {
  return Number(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}