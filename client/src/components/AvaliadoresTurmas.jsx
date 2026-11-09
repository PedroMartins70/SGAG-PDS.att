import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Trash2, Users } from 'lucide-react';
import Button from './ui/Button.jsx';
import Card from './ui/Card.jsx';
import Badge from './ui/Badge.jsx';
import Avatar from './ui/Avatar.jsx';
import Modal from './ui/Modal.jsx';
import Input from './ui/Input.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../auth/AuthContext.jsx';

/**
 * Quadro "Avaliadores e turmas" do painel do professor.
 * Lista todos os avaliadores cadastrados com as turmas que cada um avalia e
 * permite: trocar as turmas, editar o nome e excluir o perfil.
 *
 * @param {Object} props Propriedades do quadro.
 * @param {Array<{id: string, nome: string}>} props.turmas Todas as turmas disponíveis.
 * @returns {JSX.Element} Quadro de avaliadores.
 */
export default function AvaliadoresTurmas({ turmas = [] }) {
  const { session } = useAuth();
  const token = session?.token;

  const [avaliadores, setAvaliadores] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [modal, setModal] = useState(null);
  const [nome, setNome] = useState('');
  const [turmaIds, setTurmaIds] = useState([]);
  const [erroModal, setErroModal] = useState('');
  const [salvando, setSalvando] = useState(false);

  /** Carrega os avaliadores com suas turmas. */
  const carregar = useCallback(async () => {
    setErro('');
    try {
      const { avaliadores } = await api('/profiles/avaliadores', { token });
      setAvaliadores(avaliadores);
    } catch (e) {
      setErro(e.message || 'Falha ao carregar os avaliadores.');
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /** Abre um modal de ação para um avaliador. */
  function abrir(tipo, avaliador) {
    setErroModal('');
    setNome(avaliador.nome);
    setTurmaIds(avaliador.turmas.map((t) => t.id));
    setModal({ tipo, avaliador });
  }

  /** Marca ou desmarca uma turma. */
  function alternarTurma(turmaId) {
    setTurmaIds((atual) =>
      atual.includes(turmaId) ? atual.filter((id) => id !== turmaId) : [...atual, turmaId]
    );
  }

  /**
   * Executa uma ação, mostra o erro dentro do modal se falhar e recarrega a lista se der certo.
   *
   * @param {Function} acao Função assíncrona com a chamada à API.
   */
  async function executar(acao) {
    setSalvando(true);
    setErroModal('');
    try {
      await acao();
      setModal(null);
      await carregar();
    } catch (e) {
      setErroModal(e.message || 'Não foi possível concluir a ação.');
    } finally {
      setSalvando(false);
    }
  }

  const salvarTurmas = () =>
    executar(() =>
      api(`/profiles/avaliadores/${modal.avaliador.id}/turmas`, {
        method: 'PUT',
        token,
        body: { turma_ids: turmaIds },
      })
    );

  const salvarNome = () =>
    executar(() =>
      api(`/profiles/avaliadores/${modal.avaliador.id}`, {
        method: 'PUT',
        token,
        body: { nome: nome.trim() },
      })
    );

  const excluir = () =>
    executar(() => api(`/profiles/avaliadores/${modal.avaliador.id}`, { method: 'DELETE', token }));

  const avaliadorModal = modal?.avaliador;

  return (
    <section>
      <h2 className="mb-1 font-display text-2xl font-bold text-text">Avaliadores e turmas</h2>
      <p className="mb-4 text-text-muted">
        Cada avaliador só enxerga as turmas marcadas aqui. Para cadastrar um novo avaliador, use "Cadastro de Grupos".
      </p>

      {carregando ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : erro ? (
        <Card className="p-6 text-center text-danger">{erro}</Card>
      ) : avaliadores.length === 0 ? (
        <Card className="p-6 text-center text-text-muted">Nenhum avaliador cadastrado ainda.</Card>
      ) : (
        <div className="space-y-3">
          {avaliadores.map((avaliador) => (
            <Card key={avaliador.id} className="flex min-w-0 flex-wrap items-center gap-3 p-4">
              <Avatar name={avaliador.nome} />
              <div className="min-w-0 flex-1">
                <p className="break-words font-semibold text-text">{avaliador.nome}</p>
                <p className="break-all text-xs text-text-muted">{avaliador.email}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {avaliador.turmas.length === 0 ? (
                    <span className="text-xs font-medium text-warning">Nenhuma turma (não vê nada)</span>
                  ) : (
                    avaliador.turmas.map((turma) => (
                      <Badge key={turma.id} tone="aluno">
                        Turma {turma.nome}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => abrir('turmas', avaliador)}>
                  <Users className="h-4 w-4" /> Turmas
                </Button>
                <Button size="sm" variant="outline" aria-label="Editar nome" onClick={() => abrir('nome', avaliador)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" aria-label="Excluir avaliador" onClick={() => abrir('excluir', avaliador)}>
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Trocar turmas */}
      <Modal open={modal?.tipo === 'turmas'} onClose={() => setModal(null)} title="Turmas do avaliador">
        <p className="mb-3 text-sm text-text-muted">
          Marque as turmas que <strong className="text-text">{avaliadorModal?.nome}</strong> deve avaliar.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {turmas.map((turma) => {
            const marcada = turmaIds.includes(turma.id);
            return (
              <label
                key={turma.id}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  marcada
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-border bg-surface text-text-muted hover:bg-surface-muted'
                }`}
              >
                <input
                  type="checkbox"
                  checked={marcada}
                  onChange={() => alternarTurma(turma.id)}
                  className="h-4 w-4 accent-primary"
                />
                Turma {turma.nome}
              </label>
            );
          })}
        </div>
        {turmaIds.length === 0 && <p className="mt-2 text-xs text-warning">Marque pelo menos uma turma.</p>}
        {erroModal && <p className="mt-3 text-sm font-medium text-danger">{erroModal}</p>}
        <Button className="mt-4 w-full" onClick={salvarTurmas} disabled={salvando || turmaIds.length === 0}>
          {salvando ? 'Salvando...' : 'Salvar turmas'}
        </Button>
      </Modal>

      {/* Editar nome */}
      <Modal open={modal?.tipo === 'nome'} onClose={() => setModal(null)} title="Editar nome do avaliador">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            salvarNome();
          }}
          className="space-y-4"
        >
          <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
          {erroModal && <p className="text-sm font-medium text-danger">{erroModal}</p>}
          <Button type="submit" className="w-full" disabled={salvando || nome.trim().length < 3}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>
        </form>
      </Modal>

      {/* Excluir */}
      <Modal open={modal?.tipo === 'excluir'} onClose={() => setModal(null)} title="Excluir avaliador">
        <p className="text-text-muted">
          Excluir <strong className="text-text">{avaliadorModal?.nome}</strong>? A conta de acesso e o perfil serão
          removidos e essa ação não pode ser desfeita.
        </p>
        {avaliadorModal?.total_avaliacoes > 0 && (
          <p className="mt-2 text-sm font-medium text-warning">
            Atenção: as {avaliadorModal.total_avaliacoes} avaliações de banca que ele já registrou também serão
            apagadas.
          </p>
        )}
        {erroModal && <p className="mt-3 text-sm font-medium text-danger">{erroModal}</p>}
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>
            Cancelar
          </Button>
          <Button variant="danger" className="flex-1" onClick={excluir} disabled={salvando}>
            {salvando ? 'Excluindo...' : 'Excluir'}
          </Button>
        </div>
      </Modal>
    </section>
  );
}