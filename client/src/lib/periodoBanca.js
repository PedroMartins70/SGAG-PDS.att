/**
 * Converte AAAA-MM-DD em dd/mm/aaaa (sem usar Date, para não sofrer com fuso).
 *
 * @param {string|null} dataISO Data no formato AAAA-MM-DD.
 * @returns {string} Data no formato dd/mm/aaaa.
 */
export function formatarDataISO(dataISO) {
  if (!dataISO) return '';
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Rótulo curto e cor de cada situação do período. */
export const SITUACOES = {
  aberto: { texto: 'Aberto', classe: 'bg-success-soft text-success' },
  nao_iniciado: { texto: 'Ainda não abriu', classe: 'bg-warning-soft text-warning' },
  encerrado: { texto: 'Encerrado', classe: 'bg-danger-soft text-danger' },
  nao_definido: { texto: 'Bloqueado', classe: 'bg-surface-muted text-text-muted' },
};

/**
 * Frase explicando a situação do período.
 *
 * @param {{situacao: string, abre_em: string|null, fecha_em: string|null}} periodo Período do bimestre.
 * @returns {string} Texto para mostrar ao usuário.
 */
export function textoDoPeriodo(periodo) {
  if (!periodo) return '';
  const abre = formatarDataISO(periodo.abre_em);
  const fecha = formatarDataISO(periodo.fecha_em);

  switch (periodo.situacao) {
    case 'aberto':
      return `Avaliação aberta de ${abre} até ${fecha}.`;
    case 'nao_iniciado':
      return `A avaliação deste bimestre ainda não abriu. Ela abre em ${abre} e fecha em ${fecha}.`;
    case 'encerrado':
      return `O período de avaliação deste bimestre terminou em ${fecha}. As notas estão bloqueadas para edição.`;
    default:
      return 'A avaliação deste bimestre ainda não foi liberada pelo professor.';
  }
}