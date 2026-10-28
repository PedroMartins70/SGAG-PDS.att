import { asyncHandler } from '../middlewares/error.middleware.js';
import {
  bimestreParamSchema,
  criarAulaSchema,
  editarAulaSchema,
  envioSchema,
  idParamSchema,
  linkQuerySchema,
  listarAulasQuerySchema,
  salvarModeloSchema,
} from '../validations/materiais.schemas.js';
import * as materiaisService from '../services/materiais.service.js';

// ----- Slides / materiais das aulas -----

/** POST /api/materiais/aulas/envio — link de envio direto ao armazenamento (professor). */
export const gerarEnvioAula = asyncHandler(async (req, res) => {
  const { nome, tamanho } = envioSchema.parse(req.body);
  const envio = await materiaisService.gerarEnvioAula({ nome, tamanho, usuario: req.user });
  res.json(envio);
});

/** POST /api/materiais/aulas — registra o material em uma ou mais turmas (professor). */
export const criarAula = asyncHandler(async (req, res) => {
  const dados = criarAulaSchema.parse(req.body);
  const itens = await materiaisService.criarAula({
    caminho: dados.caminho,
    nome: dados.nome,
    titulo: dados.titulo,
    observacao: dados.observacao,
    turmaIds: dados.turma_ids,
    usuario: req.user,
  });
  res.status(201).json({ itens });
});

/** GET /api/materiais/aulas?turma_id=... — lista (professor: todas; líder/vice: a própria turma). */
export const listarAulas = asyncHandler(async (req, res) => {
  const { turma_id: turmaId } = listarAulasQuerySchema.parse(req.query);
  const aulas = await materiaisService.listarAulas({ usuario: req.user, turmaId });
  res.json({ aulas });
});

/** GET /api/materiais/aulas/:id/link?baixar=1 — link temporário para abrir/baixar. */
export const linkAula = asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { baixar } = linkQuerySchema.parse(req.query);
  const url = await materiaisService.gerarLinkAula({ id, baixar: baixar === '1', usuario: req.user });
  res.json({ url });
});

/** PUT /api/materiais/aulas/:id — altera título/observação (professor). */
export const editarAula = asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const dados = editarAulaSchema.parse(req.body);
  const item = await materiaisService.editarAula({ id, ...dados, usuario: req.user });
  res.json({ item });
});

/** DELETE /api/materiais/aulas/:id — remove o material de uma turma (professor). */
export const excluirAula = asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await materiaisService.excluirAula({ id, usuario: req.user }));
});

// ----- Modelo do trabalho escrito -----

/** GET /api/materiais/modelos — modelo dos 4 bimestres (todos os perfis). */
export const listarModelos = asyncHandler(async (req, res) => {
  const modelos = await materiaisService.listarModelos(req.user);
  res.json({ modelos });
});

/** POST /api/materiais/modelos/:bimestre/envio — link de envio (professor). */
export const gerarEnvioModelo = asyncHandler(async (req, res) => {
  const { bimestre } = bimestreParamSchema.parse(req.params);
  const { nome, tamanho } = envioSchema.parse(req.body);
  const envio = await materiaisService.gerarEnvioModelo({ bimestre, nome, tamanho, usuario: req.user });
  res.json(envio);
});

/** PUT /api/materiais/modelos/:bimestre — salva arquivo e/ou observação (professor). */
export const salvarModelo = asyncHandler(async (req, res) => {
  const { bimestre } = bimestreParamSchema.parse(req.params);
  const dados = salvarModeloSchema.parse(req.body);
  const modelo = await materiaisService.salvarModelo({ bimestre, ...dados, usuario: req.user });
  res.json({ modelo });
});

/** GET /api/materiais/modelos/:bimestre/link?baixar=1 — link temporário (todos os perfis). */
export const linkModelo = asyncHandler(async (req, res) => {
  const { bimestre } = bimestreParamSchema.parse(req.params);
  const { baixar } = linkQuerySchema.parse(req.query);
  const url = await materiaisService.gerarLinkModelo({ bimestre, baixar: baixar === '1', usuario: req.user });
  res.json({ url });
});

/** DELETE /api/materiais/modelos/:bimestre — remove o modelo (professor). */
export const excluirModelo = asyncHandler(async (req, res) => {
  const { bimestre } = bimestreParamSchema.parse(req.params);
  res.json(await materiaisService.excluirModelo({ bimestre, usuario: req.user }));
});