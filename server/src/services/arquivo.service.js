import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/error.middleware.js';
import { registrarAuditoria } from '../utils/audit.js';

const MB = 1024 * 1024;

/** Validade (em segundos) dos links temporários de arquivos privados. */
const SEGUNDOS_URL_ASSINADA = 60 * 60;

/**
 * Tipos de arquivo aceitos. Os limites e MIME types precisam bater com os
 * buckets criados em migracao_arquivos.sql.
 */
export const TIPOS_ARQUIVO = {
  trabalho: {
    bucket: 'trabalhos',
    publico: false,
    limite: 10 * MB,
    rotulo: 'Trabalho escrito',
    extensoes: { pdf: 'application/pdf' },
  },
  pitch: {
    bucket: 'pitches',
    publico: false,
    limite: 30 * MB,
    rotulo: 'Pitch',
    extensoes: {
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      m4v: 'video/x-m4v',
      avi: 'video/x-msvideo',
      mkv: 'video/x-matroska',
      webm: 'video/webm',
      '3gp': 'video/3gpp',
      wmv: 'video/x-ms-wmv',
    },
  },
  logo: {
    bucket: 'logos',
    publico: true,
    limite: 5 * MB,
    rotulo: 'Logo',
    extensoes: {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
    },
  },
};

const HOSTS_YOUTUBE = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be'];
const HOSTS_DRIVE = ['drive.google.com'];

const temChave = (objeto, chave) => Object.prototype.hasOwnProperty.call(objeto, chave);

/**
 * Retorna a configuração de um tipo de arquivo ou lança 400.
 *
 * @param {string} tipo trabalho, pitch ou logo.
 * @returns {Object} Configuração do tipo.
 */
function obterConfig(tipo) {
  if (!temChave(TIPOS_ARQUIVO, tipo)) {
    throw new AppError(400, 'Tipo de arquivo invalido (use trabalho, pitch ou logo)');
  }
  return TIPOS_ARQUIVO[tipo];
}

/**
 * Extrai a extensão (minúscula) de um nome de arquivo.
 *
 * @param {string} nome Nome do arquivo.
 * @returns {string} Extensão sem o ponto, ou string vazia.
 */
function extensaoDe(nome) {
  const partes = String(nome).split('.');
  return partes.length > 1 ? partes.pop().toLowerCase() : '';
}

/**
 * Interpreta um link de pitch. Aceita somente links https de vídeos do
 * YouTube ou de arquivos do Google Drive, e calcula o endereço de incorporação
 * (para tocar o vídeo dentro da página).
 *
 * @param {string} texto Link digitado pelo usuário.
 * @returns {{url: string, embed: string, origem: string}|null} Link normalizado ou null se inválido.
 */
function interpretarLinkDePitch(texto) {
  let url;
  try {
    url = new URL(String(texto).trim());
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase();

  if (HOSTS_YOUTUBE.includes(host)) {
    let id = null;
    if (host.endsWith('youtu.be')) {
      id = url.pathname.split('/')[1] || null;
    } else if (url.pathname === '/watch') {
      id = url.searchParams.get('v');
    } else {
      const encontrado = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{6,20})/);
      id = encontrado ? encontrado[1] : null;
    }
    if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
    return { url: url.toString(), embed: `https://www.youtube.com/embed/${id}`, origem: 'youtube' };
  }

  if (HOSTS_DRIVE.includes(host)) {
    const encontrado = url.pathname.match(/^\/file\/d\/([\w-]+)/);
    const id = encontrado ? encontrado[1] : url.searchParams.get('id');
    if (!id || !/^[\w-]+$/.test(id)) return null;
    return { url: url.toString(), embed: `https://drive.google.com/file/d/${id}/preview`, origem: 'drive' };
  }

  return null;
}

/**
 * Busca o grupo (apenas campos de liderança) e garante que existe.
 *
 * @param {string} grupoId UUID do grupo.
 * @returns {Promise<Object>} Grupo encontrado.
 */
