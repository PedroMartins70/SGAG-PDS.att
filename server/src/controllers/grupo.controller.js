import { asyncHandler } from '../middlewares/error.middleware.js';
import {
  adicionarIntegranteSchema,
  criarGrupoCompletoSchema,
  criarGrupoSchema,
  designarPapelSchema,
  renomearGrupoSchema,
} from '../validations/schemas.js';
import * as grupoService from '../services/grupo.service.js';

/**
 * POST /api/grupos/novo — Cria um grupo completo (nome, líder, vice e integrantes).
 */
export const criarGrupoCompleto = asyncHandler(async (req, res) => {
  const dados = criarGrupoCompletoSchema.parse(req.body);
  const grupo = await grupoService.criarGrupoCompleto({
    turmaId: dados.turma_id,
    nome: dados.nome,
    liderId: dados.lider_id,
    viceLiderId: dados.vice_lider_id,
    integrantes: dados.integrantes,
    professorId: req.user.id,
  });
  res.status(201).json({ grupo });
});

/**
 * GET /api/turmas/:turmaId/grupos — Lista os grupos de uma turma.
 */
export const listarGrupos = asyncHandler(async (req, res) => {
  const { turmaId } = req.params;
  const grupos = await grupoService.listarGruposDaTurma(turmaId);
  res.json({ grupos });
});

/**
 * GET /api/grupos/me — Grupo do Líder/Vice-Líder autenticado.
 */
export const obterMeuGrupo = asyncHandler(async (req, res) => {
  const grupo = await grupoService.obterMeuGrupo(req.user.id);
  res.json({ grupo });
});

/**
 * GET /api/grupos/:grupoId?bimestre=1 — Detalhe do grupo (página de
 * expansão do professor), filtrado por bimestre (padrão: 1).
 */
export const obterGrupoDetalhado = asyncHandler(async (req, res) => {
  const { grupoId } = req.params;
  const bimestreQuery = Number(req.query.bimestre);
  const bimestre = Number.isInteger(bimestreQuery) && bimestreQuery >= 1 && bimestreQuery <= 4 ? bimestreQuery : 1;
  const grupo = await grupoService.obterGrupoDetalhado(grupoId, bimestre);
  res.json({ grupo });
});

/**
 * POST /api/turmas/:turmaId/grupos — Cria grupo (professor). Valida limite de 5.
 */
export const criarGrupo = asyncHandler(async (req, res) => {
  const { turmaId } = req.params;
  const dados = criarGrupoSchema.parse(req.body);
  const grupo = await grupoService.criarGrupo({ turmaId, nome: dados.nome, professorId: req.user.id });
  res.status(201).json({ grupo });
});

/**
 * PUT /api/grupos/:grupoId — Renomeia grupo (professor).
 */
export const renomearGrupo = asyncHandler(async (req, res) => {
  const { grupoId } = req.params;
  const dados = renomearGrupoSchema.parse(req.body);
  const grupo = await grupoService.renomearGrupo({ grupoId, nome: dados.nome, professorId: req.user.id });
  res.json({ grupo });
});

/**
 * DELETE /api/grupos/:grupoId — Exclui grupo (professor).
 */
export const excluirGrupo = asyncHandler(async (req, res) => {
  const { grupoId } = req.params;
  const resultado = await grupoService.excluirGrupo({ grupoId, professorId: req.user.id });
  res.json(resultado);
});

/**
 * POST /api/grupos/:grupoId/integrantes — Adiciona integrante (professor). Valida limite de 7.
 */
export const adicionarIntegrante = asyncHandler(async (req, res) => {
  const { grupoId } = req.params;
  const dados = adicionarIntegranteSchema.parse(req.body);
  const integrante = await grupoService.adicionarIntegrante({
    grupoId,
    nomeAluno: dados.nome_aluno,
    professorId: req.user.id,
  });
  res.status(201).json({ integrante });
});

/**
 * DELETE /api/grupos/:grupoId/integrantes/:integranteId — Remove integrante (professor).
 */
export const removerIntegrante = asyncHandler(async (req, res) => {
  const { grupoId, integranteId } = req.params;
  const resultado = await grupoService.removerIntegrante({
    grupoId,
    integranteId,
    professorId: req.user.id,
  });
  res.json(resultado);
});

/**
 * PUT /api/grupos/:grupoId/integrantes/:integranteId — Renomeia integrante (professor).
 */
export const renomearIntegrante = asyncHandler(async (req, res) => {
  const { grupoId, integranteId } = req.params;
  const dados = adicionarIntegranteSchema.parse(req.body);
  const integrante = await grupoService.renomearIntegrante({
    grupoId,
    integranteId,
    nomeAluno: dados.nome_aluno,
    professorId: req.user.id,
  });
  res.json({ integrante });
});

/**
 * PUT /api/grupos/:grupoId/lider — Designa Líder (professor).
 */
export const designarLider = asyncHandler(async (req, res) => {
  const { grupoId } = req.params;
  const dados = designarPapelSchema.parse(req.body);
  const resultado = await grupoService.designarLider({
    grupoId,
    perfilId: dados.perfil_id,
    professorId: req.user.id,
  });
  res.json(resultado);
});

/**
 * PUT /api/grupos/:grupoId/vice-lider — Designa Vice-Líder (professor).
 */
export const designarViceLider = asyncHandler(async (req, res) => {
  const { grupoId } = req.params;
  const dados = designarPapelSchema.parse(req.body);
  const resultado = await grupoService.designarViceLider({
    grupoId,
    perfilId: dados.perfil_id,
    professorId: req.user.id,
  });
  res.json(resultado);
});
