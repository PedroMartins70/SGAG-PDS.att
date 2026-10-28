import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/error.middleware.js';
import { registrarAuditoria } from '../utils/audit.js';

const MB = 1024 * 1024;

/** Espaço de arquivos PRIVADO criado em migracao_materiais.sql. */
export const BUCKET = 'materiais';

/** Validade (em segundos) do link temporário de abrir/baixar. */
const SEGUNDOS_LINK = 120;

/** Extensão -> tipo MIME aceito. */
const MIME = {
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt: 'application/vnd.ms-powerpoint',
  odp: 'application/vnd.oasis.opendocument.presentation',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  dotx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  zip: 'application/zip',
};
const pegar = (...exts) => Object.fromEntries(exts.map((e) => [e, MIME[e]]));

/** Tipos de material aceitos. Os MIME types precisam bater com o espaço criado no SQL. */
export const TIPOS = {
  aula: {
    prefixo: 'aulas',
    limite: 25 * MB,
    rotulo: 'material de aula',
    extensoes: pegar('pdf', 'pptx', 'ppt', 'odp', 'docx', 'doc', 'xlsx', 'xls', 'png', 'jpg', 'jpeg', 'webp', 'zip'),
  },
  modelo: {
    prefixo: 'modelos',
    limite: 15 * MB,
    rotulo: 'modelo do trabalho escrito',
    extensoes: pegar('docx', 'doc', 'dotx'),
  },
};

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const temChave = (objeto, chave) => Object.prototype.hasOwnProperty.call(objeto, chave);

/** Extensão (minúscula, sem o ponto) de um nome de arquivo. */
function extensaoDe(nome) {
  const partes = String(nome).split('.');
  return partes.length > 1 ? partes.pop().toLowerCase() : '';
}

/** Remove pastas do nome do arquivo e limita o tamanho. */
function nomeSeguro(nome) {
  return String(nome).split(/[\\/]/).pop().slice(0, 255);
}

/** Só o professor passa. */
function exigirProfessor(usuario) {
  if (usuario?.role !== 'professor') {
    throw new AppError(403, 'Apenas o professor pode fazer isso');
  }
}

/** Valida extensão e tamanho; devolve a extensão e o MIME. */
function validarArquivo(tipo, nome, tamanho) {
  const config = TIPOS[tipo];
  const extensao = extensaoDe(nome);
  if (!extensao || !temChave(config.extensoes, extensao)) {
    throw new AppError(
      400,
      `Formato nao permitido para ${config.rotulo}. Aceitos: ${Object.keys(config.extensoes).join(', ')}`
    );
  }
  if (!tamanho || tamanho > config.limite) {
    throw new AppError(400, `Arquivo acima do limite de ${config.limite / MB} MB`);
  }
  return { extensao, mime: config.extensoes[extensao] };
}

/**
 * Cria um link de envio direto ao armazenamento (vale só para um caminho).
 * O arquivo vai do navegador para o Supabase, sem passar pelo servidor.
 */
async function gerarEnvio(tipo, nome, tamanho, prefixoNome = '') {
  const { extensao, mime } = validarArquivo(tipo, nome, tamanho);
  const caminho = `${TIPOS[tipo].prefixo}/${prefixoNome}${randomUUID()}.${extensao}`;

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(caminho);
  if (error || !data?.token) {
    console.error('Erro ao criar link de envio:', error);
    throw new AppError(500, 'Nao foi possivel preparar o envio do arquivo');
  }
  return { bucket: BUCKET, caminho, token: data.token, mime };
}

/** O caminho recebido precisa ter exatamente o formato que o servidor gera. */
function caminhoValido(tipo, caminho, bimestre) {
  const extensoes = Object.keys(TIPOS[tipo].extensoes).join('|');
  const regex =
    tipo === 'aula'
      ? new RegExp(`^aulas/${UUID}\\.(${extensoes})$`)
      : new RegExp(`^modelos/${bimestre}-${UUID}\\.(${extensoes})$`);
  return regex.test(caminho);
}

