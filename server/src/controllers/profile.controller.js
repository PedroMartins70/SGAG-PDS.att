import { asyncHandler } from '../middlewares/error.middleware.js';
import { criarPerfilSchema, definirTurmasSchema, listarPerfisSchema } from '../validations/schemas.js';
import { perfilIdParamSchema, trocarEmailSchema } from '../validations/senha.schemas.js';
import * as profileService from '../services/profile.service.js';
import * as avaliadorService from '../services/avaliador.service.js';

/**
 * POST /api/profiles — Cadastra Líder, Vice-Líder ou Avaliador (exclusivo do Professor).
 * Para Avaliador, o corpo precisa trazer turma_ids (turmas que ele poderá ver).
 * Bloqueia criação de segundo professor e de aluno comum.
 */
export const criarPerfil = asyncHandler(async (req, res) => {
  const dados = criarPerfilSchema.parse(req.body);
  const perfil = await profileService.criarPerfil(dados, req.user.id);
  res.status(201).json({ perfil });
});

/**
 * GET /api/profiles — Lista perfis de Líder/Vice-Líder (exclusivo do Professor).
 */
export const listarPerfis = asyncHandler(async (req, res) => {
  const { role } = listarPerfisSchema.parse(req.query);
  const perfis = await profileService.listarPerfis(role);
  res.json({ perfis });
});

/**
 * PUT /api/profiles/:id/email — Troca o e-mail de acesso de uma conta de
 * Líder, Vice-Líder ou Avaliador (exclusivo do Professor).
 */
export const trocarEmail = asyncHandler(async (req, res) => {
  const { id } = perfilIdParamSchema.parse(req.params);
  const { email } = trocarEmailSchema.parse(req.body);
  const perfil = await profileService.trocarEmail({ perfilId: id, novoEmail: email }, req.user.id);
  res.json({ perfil });
});

/**
 * GET /api/profiles/avaliadores — Lista os avaliadores e as turmas de cada um
 * (quadro do painel do Professor).
 */
export const listarAvaliadores = asyncHandler(async (req, res) => {
  const avaliadores = await avaliadorService.listarAvaliadoresComTurmas();
  res.json({ avaliadores });
});

/**
 * PUT /api/profiles/avaliadores/:id/turmas — Define as turmas de um avaliador
 * já cadastrado (exclusivo do Professor). Exige pelo menos uma turma.
 */
export const definirTurmasDoAvaliador = asyncHandler(async (req, res) => {
  const { id } = perfilIdParamSchema.parse(req.params);
  const { turma_ids: turmaIds } = definirTurmasSchema.parse(req.body);
  const avaliador = await avaliadorService.definirTurmasDoAvaliador(
    { avaliadorId: id, turmaIds },
    req.user.id
  );
  res.json({ avaliador });
});

/**
 * GET /api/profiles/minhas-turmas — Turmas do avaliador autenticado
 * (usado no painel do avaliador).
 */
export const minhasTurmas = asyncHandler(async (req, res) => {
  const turmas = await avaliadorService.turmasDoAvaliador(req.user.id);
  res.json({ turmas });
});

/**
 * DELETE /api/profiles/avaliadores/:id — Exclui um avaliador (exclusivo do
 * Professor). Remove a conta de acesso, o perfil e os vínculos com turmas.
 */
export const excluirAvaliador = asyncHandler(async (req, res) => {
  const { id } = perfilIdParamSchema.parse(req.params);
  const resultado = await avaliadorService.excluirAvaliador({ avaliadorId: id }, req.user.id);
  res.json(resultado);
});