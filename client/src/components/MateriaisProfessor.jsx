import { useCallback, useEffect, useState } from 'react';
import { Check, Download, ExternalLink, Loader2, Pencil, Trash2, Upload } from 'lucide-react';
import Button from './ui/Button.jsx';
import Card from './ui/Card.jsx';
import Modal from './ui/Modal.jsx';
import Input from './ui/Input.jsx';
import ItemArquivo from './ItemArquivo.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import {
  EXTENSOES_AULA,
  EXTENSOES_MODELO,
  LIMITE_AULA_MB,
  LIMITE_MODELO_MB,
  OBSERVACAO_MAX,
  abrirOuBaixar,
  enviarParaStorage,
  formatarDataHora,
  formatarTamanho,
  podeAbrirNoNavegador,
  validarArquivoLocal,
} from '../lib/materiais.js';

const CLASSE_CAMPO =
  'w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted transition-all focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15';

/**
 * Área do Professor para gerenciar os materiais:
 * - Slides das aulas: enviados por turma (uma ou várias de uma vez), com título e observação.
 * - Modelo do trabalho escrito (Word): um por bimestre, vale para todas as turmas.
 *
 * @returns {JSX.Element} Tela de materiais do professor.
 */
export default function MateriaisProfessor() {
  const [aba, setAba] = useState('aulas');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-text">Materiais</h2>
        <p className="text-text-muted">
          Envie os slides das aulas para as turmas e o modelo do trabalho escrito de cada bimestre.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-border">
        {[
          { key: 'aulas', rotulo: 'Slides das aulas' },
          { key: 'modelos', rotulo: 'Modelo do trabalho escrito' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setAba(item.key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
              aba === item.key
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            {item.rotulo}
          </button>
        ))}
      </div>

      {aba === 'aulas' ? <AbaAulas /> : <AbaModelos />}
    </div>
  );
}

/** Mensagem de sucesso ou erro. */
function Aviso({ mensagem }) {
  if (!mensagem) return null;
  const ok = mensagem.tipo === 'ok';
  return (
    <p role="status" className={`flex items-center gap-1 text-sm font-medium ${ok ? 'text-success' : 'text-danger'}`}>
      {ok && <Check className="h-4 w-4" />} {mensagem.texto}
    </p>
  );
}

// ============================================================================
// Slides das aulas
// ============================================================================

