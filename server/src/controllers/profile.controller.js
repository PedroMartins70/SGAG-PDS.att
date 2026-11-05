import { asyncHandler } from '../middlewares/error.middleware.js';
import { criarPerfilSchema, listarPerfisSchema } from '../validations/schemas.js';
import { perfilIdParamSchema, trocarEmailSchema } from '../validations/senha.schemas.js';
import * as profileService from '../services/profile.service.js';

/**
 * POST /api/profiles — Cadastra Líder/Vice-Líder (exclusivo do Professor).
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