import { z } from 'zod';
import { asyncHandler } from '../middlewares/error.middleware.js';
import * as arquivoService from '../services/arquivo.service.js';

/** Pedido de link de envio: só metadados do arquivo (o arquivo em si não passa pelo servidor). */
const envioSchema = z.object({
  nome: z.string().min(1, 'O nome do arquivo e obrigatorio').max(255),
  tamanho: z.number().int().positive('O tamanho do arquivo e invalido'),
});

/** Confirmação de envio concluído. */
const confirmarSchema = z.object({
  caminho: z.string().min(1).max(500),
  nome: z.string().min(1).max(255),
});

/** Link externo do pitch (YouTube ou Google Drive). */
const linkSchema = z.object({
  url: z.string().min(1, 'Informe o link do pitch').max(500),
});

/**
 * GET /api/grupos/:grupoId/arquivos — Lista os arquivos do grupo
 * (professor: só leitura; líder/vice: leitura + permissão de envio).
 */
export const listarArquivos = asyncHandler(async (req, res) => {
  const { grupoId } = req.params;
  const resultado = await arquivoService.listarArquivos({ grupoId, usuario: req.user });
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
    nome: dados.nome,
    tamanho: dados.tamanho,
    usuario: req.user,
  });
  res.json(resultado);
});

/**
 * POST /api/grupos/:grupoId/arquivos/:tipo/confirmar — Registra o arquivo
 * enviado e substitui o anterior do mesmo tipo (apenas líder/vice do grupo).
 */
export const confirmarEnvio = asyncHandler(async (req, res) => {
  const { grupoId, tipo } = req.params;
  const dados = confirmarSchema.parse(req.body);
  const resultado = await arquivoService.confirmarEnvio({
    grupoId,
    tipo,
    caminho: dados.caminho,
    nome: dados.nome,
    usuario: req.user,
  });
  res.status(201).json(resultado);
});

/**
 * PUT /api/grupos/:grupoId/arquivos/pitch/link — Salva um link do YouTube
 * ou do Google Drive como pitch (apenas líder/vice do grupo).
 */
export const salvarLinkPitch = asyncHandler(async (req, res) => {
  const { grupoId } = req.params;
  const dados = linkSchema.parse(req.body);
  const resultado = await arquivoService.salvarLinkPitch({
    grupoId,
    url: dados.url,
    usuario: req.user,
  });
  res.json(resultado);
});