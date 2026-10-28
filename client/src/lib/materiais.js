import { getSupabase } from './supabaseClient.js';
import { api } from '../services/api.js';

export const MB = 1024 * 1024;

/** Formatos aceitos (precisam bater com o servidor: materiais.service.js). */
export const EXTENSOES_AULA = ['pdf', 'pptx', 'ppt', 'odp', 'docx', 'doc', 'xlsx', 'xls', 'png', 'jpg', 'jpeg', 'webp', 'zip'];
export const EXTENSOES_MODELO = ['docx', 'doc', 'dotx'];
export const LIMITE_AULA_MB = 25;
export const LIMITE_MODELO_MB = 15;
export const OBSERVACAO_MAX = 2000;

/** Formatos que o navegador consegue mostrar sem baixar. */
const ABRE_NO_NAVEGADOR = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];

/** Extensão (minúscula, sem o ponto) de um nome de arquivo. */
export function extensaoDe(nome) {
  const partes = String(nome ?? '').split('.');
  return partes.length > 1 ? partes.pop().toLowerCase() : '';
}

/** true se o formato pode ser aberto direto no navegador (PDF e imagens). */
export function podeAbrirNoNavegador(nome) {
  return ABRE_NO_NAVEGADOR.includes(extensaoDe(nome));
}

/**
 * Confere formato e tamanho antes de enviar.
 *
 * @param {File} arquivo Arquivo escolhido.
 * @param {string[]} extensoes Extensões permitidas.
 * @param {number} limiteMb Tamanho máximo em MB.
 * @returns {string} Mensagem de erro, ou '' se estiver tudo certo.
 */
export function validarArquivoLocal(arquivo, extensoes, limiteMb) {
  if (!arquivo) return 'Escolha um arquivo.';
  if (!extensoes.includes(extensaoDe(arquivo.name))) {
    return `Formato não permitido. Aceitos: ${extensoes.join(', ')}.`;
  }
  if (arquivo.size > limiteMb * MB) {
    return `O arquivo tem mais de ${limiteMb} MB.`;
  }
  return '';
}

/** Ex.: 1536000 -> "1,5 MB" */
export function formatarTamanho(bytes) {
  if (!bytes) return '';
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / MB).toFixed(1).replace('.', ',')} MB`;
}

/** Ex.: "22/10/2026 14:30" (horário de Brasília). */
export function formatarDataHora(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Envia o arquivo direto para o armazenamento, usando o link que o servidor gerou.
 *
 * @param {{bucket: string, caminho: string, token: string, mime: string}} envio Dados devolvidos pelo servidor.
 * @param {File} arquivo Arquivo a enviar.
 */
export async function enviarParaStorage(envio, arquivo) {
  const { error } = await getSupabase()
    .storage.from(envio.bucket)
    .uploadToSignedUrl(envio.caminho, envio.token, arquivo, { contentType: envio.mime });
  if (error) {
    throw new Error(error.message || 'Falha ao enviar o arquivo.');
  }
}

/**
 * Pede ao servidor um link temporário e abre (ou baixa) o arquivo.
 * A aba é aberta antes da requisição para o navegador não bloquear o pop-up.
 *
 * @param {Object} params
 * @param {string} params.caminho Rota do link (ex.: /materiais/aulas/ID/link).
 * @param {string} params.token Token da sessão.
 * @param {boolean} params.baixar true para baixar, false para abrir.
 */
export async function abrirOuBaixar({ caminho, token, baixar }) {
  const aba = baixar ? null : window.open('', '_blank');
  try {
    const { url } = await api(`${caminho}?baixar=${baixar ? 1 : 0}`, { token });
    if (aba) {
      aba.opener = null;
      aba.location.href = url;
    } else {
      window.location.assign(url);
    }
  } catch (e) {
    if (aba) aba.close();
    throw e;
  }
}