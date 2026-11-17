import { z } from 'zod';
import { asyncHandler } from '../middlewares/error.middleware.js';
import * as relatoriosService from '../services/relatorios.service.js';

/** Validação do corpo (criar e editar usam o mesmo formato). */
const relatorioSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o titulo').max(150, 'Titulo muito longo (maximo 150)'),
  descricao: z.string().trim().max(500, 'Descricao muito longa (maximo 500)').optional().default(''),
  url: z
    .string()
    .trim()
    .url('Link invalido')
    .refine((valor) => valor.toLowerCase().startsWith('https://'), 'O link deve comecar com https://'),
});

const idSchema = z.string().uuid('Relatorio invalido');

/**
 * GET /api/relatorios — Lista os relatórios (professor, líder e vice-líder).
 */
export const listarRelatorios = asyncHandler(async (req, res) => {
  const relatorios = await relatoriosService.listarRelatorios();
  res.json({ relatorios });
});

/**
 * POST /api/relatorios — Cria um relatório (professor).
 */
export const criarRelatorio = asyncHandler(async (req, res) => {
  const dados = relatorioSchema.parse(req.body);
  const relatorio = await relatoriosService.criarRelatorio({ ...dados, professorId: req.user.id });
  res.status(201).json({ relatorio });
});

/**
 * PUT /api/relatorios/:relatorioId — Edita um relatório (professor).
 */
export const atualizarRelatorio = asyncHandler(async (req, res) => {
  const id = idSchema.parse(req.params.relatorioId);
  const dados = relatorioSchema.parse(req.body);
  const relatorio = await relatoriosService.atualizarRelatorio({ id, ...dados, professorId: req.user.id });
  res.json({ relatorio });
});

/**
 * DELETE /api/relatorios/:relatorioId — Exclui um relatório (professor).
 */
export const excluirRelatorio = asyncHandler(async (req, res) => {
  const id = idSchema.parse(req.params.relatorioId);
  const resultado = await relatoriosService.excluirRelatorio({ id, professorId: req.user.id });
  res.json(resultado);
});