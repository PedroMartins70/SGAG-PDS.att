import { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import Button from './ui/Button.jsx';
import Card from './ui/Card.jsx';
import Modal from './ui/Modal.jsx';
import Input from './ui/Input.jsx';
import ItemArquivo from './ItemArquivo.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { formatarDataHora } from '../lib/materiais.js';

const DESCRICAO_MAX = 500;

const CLASSE_CAMPO =
  'w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted transition-all focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15';

const FORM_VAZIO = { titulo: '', descricao: '', url: '' };

/**
 * Área do Professor para cadastrar relatórios (links do Google Docs).
 * Os relatórios valem para todas as turmas: líderes e vices abrem o link e
 * preenchem direto no Google Docs, onde tudo fica salvo.
 *
 * @returns {JSX.Element} Aba de relatórios do professor.
 */
export default function RelatoriosProfessor() {
  const { session } = useAuth();
  const token = session?.token;

  const [relatorios, setRelatorios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [form, setForm] = useState(FORM_VAZIO);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  const [modal, setModal] = useState(null); // { tipo: 'editar' | 'excluir', relatorio }
  const [edicao, setEdicao] = useState(FORM_VAZIO);
  const [salvandoModal, setSalvandoModal] = useState(false);
  const [erroModal, setErroModal] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const { relatorios: lista } = await api('/relatorios', { token });
      setRelatorios(lista);
    } catch (e) {
      setErro(e.message || 'Nao foi possivel carregar os relatorios.');
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function enviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setMensagem(null);
    try {
      await api('/relatorios', { method: 'POST', token, body: form });
      setForm(FORM_VAZIO);
      await carregar();
      setMensagem({ tipo: 'ok', texto: 'Relatório publicado para todas as turmas!' });
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: e.message || 'Falha ao publicar o relatório.' });
    } finally {
      setEnviando(false);
    }
  }

  function abrirEditar(relatorio) {
    setEdicao({ titulo: relatorio.titulo, descricao: relatorio.descricao ?? '', url: relatorio.url });
    setErroModal('');
    setModal({ tipo: 'editar', relatorio });
  }

  function abrirExcluir(relatorio) {
    setErroModal('');
    setModal({ tipo: 'excluir', relatorio });
  }

  async function salvarEdicao() {
    setSalvandoModal(true);
    setErroModal('');
    try {
      await api(`/relatorios/${modal.relatorio.id}`, { method: 'PUT', token, body: edicao });
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
      await api(`/relatorios/${modal.relatorio.id}`, { method: 'DELETE', token });
      setModal(null);
      await carregar();
    } catch (e) {
      setErroModal(e.message || 'Falha ao excluir.');
    } finally {
      setSalvandoModal(false);
    }
  }

  function abrirLink(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  const pronto = form.titulo.trim().length > 0 && form.url.trim().length > 0 && !enviando;

  return (
    <div className="space-y-6">
      {/* Formulário */}
      <Card className="p-5">
        <h3 className="mb-1 font-display text-lg font-bold text-text">Novo relatório</h3>
        <p className="mb-4 text-sm text-text-muted">
          Cole o link do Google Docs. Ele aparece para os líderes e vices de todas as turmas, que abrem o
          documento e preenchem direto lá (o Google Docs salva sozinho). Lembre de deixar o compartilhamento
          do documento como "qualquer pessoa com o link pode editar" ou compartilhe com os alunos.
        </p>

        <form onSubmit={enviar} className="space-y-4">
          <Input
            label="Título"
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            maxLength={150}
            placeholder="Ex.: Relatório sobre o projeto"
            required
          />

          <Input
            label="Link do Google Docs"
            type="url"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://docs.google.com/document/d/..."
            required
          />

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-text">Descrição (opcional)</span>
            <textarea
              rows={3}
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value.slice(0, DESCRICAO_MAX) })}
              placeholder="Ex.: Preencham o relatório sobre o andamento do projeto até sexta-feira."
              className={CLASSE_CAMPO}
            />
            <span className="mt-1 block text-right text-xs text-text-muted">
              {form.descricao.length} / {DESCRICAO_MAX}
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="success" disabled={!pronto}>
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {enviando ? 'Publicando...' : 'Publicar relatório'}
            </Button>
            {mensagem && (
              <p
                role="status"
                className={`flex items-center gap-1 text-sm font-medium ${
                  mensagem.tipo === 'ok' ? 'text-success' : 'text-danger'
                }`}
              >
                {mensagem.tipo === 'ok' && <Check className="h-4 w-4" />} {mensagem.texto}
              </p>
            )}
          </div>
        </form>
      </Card>

      {/* Lista */}
      <section className="space-y-3">
        <h3 className="font-display text-lg font-bold text-text">Relatórios publicados</h3>

        {carregando ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : erro ? (
          <Card className="p-6 text-center text-sm text-text-muted">{erro}</Card>
        ) : relatorios.length === 0 ? (
          <Card className="p-6 text-center text-sm text-text-muted">Nenhum relatório publicado ainda.</Card>
        ) : (
          relatorios.map((relatorio) => (
            <ItemArquivo
              key={relatorio.id}
              titulo={relatorio.titulo}
              badge="Todas as turmas"
              linhaMeta={`Publicado em ${formatarDataHora(relatorio.created_at)}`}
              observacao={relatorio.descricao}
              acoes={
                <>
                  <Button size="sm" variant="outline" onClick={() => abrirLink(relatorio.url)}>
                    <ExternalLink className="h-4 w-4" /> Abrir
                  </Button>
                  <Button size="sm" variant="outline" aria-label="Editar relatório" onClick={() => abrirEditar(relatorio)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" aria-label="Excluir relatório" onClick={() => abrirExcluir(relatorio)}>
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </>
              }
            />
          ))
        )}
      </section>

      {/* Editar */}
      <Modal open={modal?.tipo === 'editar'} onClose={() => setModal(null)} title="Editar relatório">
        <div className="space-y-4">
          <Input
            label="Título"
            value={edicao.titulo}
            onChange={(e) => setEdicao({ ...edicao, titulo: e.target.value })}
            maxLength={150}
            required
          />
          <Input
            label="Link do Google Docs"
            type="url"
            value={edicao.url}
            onChange={(e) => setEdicao({ ...edicao, url: e.target.value })}
            required
          />
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-text">Descrição</span>
            <textarea
              rows={4}
              value={edicao.descricao}
              onChange={(e) => setEdicao({ ...edicao, descricao: e.target.value.slice(0, DESCRICAO_MAX) })}
              className={CLASSE_CAMPO}
            />
            <span className="mt-1 block text-right text-xs text-text-muted">
              {edicao.descricao.length} / {DESCRICAO_MAX}
            </span>
          </label>
          {erroModal && <p className="text-sm font-medium text-danger">{erroModal}</p>}
          <Button
            className="w-full"
            onClick={salvarEdicao}
            disabled={!edicao.titulo.trim() || !edicao.url.trim() || salvandoModal}
          >
            {salvandoModal ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </Modal>

      {/* Excluir */}
      <Modal open={modal?.tipo === 'excluir'} onClose={() => setModal(null)} title="Remover relatório">
        <p className="text-text-muted">
          Remover <strong className="text-text">{modal?.relatorio?.titulo}</strong>? Ele deixa de aparecer
          para todos os líderes e vices. O documento no Google Docs não é apagado.
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