function AbaAulas() {
  const { session } = useAuth();
  const token = session?.token;

  const [turmas, setTurmas] = useState([]);
  const [aulas, setAulas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');

  const [form, setForm] = useState({ titulo: '', observacao: '', turmaIds: [], arquivo: null });
  const [inputKey, setInputKey] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  const [modal, setModal] = useState(null); // { tipo: 'editar' | 'excluir', aula }
  const [edicao, setEdicao] = useState({ titulo: '', observacao: '' });
  const [salvandoModal, setSalvandoModal] = useState(false);
  const [erroModal, setErroModal] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [erroAcao, setErroAcao] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const [dadosTurmas, dadosAulas] = await Promise.all([
        api('/turmas', { token }),
        api('/materiais/aulas', { token }),
      ]);
      setTurmas(dadosTurmas.turmas);
      setAulas(dadosAulas.aulas);
    } catch (e) {
      setErro(e.message || 'Nao foi possivel carregar os materiais.');
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function alternarTurma(id) {
    setForm((f) => ({
      ...f,
      turmaIds: f.turmaIds.includes(id) ? f.turmaIds.filter((x) => x !== id) : [...f.turmaIds, id],
    }));
  }

  function todasAsTurmas() {
    setForm((f) => ({ ...f, turmaIds: f.turmaIds.length === turmas.length ? [] : turmas.map((t) => t.id) }));
  }

  function escolherArquivo(e) {
    const arquivo = e.target.files?.[0] ?? null;
    const problema = arquivo ? validarArquivoLocal(arquivo, EXTENSOES_AULA, LIMITE_AULA_MB) : '';
    if (problema) {
      setMensagem({ tipo: 'erro', texto: problema });
      setInputKey((k) => k + 1);
      setForm((f) => ({ ...f, arquivo: null }));
      return;
    }
    setMensagem(null);
    setForm((f) => ({
      ...f,
      arquivo,
      titulo: f.titulo || (arquivo ? arquivo.name.replace(/\.[^.]+$/, '') : ''),
    }));
  }

  async function enviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setMensagem(null);
    try {
      const { arquivo, titulo, observacao, turmaIds } = form;
      const envio = await api('/materiais/aulas/envio', {
        method: 'POST',
        token,
        body: { nome: arquivo.name, tamanho: arquivo.size },
      });
      await enviarParaStorage(envio, arquivo);
      await api('/materiais/aulas', {
        method: 'POST',
        token,
        body: { caminho: envio.caminho, nome: arquivo.name, titulo, observacao, turma_ids: turmaIds },
      });
      setForm({ titulo: '', observacao: '', turmaIds: [], arquivo: null });
      setInputKey((k) => k + 1);
      await carregar();
      setMensagem({ tipo: 'ok', texto: 'Material enviado!' });
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: e.message || 'Falha ao enviar o material.' });
    } finally {
      setEnviando(false);
    }
  }

  async function acaoArquivo(chave, aula, baixar) {
    setOcupado(chave);
    setErroAcao('');
    try {
      await abrirOuBaixar({ caminho: `/materiais/aulas/${aula.id}/link`, token, baixar });
    } catch (e) {
      setErroAcao(e.message || 'Nao foi possivel abrir o arquivo.');
    } finally {
      setOcupado('');
    }
  }

  function abrirEditar(aula) {
    setEdicao({ titulo: aula.titulo, observacao: aula.observacao ?? '' });
    setErroModal('');
    setModal({ tipo: 'editar', aula });
  }

  function abrirExcluir(aula) {
    setErroModal('');
    setModal({ tipo: 'excluir', aula });
  }

  async function salvarEdicao() {
    setSalvandoModal(true);
    setErroModal('');
    try {
      await api(`/materiais/aulas/${modal.aula.id}`, {
        method: 'PUT',
        token,
        body: { titulo: edicao.titulo, observacao: edicao.observacao },
      });
      setModal(null);
      await carregar();
    } catch (e) {
      setErroModal(e.message || 'Falha ao salvar.');
    } finally {
      setSalvandoModal(false);
    }
  }

  async function confirmarExclusao() {
    setSalvandoModal(true);
    setErroModal('');
    try {
      await api(`/materiais/aulas/${modal.aula.id}`, { method: 'DELETE', token });
      setModal(null);
      await carregar();
    } catch (e) {
      setErroModal(e.message || 'Falha ao excluir.');
    } finally {
      setSalvandoModal(false);
    }
  }

  const pronto = Boolean(form.arquivo) && form.titulo.trim().length > 0 && form.turmaIds.length > 0 && !enviando;
  const aulasFiltradas = filtro ? aulas.filter((a) => a.turma_id === filtro) : aulas;

  return (
    <div className="space-y-6">
      {/* Formulário de envio */}
      <Card className="p-5">
        <h3 className="mb-4 font-display text-lg font-bold text-text">Enviar novo material</h3>

        <form onSubmit={enviar} className="space-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-semibold text-text">Turmas que vão receber</span>
            <div className="flex flex-wrap gap-2">
              {turmas.map((turma) => {
                const marcada = form.turmaIds.includes(turma.id);
                return (
                  <button
                    key={turma.id}
                    type="button"
                    aria-pressed={marcada}
                    onClick={() => alternarTurma(turma.id)}
                    className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                      marcada
                        ? 'border-primary bg-primary-soft text-primary'
                        : 'border-border bg-surface text-text-muted hover:bg-surface-muted'
                    }`}
                  >
                    Turma {turma.nome}
                  </button>
                );
              })}
              {turmas.length > 1 && (
                <button
                  type="button"
                  onClick={todasAsTurmas}
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-primary hover:underline"
                >
                  {form.turmaIds.length === turmas.length ? 'Limpar' : 'Todas'}
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-text-muted">
              Cada turma ganha o seu próprio item, com a sua data. Para postar depois para outra turma,
              é só enviar de novo.
            </p>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-text">Arquivo</span>
            <input
              key={inputKey}
              type="file"
              accept={EXTENSOES_AULA.map((e) => `.${e}`).join(',')}
              onChange={escolherArquivo}
              className="block w-full text-sm text-text file:mr-3 file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary"
            />
            <span className="mt-1 block text-xs text-text-muted">
              {EXTENSOES_AULA.join(', ')} · até {LIMITE_AULA_MB} MB
            </span>
          </label>

          <Input
            label="Título"
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            maxLength={150}
            required
          />

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-text">Observação (opcional)</span>
            <textarea
              rows={3}
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value.slice(0, OBSERVACAO_MAX) })}
              placeholder="Ex.: ler o capítulo 3 antes da próxima aula."
              className={CLASSE_CAMPO}
            />
            <span className="mt-1 block text-right text-xs text-text-muted">
              {form.observacao.length} / {OBSERVACAO_MAX}
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="success" disabled={!pronto}>
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {enviando ? 'Enviando...' : 'Enviar material'}
            </Button>
            <Aviso mensagem={mensagem} />
          </div>
        </form>
      </Card>

      {/* Lista */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg font-bold text-text">Materiais enviados</h3>
          <div className="flex flex-wrap gap-1">
            {[{ id: '', nome: 'Todas' }, ...turmas].map((turma) => (
              <button
                key={turma.id || 'todas'}
                type="button"
                onClick={() => setFiltro(turma.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-all ${
                  filtro === turma.id
                    ? 'bg-primary text-white'
                    : 'border border-border bg-surface text-text-muted hover:border-primary'
                }`}
              >
                {turma.id ? `Turma ${turma.nome}` : turma.nome}
              </button>
            ))}
          </div>
        </div>

        {erroAcao && (
          <div className="rounded-lg border border-danger-soft bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
            {erroAcao}
          </div>
        )}

        {carregando ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : erro ? (
          <Card className="p-6 text-center text-sm text-text-muted">{erro}</Card>
        ) : aulasFiltradas.length === 0 ? (
          <Card className="p-6 text-center text-sm text-text-muted">Nenhum material enviado ainda.</Card>
        ) : (
          aulasFiltradas.map((aula) => (
            <ItemArquivo
              key={aula.id}
              titulo={aula.titulo}
              badge={aula.turma_nome ? `Turma ${aula.turma_nome}` : undefined}
              linhaMeta={[`Enviado em ${formatarDataHora(aula.created_at)}`, aula.nome_original, formatarTamanho(aula.tamanho)]
                .filter(Boolean)
                .join(' · ')}
              observacao={aula.observacao}
              acoes={
                <>
                  {podeAbrirNoNavegador(aula.nome_original) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => acaoArquivo(`abrir-${aula.id}`, aula, false)}
                      disabled={ocupado === `abrir-${aula.id}`}
                    >
                      <ExternalLink className="h-4 w-4" /> Abrir
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => acaoArquivo(`baixar-${aula.id}`, aula, true)}
                    disabled={ocupado === `baixar-${aula.id}`}
                  >
                    <Download className="h-4 w-4" /> Baixar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => abrirEditar(aula)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => abrirExcluir(aula)}>
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </>
              }
            />
          ))
        )}
      </section>

      {/* Editar título e observação */}
      <Modal open={modal?.tipo === 'editar'} onClose={() => setModal(null)} title="Editar material">
        <div className="space-y-4">
          <Input
            label="Título"
            value={edicao.titulo}
            onChange={(e) => setEdicao({ ...edicao, titulo: e.target.value })}
            maxLength={150}
            required
          />
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-text">Observação</span>
            <textarea
              rows={4}
              value={edicao.observacao}
              onChange={(e) => setEdicao({ ...edicao, observacao: e.target.value.slice(0, OBSERVACAO_MAX) })}
              className={CLASSE_CAMPO}
            />
            <span className="mt-1 block text-right text-xs text-text-muted">
              {edicao.observacao.length} / {OBSERVACAO_MAX}
            </span>
          </label>
          {erroModal && <p className="text-sm font-medium text-danger">{erroModal}</p>}
          <Button className="w-full" onClick={salvarEdicao} disabled={!edicao.titulo.trim() || salvandoModal}>
            {salvandoModal ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </Modal>

      {/* Confirmar exclusão */}
      <Modal open={modal?.tipo === 'excluir'} onClose={() => setModal(null)} title="Remover material">
        <p className="text-text-muted">
          Remover <strong className="text-text">{modal?.aula?.titulo}</strong>
          {modal?.aula?.turma_nome ? ` da turma ${modal.aula.turma_nome}` : ''}? Os líderes dessa turma
          deixam de ver este material. Os itens das outras turmas não mudam.
        </p>
        {erroModal && <p className="mt-3 text-sm font-medium text-danger">{erroModal}</p>}
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>
            Cancelar
          </Button>
          <Button variant="danger" className="flex-1" onClick={confirmarExclusao} disabled={salvandoModal}>
            {salvandoModal ? 'Removendo...' : 'Remover'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================================
// Modelo do trabalho escrito (um por bimestre)
// ============================================================================

function AbaModelos() {
  const { session } = useAuth();
  const token = session?.token;

  const [modelos, setModelos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [erroAcao, setErroAcao] = useState('');
  const [ocupado, setOcupado] = useState('');

  const [modal, setModal] = useState(null); // { tipo: 'salvar' | 'remover', modelo }
  const [formModelo, setFormModelo] = useState({ arquivo: null, observacao: '' });
  const [inputKey, setInputKey] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const { modelos: lista } = await api('/materiais/modelos', { token });
      setModelos(lista);
    } catch (e) {
      setErro(e.message || 'Nao foi possivel carregar os modelos.');
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirSalvar(modelo) {
    setFormModelo({ arquivo: null, observacao: modelo.observacao ?? '' });
    setInputKey((k) => k + 1);
    setErroModal('');
    setModal({ tipo: 'salvar', modelo });
  }

  function escolherArquivo(e) {
    const arquivo = e.target.files?.[0] ?? null;
    const problema = arquivo ? validarArquivoLocal(arquivo, EXTENSOES_MODELO, LIMITE_MODELO_MB) : '';
    if (problema) {
      setErroModal(problema);
      setInputKey((k) => k + 1);
      setFormModelo((f) => ({ ...f, arquivo: null }));
      return;
    }
    setErroModal('');
    setFormModelo((f) => ({ ...f, arquivo }));
  }

  async function salvar() {
    const { bimestre } = modal.modelo;
    setSalvando(true);
    setErroModal('');
    try {
      if (formModelo.arquivo) {
        const envio = await api(`/materiais/modelos/${bimestre}/envio`, {
          method: 'POST',
          token,
          body: { nome: formModelo.arquivo.name, tamanho: formModelo.arquivo.size },
        });
        await enviarParaStorage(envio, formModelo.arquivo);
        await api(`/materiais/modelos/${bimestre}`, {
          method: 'PUT',
          token,
          body: { caminho: envio.caminho, nome: formModelo.arquivo.name, observacao: formModelo.observacao },
        });
      } else {
        await api(`/materiais/modelos/${bimestre}`, {
          method: 'PUT',
          token,
          body: { observacao: formModelo.observacao },
        });
      }
      setModal(null);
      await carregar();
    } catch (e) {
      setErroModal(e.message || 'Falha ao salvar o modelo.');
    } finally {
      setSalvando(false);
    }
  }

  async function remover() {
    setSalvando(true);
    setErroModal('');
    try {
      await api(`/materiais/modelos/${modal.modelo.bimestre}`, { method: 'DELETE', token });
      setModal(null);
      await carregar();
    } catch (e) {
      setErroModal(e.message || 'Falha ao remover o modelo.');
    } finally {
      setSalvando(false);
    }
  }

  async function baixar(modelo) {
    setOcupado(`modelo-${modelo.bimestre}`);
    setErroAcao('');
    try {
      await abrirOuBaixar({ caminho: `/materiais/modelos/${modelo.bimestre}/link`, token, baixar: true });
    } catch (e) {
      setErroAcao(e.message || 'Nao foi possivel baixar o arquivo.');
    } finally {
      setOcupado('');
    }
  }

  if (carregando) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (erro) {
    return <Card className="p-6 text-center text-sm text-text-muted">{erro}</Card>;
  }

  const existeArquivo = Boolean(modal?.modelo?.disponivel);

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        O modelo é enviado uma vez por bimestre e fica disponível para todas as turmas e grupos, e
        também para os avaliadores. Formatos aceitos: {EXTENSOES_MODELO.join(', ')} · até {LIMITE_MODELO_MB} MB.
      </p>

      {erroAcao && (
        <div className="rounded-lg border border-danger-soft bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
          {erroAcao}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {modelos.map((modelo) => (
          <Card key={modelo.bimestre} className="p-4">
            <p className="mb-2 font-display text-lg font-bold text-primary">{modelo.bimestre}º bimestre</p>

            {modelo.disponivel ? (
              <>
                <p className="break-words text-sm font-semibold text-text">{modelo.nome_original}</p>
                <p className="text-xs text-text-muted">
                  {[formatarTamanho(modelo.tamanho), `atualizado em ${formatarDataHora(modelo.updated_at)}`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {modelo.observacao && (
                  <p className="mt-2 whitespace-pre-wrap rounded-lg bg-canvas px-3 py-2 text-sm text-text">
                    {modelo.observacao}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-text-muted">Nenhum modelo enviado.</p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant={modelo.disponivel ? 'outline' : 'success'} onClick={() => abrirSalvar(modelo)}>
                {modelo.disponivel ? <Pencil className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                {modelo.disponivel ? 'Trocar / editar' : 'Enviar modelo'}
              </Button>
              {modelo.disponivel && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => baixar(modelo)}
                    disabled={ocupado === `modelo-${modelo.bimestre}`}
                  >
                    <Download className="h-4 w-4" /> Baixar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setErroModal('');
                      setModal({ tipo: 'remover', modelo });
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Enviar / trocar / editar observação */}
      <Modal
        open={modal?.tipo === 'salvar'}
        onClose={() => setModal(null)}
        title={`Modelo do ${modal?.modelo?.bimestre}º bimestre`}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-text">
              {existeArquivo ? 'Novo arquivo (deixe vazio para manter o atual)' : 'Arquivo do modelo'}
            </span>
            <input
              key={inputKey}
              type="file"
              accept={EXTENSOES_MODELO.map((e) => `.${e}`).join(',')}
              onChange={escolherArquivo}
              className="block w-full text-sm text-text file:mr-3 file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-text">Observação (opcional)</span>
            <textarea
              rows={4}
              value={formModelo.observacao}
              onChange={(e) => setFormModelo({ ...formModelo, observacao: e.target.value.slice(0, OBSERVACAO_MAX) })}
              placeholder="Ex.: usar este modelo no trabalho do 2º bimestre."
              className={CLASSE_CAMPO}
            />
            <span className="mt-1 block text-right text-xs text-text-muted">
              {formModelo.observacao.length} / {OBSERVACAO_MAX}
            </span>
          </label>

          {erroModal && <p className="text-sm font-medium text-danger">{erroModal}</p>}
          <Button
            className="w-full"
            onClick={salvar}
            disabled={salvando || (!existeArquivo && !formModelo.arquivo)}
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </Modal>

      {/* Confirmar remoção */}
      <Modal open={modal?.tipo === 'remover'} onClose={() => setModal(null)} title="Remover modelo">
        <p className="text-text-muted">
          Remover o modelo do <strong className="text-text">{modal?.modelo?.bimestre}º bimestre</strong>? Ele
          deixa de aparecer para os líderes, vices e avaliadores.
        </p>
        {erroModal && <p className="mt-3 text-sm font-medium text-danger">{erroModal}</p>}
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>
            Cancelar
          </Button>
          <Button variant="danger" className="flex-1" onClick={remover} disabled={salvando}>
            {salvando ? 'Removendo...' : 'Remover'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
