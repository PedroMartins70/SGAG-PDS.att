import { z } from 'zod';

/**
 * Valida se um número de critério (0.00 a 0.20) é múltiplo de 0.05,
 * conforme a matriz de avaliação especificada.
 *
 * @param {number} valor Valor do critério.
 * @returns {boolean} true se o valor é múltiplo de 0.05 dentro da tolerância.
 */
const ehMultiploDeCincoCentimos = (valor) => {
  const centavos = Math.round(valor * 100);
  return Math.abs(centavos - valor * 100) < 1e-6 && centavos % 5 === 0;
};

/**
 * Critério de avaliação: valor numérico entre 0.00 e 0.20 com passo 0.05.
 */
const criterioSchema = z
  .number()
  .min(0, 'O criterio nao pode ser negativo')
  .max(0.2, 'O criterio nao pode ultrapassar 0.20')
  .refine(ehMultiploDeCincoCentimos, 'O criterio deve ser multiplo de 0.05');

/**
 * Bimestre (1 a 4), aceito como número ou string vinda de query/body.
 */
const bimestreSchema = z.coerce
  .number()
  .int('O bimestre deve ser um numero inteiro')
  .min(1, 'O bimestre deve ser entre 1 e 4')
  .max(4, 'O bimestre deve ser entre 1 e 4');

/**
 * Schema de autenticação (login).
 */
export const loginSchema = z.object({
  email: z.string().email('E-mail invalido'),
  senha: z.string().min(6, 'A senha deve ter no minimo 6 caracteres'),
});

/**
 * Schema de cadastro (Professor, Líder ou Vice-Líder).
 * Inclui confirmação de senha, senha forte e papel do perfil.
 */
export const cadastrarSchema = z
  .object({
    nome: z.string().min(3, 'O nome deve ter no minimo 3 caracteres').max(255),
    email: z.string().email('E-mail institucional invalido'),
    senha: z
      .string()
      .min(8, 'A senha deve ter no minimo 8 caracteres')
      .regex(/[a-zA-Z]/, 'A senha deve conter letras')
      .regex(/[0-9]/, 'A senha deve conter numeros'),
    confirmar_senha: z.string(),
    role: z.enum(['professor', 'lider', 'vice_lider'], {
      errorMap: () => ({ message: 'Tipo de perfil invalido' }),
    }),
  })
  .refine((dados) => dados.senha === dados.confirmar_senha, {
    message: 'As senhas nao coincidem',
    path: ['confirmar_senha'],
  });

/**
 * Schema de cadastro de perfil (exclusivo do Professor).
 * Apenas lider e vice_lider podem ser cadastrados — segundo professor e
 * aluno comum são bloqueados na camada de validação.
 */
export const criarPerfilSchema = z.object({
  nome: z.string().min(3, 'O nome deve ter no minimo 3 caracteres').max(255),
  email: z.string().email('E-mail invalido'),
  senha: z.string().min(6, 'A senha deve ter no minimo 6 caracteres'),
    role: z.enum(['lider', 'vice_lider', 'avaliador'], {
    errorMap: () => ({ message: 'Somente os perfis lider, vice_lider e avaliador podem ser cadastrados pelo professor' }),
  }),
});

/**
 * Schema de listagem de perfis (filtro opcional por papel).
 */
export const listarPerfisSchema = z.object({
  role: z.enum(['lider', 'vice_lider']).optional(),
});

/**
 * Schema de criação de grupo (nome entre 1 e 100 caracteres).
 */
export const criarGrupoSchema = z.object({
  nome: z.string().min(1, 'O nome do grupo e obrigatorio').max(100),
});

/**
 * Schema de criação completa de um grupo (Novo Grupo):
 * nome, Líder, Vice-Líder e integrantes (até 7).
 */
export const criarGrupoCompletoSchema = z.object({
  turma_id: z.string().uuid('Turma invalida'),
  nome: z.string().min(1, 'O nome do grupo e obrigatorio').max(100),
  lider_id: z.string().uuid('Perfil de lider invalido'),
  vice_lider_id: z.string().uuid('Perfil de vice-lider invalido'),
  integrantes: z.array(z.string().min(1).max(255)).max(7).optional().default([]),
});

/**
 * Schema de renomeação de grupo.
 */
export const renomearGrupoSchema = z.object({
  nome: z.string().min(1, 'O nome do grupo e obrigatorio').max(100),
});

/**
 * Schema de adição de integrante (aluno comum sem conta de acesso).
 */
export const adicionarIntegranteSchema = z.object({
  nome_aluno: z.string().min(1, 'O nome do aluno e obrigatorio').max(255),
});

/**
 * Schema de designação de Líder/Vice-Líder.
 */
export const designarPapelSchema = z.object({
  perfil_id: z.string().uuid('Perfil invalido'),
});

/**
 * Schema de query da listagem de avaliações (bimestre opcional, padrão 1).
 */
export const listarAvaliacoesQuerySchema = z.object({
  bimestre: bimestreSchema.optional().default(1),
});

/**
 * Schema de submissão de avaliação individual de um integrante.
 * Bimestre (1 a 4) + 5 critérios (0.00 a 0.20, passo 0.05) + comentário opcional
 * (qualquer perfil pode usar o comentário para justificar a nota; o professor
 * é obrigado a preenchê-lo, o que é validado na camada de serviço).
 */
export const avaliacaoSchema = z.object({
  bimestre: bimestreSchema,
  interesse: criterioSchema,
  entrega_prazo: criterioSchema,
  participacao: criterioSchema,
  qualidade_trabalho: criterioSchema,
  respeito_grupo: criterioSchema,
  comentario_esclarecimento: z.string().max(2000).optional().nullable(),
});

/**
 * Schema de exclusão de avaliação (Professor). Exige justificativa e o bimestre.
 */
export const excluirAvaliacaoSchema = z.object({
  bimestre: bimestreSchema,
  comentario_esclarecimento: z
    .string()
    .min(1, 'O comentario de esclarecimento e obrigatorio para excluir a nota'),
});
