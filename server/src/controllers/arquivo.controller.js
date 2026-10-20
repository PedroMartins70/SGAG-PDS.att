import { z } from 'zod';
import { asyncHandler } from '../middlewares/error.middleware.js';
import * as arquivoService from '../services/arquivo.service.js';

/** Bimestre: 1 a 4 para trabalho e pitch (a logo ignora este campo). */
const bimestreSchema = z.number().int().min(0).max(4).optional();

/** Pedido de link de envio: só metadados do arquivo (o arquivo em si não passa pelo servidor). */
const envioSchema = z.object({
  nome: z.string().min(1, 'O nome do arquivo e obrigatorio').max(255),
  tamanho: z.number().int().positive('O tamanho do arquivo e invalido'),
  bimestre: bimestreSchema,
});

/** Confirmação de envio concluído. */
const confirmarSchema = z.object({
  caminho: z.string().min(1).max(500),
  nome: z.string().min(1).max(255),
  bimestre: bimestreSchema,
});

/** Link externo do pitch (YouTube ou Google Drive) de um bimestre. */
const linkSchema = z.object({
  url: z.string().min(1, 'Informe o link do pitch').max(500),
  bimestre: bimestreSchema,
});

/**
 * GET /api/grupos/:grupoId/arquivos?bimestre=1 — Lista os arquivos do grupo
 * para um bimestre (trabalho e pitch daquele bimestre + logo do projeto).
 * Professor e avaliador só leem; líder/vice leem e enviam.
 */
export const listarArquivos = asyncHandler(async (req, res) => {
  const { grupoId } = req.params;
  const consulta = Number(req.query.bimestre);
  const bimestre = Number.isInteger(consulta) && consulta >= 1 && consulta <= 4 ? consulta : 1;
  const resultado = await arquivoService.listarArquivos({ grupoId, bimestre, usuario: req.user });
  res.json(resultado);
});

/**
 * POST /api/grupos/:grupoId/arquivos/:tipo/upload-url — Gera o link de envio
 * direto ao armazenamento (apenas líder/vice do grupo).
 */
export const gerarUrlDeEnvio = asyncHandler(async (req, res) => {
  const { grupoId, tipo } = req.params;
  const dados = envioSchema.parse(req.body);
  const resultado = await arquivoService.gerarUrlDeEnvio({
    grupoId,
    tipo,
    bimestre: dados.bimestre,
    nome: dados.nome,
    tamanho: dados.tamanho,
    usuario: req.user,
  });
  res.json(resultado);
});

/**
 * POST /api/grupos/:grupoId/arquivos/:tipo/confirmar — Registra o arquivo
 * enviado e substitui o anterior do mesmo tipo e bimestre (apenas líder/vice do grupo).
 */
export const confirmarEnvio = asyncHandler(async (req, res) => {
  const { grupoId, tipo } = req.params;
  const dados = confirmarSchema.parse(req.body);
  const resultado = await arquivoService.confirmarEnvio({
    grupoId,
    tipo,
    bimestre: dados.bimestre,
    caminho: dados.caminho,
    nome: dados.nome,
    usuario: req.user,
  });
  res.status(201).json(resultado);
});

/**
 * PUT /api/grupos/:grupoId/arquivos/pitch/link — Salva um link do YouTube
 * ou do Google Drive como pitch de um bimestre (apenas líder/vice do grupo).
 */
export const salvarLinkPitch = asyncHandler(async (req, res) => {
  const { grupoId } = req.params;
  const dados = linkSchema.parse(req.body);
  const resultado = await arquivoService.salvarLinkPitch({
    grupoId,
    bimestre: dados.bimestre,
    url: dados.url,
    usuario: req.user,
  });
  res.json(resultado);
});