/** Confere que o arquivo realmente chegou ao armazenamento e respeita o limite. */
async function conferirObjeto(tipo, caminho, bimestre) {
  const config = TIPOS[tipo];
  if (!caminhoValido(tipo, caminho, bimestre)) {
    throw new AppError(409, 'Caminho de arquivo invalido');
  }

  const nome = caminho.slice(config.prefixo.length + 1);
  const { data: itens, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .list(config.prefixo, { limit: 100, search: nome });
  const objeto = (itens ?? []).find((item) => item.name === nome);

  if (error || !objeto) {
    throw new AppError(400, 'O arquivo nao foi encontrado no armazenamento. Tente enviar novamente.');
  }

  const tamanho = Number(objeto.metadata?.size ?? 0) || null;
  if (tamanho && tamanho > config.limite) {
    await supabaseAdmin.storage.from(BUCKET).remove([caminho]);
    throw new AppError(400, `Arquivo acima do limite de ${config.limite / MB} MB`);
  }
  return { tamanho, mime: config.extensoes[extensaoDe(nome)] ?? null };
}

/** Link temporário para abrir (nomeParaBaixar = false) ou baixar o arquivo. */
async function assinar(caminho, nomeParaBaixar) {
  const opcoes = nomeParaBaixar ? { download: nomeParaBaixar } : undefined;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(caminho, SEGUNDOS_LINK, opcoes);
  if (error || !data?.signedUrl) {
    console.error('Erro ao gerar link do arquivo:', error);
    throw new AppError(500, 'Nao foi possivel gerar o link do arquivo');
  }
  return data.signedUrl;
}

/** Ids das turmas dos grupos em que o usuário é líder ou vice-líder. */
async function turmasDoUsuario(usuario) {
  const [lider, vice] = await Promise.all([
    supabaseAdmin.from('grupos').select('turma_id').eq('lider_id', usuario.id),
    supabaseAdmin.from('grupos').select('turma_id').eq('vice_lider_id', usuario.id),
  ]);
  if (lider.error || vice.error) {
    throw new AppError(500, 'Falha ao consultar a turma do usuario');
  }
  return [...new Set([...(lider.data ?? []), ...(vice.data ?? [])].map((g) => g.turma_id))];
}

/** Professor vê tudo; líder e vice só os da própria turma; avaliador nenhum. */
async function exigirAcessoAula(turmaId, usuario) {
  if (usuario.role === 'professor') return;
  if (usuario.role === 'lider' || usuario.role === 'vice_lider') {
    const turmas = await turmasDoUsuario(usuario);
    if (turmas.includes(turmaId)) return;
  }
  throw new AppError(403, 'Sem permissao para acessar este material');
}

/** Apaga o arquivo do armazenamento se nenhuma turma usa mais ele. */
async function removerSeOrfao(caminho) {
  const { count } = await supabaseAdmin
    .from('materiais_aula')
    .select('id', { count: 'exact', head: true })
    .eq('caminho', caminho);
  if ((count ?? 0) === 0) {
    await supabaseAdmin.storage.from(BUCKET).remove([caminho]);
  }
}

// ============================================================================
// SLIDES / MATERIAIS DAS AULAS (por turma)
// ============================================================================

/**
 * Pede o link de envio de um material de aula (somente professor).
 *
 * @param {Object} params Parâmetros.
 * @param {string} params.nome Nome do arquivo.
 * @param {number} params.tamanho Tamanho em bytes.
 * @param {Object} params.usuario Usuário autenticado.
 * @returns {Promise<{bucket: string, caminho: string, token: string, mime: string}>} Dados do envio.
 */
export async function gerarEnvioAula({ nome, tamanho, usuario }) {
  exigirProfessor(usuario);
  return gerarEnvio('aula', nome, tamanho);
}

/**
 * Registra o material enviado em uma ou mais turmas (somente professor).
 * O arquivo é guardado uma vez; cada turma ganha o seu item, com a sua data.
 *
 * @param {Object} params Parâmetros.
 * @param {string} params.caminho Caminho devolvido por gerarEnvioAula.
 * @param {string} params.nome Nome original do arquivo.
 * @param {string} params.titulo Título escolhido pelo professor.
 * @param {string} [params.observacao] Observação opcional.
 * @param {string[]} params.turmaIds Turmas que verão o material.
 * @param {Object} params.usuario Usuário autenticado.
 * @returns {Promise<Object[]>} Itens criados.
 */
export async function criarAula({ caminho, nome, titulo, observacao, turmaIds, usuario }) {
  exigirProfessor(usuario);
  const { tamanho, mime } = await conferirObjeto('aula', caminho);

  const unicas = [...new Set(turmaIds)];
  const { data: turmas, error: erroTurmas } = await supabaseAdmin.from('turmas').select('id').in('id', unicas);
  if (erroTurmas || (turmas ?? []).length !== unicas.length) {
    await removerSeOrfao(caminho);
    throw new AppError(400, 'Turma invalida');
  }

  const linhas = unicas.map((turmaId) => ({
    turma_id: turmaId,
    titulo: titulo.trim(),
    observacao: observacao?.trim() || null,
    caminho,
    nome_original: nomeSeguro(nome),
    mime,
    tamanho,
    enviado_por: usuario.id,
  }));

  const { data, error } = await supabaseAdmin
    .from('materiais_aula')
    .insert(linhas)
    .select('id, turma_id, titulo, created_at');

  if (error) {
    await removerSeOrfao(caminho);
    if (error.code === '23505') {
      throw new AppError(409, 'Este arquivo ja foi registrado para a turma');
    }
    throw new AppError(400, `Falha ao registrar o material: ${error.message}`);
  }

  for (const item of data) {
    await registrarAuditoria('materiais_aula', item.id, 'INSERT', usuario.id, {
      turma_id: item.turma_id,
      titulo: item.titulo,
      nome_original: nomeSeguro(nome),
      tamanho,
    });
  }
  return data;
}

/**
 * Lista os materiais de aula.
 * - Professor: todos (ou só de uma turma, se turmaId for informado).
 * - Líder e Vice-Líder: apenas os da própria turma.
 * - Avaliador: sem acesso.
 *
 * @param {Object} params Parâmetros.
 * @param {Object} params.usuario Usuário autenticado.
 * @param {string} [params.turmaId] Filtro de turma (só vale para o professor).
 * @returns {Promise<Object[]>} Materiais, do mais recente para o mais antigo.
 */
export async function listarAulas({ usuario, turmaId }) {
  let consulta = supabaseAdmin
    .from('materiais_aula')
    .select('id, turma_id, titulo, observacao, nome_original, mime, tamanho, created_at')
    .order('created_at', { ascending: false });

  if (usuario.role === 'professor') {
    if (turmaId) consulta = consulta.eq('turma_id', turmaId);
  } else if (usuario.role === 'lider' || usuario.role === 'vice_lider') {
    const turmas = await turmasDoUsuario(usuario);
    if (turmas.length === 0) return [];
    consulta = consulta.in('turma_id', turmas);
  } else {
    throw new AppError(403, 'Sem permissao para ver os materiais das aulas');
  }

  const [{ data: aulas, error }, { data: turmasLista }] = await Promise.all([
    consulta,
    supabaseAdmin.from('turmas').select('id, nome'),
  ]);
  if (error) {
    throw new AppError(500, 'Falha ao listar os materiais');
  }

  const nomes = Object.fromEntries((turmasLista ?? []).map((t) => [t.id, t.nome]));
  return aulas.map((aula) => ({ ...aula, turma_nome: nomes[aula.turma_id] ?? null }));
}

/**
 * Link temporário para abrir ou baixar um material de aula.
 *
 * @param {Object} params Parâmetros.
 * @param {string} params.id UUID do material.
 * @param {boolean} params.baixar true para forçar o download.
 * @param {Object} params.usuario Usuário autenticado.
 * @returns {Promise<string>} URL temporária.
 */
export async function gerarLinkAula({ id, baixar, usuario }) {
  const { data: aula } = await supabaseAdmin.from('materiais_aula').select('*').eq('id', id).maybeSingle();
  if (!aula) {
    throw new AppError(404, 'Material nao encontrado');
  }
  await exigirAcessoAula(aula.turma_id, usuario);
  return assinar(aula.caminho, baixar ? aula.nome_original : false);
}

/**
 * Altera título e/ou observação de um material (somente professor).
 *
 * @param {Object} params Parâmetros.
 * @param {string} params.id UUID do material.
 * @param {string} [params.titulo] Novo título.
 * @param {string} [params.observacao] Nova observação ('' apaga).
 * @param {Object} params.usuario Usuário autenticado.
 * @returns {Promise<Object>} Material atualizado.
 */
export async function editarAula({ id, titulo, observacao, usuario }) {
  exigirProfessor(usuario);

  const mudancas = { updated_at: new Date().toISOString() };
  if (titulo !== undefined) mudancas.titulo = titulo.trim();
  if (observacao !== undefined) mudancas.observacao = observacao.trim() || null;

  const { data, error } = await supabaseAdmin
    .from('materiais_aula')
    .update(mudancas)
    .eq('id', id)
    .select('id, turma_id, titulo, observacao')
    .maybeSingle();

  if (error) {
    throw new AppError(400, `Falha ao editar o material: ${error.message}`);
  }
  if (!data) {
    throw new AppError(404, 'Material nao encontrado');
  }

  await registrarAuditoria('materiais_aula', id, 'UPDATE', usuario.id, {
    turma_id: data.turma_id,
    titulo: data.titulo,
  });
  return data;
}

/**
 * Remove um material de uma turma (somente professor). O arquivo só sai do
 * armazenamento quando nenhuma outra turma usa ele.
 *
 * @param {Object} params Parâmetros.
 * @param {string} params.id UUID do material.
 * @param {Object} params.usuario Usuário autenticado.
 * @returns {Promise<{success: boolean}>} Resultado.
 */
export async function excluirAula({ id, usuario }) {
  exigirProfessor(usuario);

  const { data: aula } = await supabaseAdmin.from('materiais_aula').select('*').eq('id', id).maybeSingle();
  if (!aula) {
    throw new AppError(404, 'Material nao encontrado');
  }

  const { error } = await supabaseAdmin.from('materiais_aula').delete().eq('id', id);
  if (error) {
    throw new AppError(400, `Falha ao excluir o material: ${error.message}`);
  }

  await removerSeOrfao(aula.caminho);
  await registrarAuditoria('materiais_aula', id, 'DELETE', usuario.id, {
    turma_id: aula.turma_id,
    titulo: aula.titulo,
    nome_original: aula.nome_original,
  });
  return { success: true };
}

// ============================================================================
// MODELO DO TRABALHO ESCRITO (Word) — um por bimestre, vale para todos
// ============================================================================

/** Perfis que podem ver o modelo do trabalho. */
const PERFIS_MODELO = ['professor', 'lider', 'vice_lider', 'avaliador'];

function exigirPerfilDoModelo(usuario) {
  if (!PERFIS_MODELO.includes(usuario?.role)) {
    throw new AppError(403, 'Sem permissao para ver o modelo do trabalho');
  }
}

/**
 * Pede o link de envio do modelo de um bimestre (somente professor).
 *
 * @param {Object} params Parâmetros.
 * @param {number} params.bimestre Bimestre (1 a 4).
 * @param {string} params.nome Nome do arquivo.
 * @param {number} params.tamanho Tamanho em bytes.
 * @param {Object} params.usuario Usuário autenticado.
 * @returns {Promise<{bucket: string, caminho: string, token: string, mime: string}>} Dados do envio.
 */
export async function gerarEnvioModelo({ bimestre, nome, tamanho, usuario }) {
  exigirProfessor(usuario);
  return gerarEnvio('modelo', nome, tamanho, `${bimestre}-`);
}

/**
 * Lista o modelo dos 4 bimestres (os sem arquivo vêm como indisponíveis).
 * Visível para professor, líder, vice-líder e avaliador.
 *
 * @param {Object} usuario Usuário autenticado.
 * @returns {Promise<Object[]>} Lista com 4 itens.
 */
export async function listarModelos(usuario) {
  exigirPerfilDoModelo(usuario);

  const { data, error } = await supabaseAdmin
    .from('modelos_trabalho')
    .select('bimestre, nome_original, mime, tamanho, observacao, updated_at');
  if (error) {
    throw new AppError(500, 'Falha ao listar os modelos');
  }

  return [1, 2, 3, 4].map((bimestre) => {
    const linha = (data ?? []).find((m) => m.bimestre === bimestre);
    return linha ? { ...linha, disponivel: true } : { bimestre, disponivel: false };
  });
}

/**
 * Salva o modelo de um bimestre: novo arquivo e/ou observação (somente professor).
 * Ao trocar o arquivo, o anterior é apagado.
 *
 * @param {Object} params Parâmetros.
 * @param {number} params.bimestre Bimestre (1 a 4).
 * @param {string} [params.caminho] Caminho devolvido por gerarEnvioModelo.
 * @param {string} [params.nome] Nome original do arquivo.
 * @param {string} [params.observacao] Observação ('' apaga; omitido mantém).
 * @param {Object} params.usuario Usuário autenticado.
 * @returns {Promise<Object>} Modelo salvo.
 */
export async function salvarModelo({ bimestre, caminho, nome, observacao, usuario }) {
  exigirProfessor(usuario);

  const { data: anterior } = await supabaseAdmin
    .from('modelos_trabalho')
    .select('*')
    .eq('bimestre', bimestre)
    .maybeSingle();

  if (!caminho && !anterior) {
    throw new AppError(400, 'Envie o arquivo do modelo');
  }

  const linha = {
    bimestre,
    caminho: anterior?.caminho,
    nome_original: anterior?.nome_original,
    mime: anterior?.mime ?? null,
    tamanho: anterior?.tamanho ?? null,
    observacao: anterior?.observacao ?? null,
    enviado_por: usuario.id,
    updated_at: new Date().toISOString(),
  };

  if (caminho) {
    const { tamanho, mime } = await conferirObjeto('modelo', caminho, bimestre);
    linha.caminho = caminho;
    linha.nome_original = nomeSeguro(nome);
    linha.mime = mime;
    linha.tamanho = tamanho;
  }
  if (observacao !== undefined) {
    linha.observacao = observacao.trim() || null;
  }

  const { data, error } = await supabaseAdmin
    .from('modelos_trabalho')
    .upsert(linha, { onConflict: 'bimestre' })
    .select('id, bimestre, nome_original, tamanho, observacao, updated_at')
    .single();

  if (error) {
    throw new AppError(400, `Falha ao salvar o modelo: ${error.message}`);
  }

  if (anterior && caminho && anterior.caminho !== caminho) {
    await supabaseAdmin.storage.from(BUCKET).remove([anterior.caminho]);
  }

  await registrarAuditoria('modelos_trabalho', data.id, anterior ? 'UPDATE' : 'INSERT', usuario.id, {
    bimestre,
    nome_original: data.nome_original,
    trocou_arquivo: Boolean(caminho),
  });
  return { ...data, disponivel: true };
}

/**
 * Link temporário para abrir ou baixar o modelo de um bimestre.
 *
 * @param {Object} params Parâmetros.
 * @param {number} params.bimestre Bimestre (1 a 4).
 * @param {boolean} params.baixar true para forçar o download.
 * @param {Object} params.usuario Usuário autenticado.
 * @returns {Promise<string>} URL temporária.
 */
export async function gerarLinkModelo({ bimestre, baixar, usuario }) {
  exigirPerfilDoModelo(usuario);

  const { data: modelo } = await supabaseAdmin
    .from('modelos_trabalho')
    .select('caminho, nome_original')
    .eq('bimestre', bimestre)
    .maybeSingle();
  if (!modelo) {
    throw new AppError(404, 'O modelo deste bimestre ainda nao foi enviado');
  }
  return assinar(modelo.caminho, baixar ? modelo.nome_original : false);
}

/**
 * Remove o modelo de um bimestre (somente professor).
 *
 * @param {Object} params Parâmetros.
 * @param {number} params.bimestre Bimestre (1 a 4).
 * @param {Object} params.usuario Usuário autenticado.
 * @returns {Promise<{success: boolean}>} Resultado.
 */
export async function excluirModelo({ bimestre, usuario }) {
  exigirProfessor(usuario);

  const { data: modelo } = await supabaseAdmin
    .from('modelos_trabalho')
    .select('*')
    .eq('bimestre', bimestre)
    .maybeSingle();
  if (!modelo) {
    throw new AppError(404, 'Nao ha modelo enviado para este bimestre');
  }

  const { error } = await supabaseAdmin.from('modelos_trabalho').delete().eq('bimestre', bimestre);
  if (error) {
    throw new AppError(400, `Falha ao remover o modelo: ${error.message}`);
  }

  await supabaseAdmin.storage.from(BUCKET).remove([modelo.caminho]);
  await registrarAuditoria('modelos_trabalho', modelo.id, 'DELETE', usuario.id, {
    bimestre,
    nome_original: modelo.nome_original,
  });
  return { success: true };
}