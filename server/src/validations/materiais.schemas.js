import { z } from 'zod';

const uuid = z.string().uuid('Identificador invalido');
const bimestre = z.coerce.number().int().min(1).max(4);
const nomeArquivo = z.string().min(1, 'Nome do arquivo obrigatorio').max(255);
const observacao = z.string().max(2000, 'A observacao pode ter no maximo 2000 caracteres');

/** Pedido de link de envio (slides ou modelo). */
export const envioSchema = z.object({
  nome: nomeArquivo,
  tamanho: z.number().int().positive('Tamanho invalido'),
});

/** POST /materiais/aulas — registra o material depois do envio. */
export const criarAulaSchema = z.object({
  caminho: z.string().min(1).max(300),
  nome: nomeArquivo,
  titulo: z.string().trim().min(1, 'Informe um titulo').max(150, 'O titulo pode ter no maximo 150 caracteres'),
  observacao: observacao.optional(),
  turma_ids: z.array(uuid).min(1, 'Escolha pelo menos uma turma').max(10),
});

/** PUT /materiais/aulas/:id — altera título e/ou observação. */
export const editarAulaSchema = z
  .object({
    titulo: z.string().trim().min(1, 'Informe um titulo').max(150).optional(),
    observacao: observacao.optional(),
  })
  .refine((dados) => dados.titulo !== undefined || dados.observacao !== undefined, {
    message: 'Informe o que deseja alterar',
  });

/** PUT /materiais/modelos/:bimestre — novo arquivo e/ou observação. */
export const salvarModeloSchema = z
  .object({
    caminho: z.string().min(1).max(300).optional(),
    nome: nomeArquivo.optional(),
    observacao: observacao.optional(),
  })
  .refine((dados) => !dados.caminho || !!dados.nome, { message: 'Informe o nome do arquivo' });

export const idParamSchema = z.object({ id: uuid });
export const bimestreParamSchema = z.object({ bimestre });

/** Query dos GETs: ?turma_id=...&baixar=1 */
export const listarAulasQuerySchema = z.object({ turma_id: uuid.optional() });
export const linkQuerySchema = z.object({ baixar: z.enum(['0', '1']).optional() });