async function buscarGrupo(grupoId) {
  const { data: grupo, error } = await supabaseAdmin
    .from('grupos')
    .select('id, lider_id, vice_lider_id')
    .eq('id', grupoId)
    .maybeSingle();

  if (error || !grupo) {
    throw new AppError(404, 'Grupo nao encontrado');
  }

  return grupo;
}

/**
 * Indica se o usuário é o líder ou o vice-líder DESTE grupo.
 *
 * @param {Object} grupo Grupo consultado.
 * @param {Object} usuario Usuário autenticado.
 * @returns {boolean} true se for líder/vice do grupo.
 */
function ehLiderancaDoGrupo(grupo, usuario) {
  return (
    (usuario.role === 'lider' && usuario.id === grupo.lider_id) ||
    (usuario.role === 'vice_lider' && usuario.id === grupo.vice_lider_id)
  );
}

/**
 * Gera um link de envio direto ao armazenamento (válido só para um caminho
 * específico). O arquivo vai do navegador direto pro Supabase Storage.
 * Somente o líder ou o vice-líder do grupo pode pedir esse link.
 *
 * @param {Object} params Parâmetros.
 * @param {string} params.grupoId UUID do grupo.
 * @param {string} params.tipo trabalho, pitch ou logo.
 * @param {string} params.nome Nome original do arquivo.
 * @param {number} params.tamanho Tamanho em bytes.
 * @param {Object} params.usuario Usuário autenticado.
 * @returns {Promise<{bucket: string, caminho: string, token: string, mime: string}>} Dados do envio.
 */
export async function gerarUrlDeEnvio({ grupoId, tipo, nome, tamanho, usuario }) {
  const config = obterConfig(tipo);
  const grupo = await buscarGrupo(grupoId);

  if (!ehLiderancaDoGrupo(grupo, usuario)) {
    throw new AppError(403, 'Apenas o lider ou o vice-lider do grupo pode enviar arquivos');
  }

  const extensao = extensaoDe(nome);
  if (!extensao || !temChave(config.extensoes, extensao)) {
    throw new AppError(
      400,
      `Formato nao permitido para ${config.rotulo}. Aceitos: ${Object.keys(config.extensoes).join(', ')}`
    );
  }

  if (tamanho > config.limite) {
    throw new AppError(400, `O arquivo excede o limite de ${config.limite / MB} MB para ${config.rotulo}`);
  }

  const caminho = `${grupoId}/${tipo}-${Date.now()}.${extensao}`;

  const { data, error } = await supabaseAdmin.storage.from(config.bucket).createSignedUploadUrl(caminho);

  if (error || !data) {
    console.error('Falha ao criar URL de envio:', error?.message);
    throw new AppError(500, 'Falha ao preparar o envio do arquivo');
  }

  return { bucket: config.bucket, caminho, token: data.token, mime: config.extensoes[extensao] };
}

/**
 * Confirma um envio: confere que o arquivo realmente chegou ao
 * armazenamento, registra na tabela e apaga o arquivo anterior do mesmo tipo.
 * Se o pitch anterior era um link, o link é substituído pelo arquivo.
 *
 * @param {Object} params Parâmetros.
 * @param {string} params.grupoId UUID do grupo.
 * @param {string} params.tipo trabalho, pitch ou logo.
 * @param {string} params.caminho Caminho devolvido por gerarUrlDeEnvio.
 * @param {string} params.nome Nome original do arquivo.
 * @param {Object} params.usuario Usuário autenticado.
 * @returns {Promise<{success: boolean}>} Resultado.
 */
