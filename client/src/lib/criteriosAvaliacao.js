/**
 * Critérios da ficha "Modelo Planilha avaliação Projeto Final".
 * Cada BLOCO recebe UMA nota da escala (0,00 a 1,00). Total máximo: 4,00.
 * Os "criterios" são apenas o roteiro que orienta o avaliador.
 */

export const ESCALA = [
  { valor: 0, rotulo: 'Não contempla' },
  { valor: 0.2, rotulo: 'Ruim' },
  { valor: 0.4, rotulo: 'Regular' },
  { valor: 0.6, rotulo: 'Bom' },
  { valor: 0.8, rotulo: 'Muito bom' },
  { valor: 1, rotulo: 'Excelente' },
];

export const BLOCOS = [
  {
    id: 'topicos',
    grupo: 'Parte documental — até 2,00 pontos',
    titulo: 'Tópicos obrigatórios',
    criterios: [
      'Introdução',
      'Objetivos Geral e Específicos',
      'Definição do Problema',
      'Cronograma',
      'Gráficos de Gantt',
      'Desenvolvimento',
      'Análise e Gerência de Riscos',
      'Levantamento de Requisitos Funcionais e Não-funcionais',
      'Conclusão',
      'Referências (ABNT)',
    ],
  },
  {
    id: 'abnt_coerencia',
    grupo: 'Parte documental — até 2,00 pontos',
    titulo: 'Normas ABNT e coerência',
    criterios: [
      'Adequações às normas ABNT, texto, aspectos visuais e dimensões, referências etc.',
      'Coerência e coesão do trabalho',
    ],
  },
  {
    id: 'apresentacao_oral',
    grupo: 'Apresentação oral — até 1,00 ponto',
    titulo: 'Apresentação oral',
    criterios: [
      'O grupo apresenta habilidades comunicativas.',
      'A apresentação é clara e apresenta estrutura lógica condizente com o desenvolvimento do sistema.',
      'O tempo utilizado na comunicação oral foi adequado.',
      'Recursos visuais.',
      'As respostas às perguntas foram precisas e coerentes.',
    ],
  },
  {
    id: 'pitch',
    grupo: 'Apresentação pitch — até 1,00 ponto',
    titulo: 'Apresentação pitch',
    criterios: [
      'O grupo apresenta habilidades comunicativas. Apresentação pessoal e o que realiza no grupo (estavam uniformizados).',
      'A apresentação é clara e apresenta estrutura lógica condizente com o desenvolvimento do sistema.',
      'O tempo utilizado na comunicação oral foi adequado (até 6 min de gravação, tolerância de 30 seg).',
      'Recursos visuais.',
      'Apresentação da empresa: ramo, localização atual do parceiro, situação ou problema atual e em que o software propõe melhoria.',
    ],
  },
];

export const TOTAL_MAXIMO = 4;
export const LIMITE_COMENTARIO = 2500;

/** Evita erros de arredondamento (ex.: 0.1 + 0.2). */
export function arredondar(numero) {
  return Math.round(numero * 100) / 100;
}

/** Confere se o valor é uma das notas permitidas da escala. */
export function notaValida(valor) {
  return ESCALA.some((item) => item.valor === valor);
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