export async function confirmarEnvio({ grupoId, tipo, caminho, nome, usuario }) {
  const config = obterConfig(tipo);
  const grupo = await buscarGrupo(grupoId);

  if (!ehLiderancaDoGrupo(grupo, usuario)) {
    throw new AppError(403, 'Apenas o lider ou o vice-lider do grupo pode enviar arquivos');
  }

  const prefixo = `${grupoId}/${tipo}-`;
  if (!caminho.startsWith(prefixo) || caminho.includes('..')) {
    throw new AppError(400, 'Caminho de arquivo invalido');
  }

  const nomeNoStorage = caminho.slice(grupoId.length + 1);

  const { data: itens, error: erroLista } = await supabaseAdmin.storage
    .from(config.bucket)
    .list(grupoId, { limit: 100, search: nomeNoStorage });

  const objeto = (itens ?? []).find((item) => item.name === nomeNoStorage);

  if (erroLista || !objeto) {
    throw new AppError(400, 'O arquivo nao foi encontrado no armazenamento. Tente enviar novamente.');
  }

  const tamanho = Number(objeto.metadata?.size ?? 0) || null;
  const mime = objeto.metadata?.mimetype ?? null;

  const { data: anterior } = await supabaseAdmin
    .from('grupo_arquivos')
    .select('id, caminho')
    .eq('grupo_id', grupoId)
    .eq('tipo', tipo)
    .maybeSingle();

  const { data, error } = await supabaseAdmin
    .from('grupo_arquivos')
    .upsert(
      {
        grupo_id: grupoId,
        tipo,
        bucket: config.bucket,
        caminho,
        url_externa: null,
        nome_original: nome,
        mime,
        tamanho,
        enviado_por: usuario.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'grupo_id,tipo' }
    )
    .select()
    .single();

  if (error) {
    throw new AppError(400, `Falha ao registrar o arquivo: ${error.message}`);
  }

  if (anterior?.caminho && anterior.caminho !== caminho) {
    await supabaseAdmin.storage.from(config.bucket).remove([anterior.caminho]);
  }

  await registrarAuditoria('grupo_arquivos', data.id, anterior ? 'UPDATE' : 'INSERT', usuario.id, {
    grupo_id: grupoId,
    tipo,
    nome_original: nome,
  });

  return { success: true };
}

/**
 * Salva um link (YouTube ou Google Drive) como pitch do grupo, no lugar de
 * um arquivo. Se havia um arquivo de pitch no armazenamento, ele é apagado.
 * Somente o líder ou o vice-líder do grupo pode usar.
 *
 * @param {Object} params Parâmetros.
 * @param {string} params.grupoId UUID do grupo.
 * @param {string} params.url Link digitado.
 * @param {Object} params.usuario Usuário autenticado.
 * @returns {Promise<{success: boolean}>} Resultado.
 */
export async function salvarLinkPitch({ grupoId, url, usuario }) {
  const grupo = await buscarGrupo(grupoId);

  if (!ehLiderancaDoGrupo(grupo, usuario)) {
    throw new AppError(403, 'Apenas o lider ou o vice-lider do grupo pode enviar o pitch');
  }

  const link = interpretarLinkDePitch(url);
  if (!link) {
    throw new AppError(
      400,
      'Link invalido. Use um link https de um video do YouTube ou de um arquivo do Google Drive.'
    );
  }

  const { data: anterior } = await supabaseAdmin
    .from('grupo_arquivos')
    .select('id, caminho')
    .eq('grupo_id', grupoId)
    .eq('tipo', 'pitch')
    .maybeSingle();

  const { data, error } = await supabaseAdmin
    .from('grupo_arquivos')
    .upsert(
      {
        grupo_id: grupoId,
        tipo: 'pitch',
        bucket: null,
        caminho: null,
        url_externa: link.url,
        nome_original: 'Link do pitch',
        mime: null,
        tamanho: null,
        enviado_por: usuario.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'grupo_id,tipo' }
    )
    .select()
    .single();

  if (error) {
    throw new AppError(400, `Falha ao registrar o link: ${error.message}`);
  }

  if (anterior?.caminho) {
    await supabaseAdmin.storage.from(TIPOS_ARQUIVO.pitch.bucket).remove([anterior.caminho]);
  }

  await registrarAuditoria('grupo_arquivos', data.id, anterior ? 'UPDATE' : 'INSERT', usuario.id, {
    grupo_id: grupoId,
    tipo: 'pitch',
    origem: link.origem,
  });

  return { success: true };
}

/**
 * Lista os arquivos do grupo com links de visualização e download.
 * Acesso: professor (somente leitura) e líder/vice-líder do grupo.
 * O campo pode_enviar diz se a tela deve mostrar os controles de envio.
 * Cada item tem origem 'arquivo' ou 'link' (este último só para o pitch).
 *
 * @param {Object} params Parâmetros.
 * @param {string} params.grupoId UUID do grupo.
 * @param {Object} params.usuario Usuário autenticado.
 * @returns {Promise<Object>} Arquivos por tipo e permissão de envio.
 */
export async function listarArquivos({ grupoId, usuario }) {
  const grupo = await buscarGrupo(grupoId);
  const lideranca = ehLiderancaDoGrupo(grupo, usuario);

  if (usuario.role !== 'professor' && usuario.role !== 'avaliador' && !lideranca) {
    throw new AppError(403, 'Sem permissao para ver os arquivos deste grupo');
  }

  const { data: linhas, error } = await supabaseAdmin
    .from('grupo_arquivos')
    .select('*')
    .eq('grupo_id', grupoId);

  if (error) {
    throw new AppError(500, 'Falha ao listar os arquivos do grupo');
  }

  const arquivos = { trabalho: null, pitch: null, logo: null };

  await Promise.all(
    (linhas ?? []).map(async (linha) => {
      if (!temChave(TIPOS_ARQUIVO, linha.tipo)) return;

      if (linha.url_externa) {
        const link = interpretarLinkDePitch(linha.url_externa);
        arquivos[linha.tipo] = {
          origem: 'link',
          nome: linha.nome_original,
          tamanho: null,
          mime: null,
          atualizado_em: linha.updated_at,
          url: null,
          download_url: null,
          link_url: linha.url_externa,
          embed_url: link?.embed ?? null,
        };
        return;
      }

      const config = TIPOS_ARQUIVO[linha.tipo];
      const bucket = supabaseAdmin.storage.from(config.bucket);

      let url = null;
      let downloadUrl = null;

      if (config.publico) {
        url = bucket.getPublicUrl(linha.caminho).data.publicUrl;
        downloadUrl = url;
      } else {
        const [visualizar, baixar] = await Promise.all([
          bucket.createSignedUrl(linha.caminho, SEGUNDOS_URL_ASSINADA),
          bucket.createSignedUrl(linha.caminho, SEGUNDOS_URL_ASSINADA, { download: linha.nome_original }),
        ]);
        url = visualizar.data?.signedUrl ?? null;
        downloadUrl = baixar.data?.signedUrl ?? null;
      }

      arquivos[linha.tipo] = {
        origem: 'arquivo',
        nome: linha.nome_original,
        tamanho: linha.tamanho,
        mime: linha.mime,
        atualizado_em: linha.updated_at,
        url,
        download_url: downloadUrl,
      };
    })
  );

  return { arquivos, pode_enviar: lideranca };
}

/**
 * Devolve as URLs públicas das logos de vários grupos de uma vez
 * (usado no dashboard do professor e no detalhe do grupo).
 * Se algo falhar, devolve vazio e a tela simplesmente fica sem logo.
 *
 * @param {string[]} grupoIds UUIDs dos grupos.
 * @returns {Promise<Object>} Mapa grupoId -> URL pública da logo.
 */
export async function urlsDasLogos(grupoIds) {
  if (!grupoIds || grupoIds.length === 0) return {};

  const { data, error } = await supabaseAdmin
    .from('grupo_arquivos')
    .select('grupo_id, caminho')
    .eq('tipo', 'logo')
    .in('grupo_id', grupoIds);

  if (error) return {};

  const bucket = supabaseAdmin.storage.from(TIPOS_ARQUIVO.logo.bucket);

  return Object.fromEntries(
    (data ?? [])
      .filter((linha) => linha.caminho)
      .map((linha) => [linha.grupo_id, bucket.getPublicUrl(linha.caminho).data.publicUrl])
  );
}