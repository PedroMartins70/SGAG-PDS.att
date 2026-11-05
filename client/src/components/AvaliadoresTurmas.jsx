import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import Button from './ui/Button.jsx';
import Card from './ui/Card.jsx';
import Badge from './ui/Badge.jsx';
import Avatar from './ui/Avatar.jsx';
import Modal from './ui/Modal.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../auth/AuthContext.jsx';

/**
 * Quadro "Avaliadores e turmas" (painel do Professor).
 * Mostra todos os avaliadores cadastrados e as turmas que cada um avalia.
 * Ao clicar em um avaliador, abre uma janela para marcar/desmarcar as turmas
 * dele. Salvar só altera os vínculos com as turmas: contas, senhas e avaliações
 * já feitas continuam como estão.
 *
 * @param {Object} props Propriedades do quadro.
 * @param {Array<{id: string, nome: string}>} props.turmas Todas as turmas (3A a 3D).
 * @returns {JSX.Element} Quadro de avaliadores.
 */
export default function AvaliadoresTurmas({ turmas }) {
  const { session } = useAuth();
  const token = session?.token;

  const [avaliadores, setAvaliadores] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [alvo, setAlvo] = useState(null);
  const [escolhidas, setEscolhidas] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const { avaliadores: lista } = await api('/profiles/avaliadores', { token });
      setAvaliadores(lista);
    } catch (e) {
      setErro(e.message || 'Nao foi possivel carregar os avaliadores.');
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /** Abre a janela de turmas do avaliador clicado. */
  function abrir(avaliador) {
    setAviso('');
    setErroModal('');
    setEscolhidas(avaliador.turmas.map((t) => t.id));
    setAlvo(avaliador);
  }

  /** Marca ou desmarca uma turma na janela. */
  function alternar(turmaId) {
    setEscolhidas((atual) =>
      atual.includes(turmaId) ? atual.filter((id) => id !== turmaId) : [...atual, turmaId]
    );
  }

  const semMudanca = useMemo(() => {
    if (!alvo) return true;
    const antes = alvo.turmas.map((t) => t.id).sort().join(',');
    const depois = [...escolhidas].sort().join(',');
    return antes === depois;
  }, [alvo, escolhidas]);

  /** Salva as turmas escolhidas para o avaliador. */
  async function salvar() {
    setSalvando(true);
    setErroModal('');
    try {
      const { avaliador } = await api(`/profiles/avaliadores/${alvo.id}/turmas`, {
        method: 'PUT',
        token,
        body: { turma_ids: escolhidas },
      });
      setAvaliadores((lista) =>
        lista.map((a) => (a.id === avaliador.id ? { ...a, turmas: avaliador.turmas } : a))
      );
      setAviso(`Turmas de ${avaliador.nome} atualizadas.`);
      setAlvo(null);
    } catch (e) {
      setErroModal(e.message || 'Nao foi possivel salvar as turmas.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section>
      <h2 className="mb-1 font-display text-2xl font-bold text-text">Avaliadores e turmas</h2>
      <p className="mb-5 text-sm text-text-muted">
        Cada avaliador só vê os projetos das turmas marcadas para ele. Clique em um avaliador para
        definir as turmas.
      </p>

      {aviso && <p className="mb-3 text-sm font-medium text-success">{aviso}</p>}

      {carregando ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : erro ? (
        <Card className="p-6 text-center text-danger">{erro}</Card>
      ) : avaliadores.length === 0 ? (
        <Card className="p-6 text-center text-text-muted">
          Nenhum avaliador cadastrado ainda. Cadastre em "Cadastro de Grupos".
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {avaliadores.map((avaliador) => (
            <button
              key={avaliador.id}
              type="button"
              onClick={() => abrir(avaliador)}
              className="rounded-2xl border border-border bg-surface p-4 text-left transition-colors hover:border-primary hover:bg-primary-soft"
            >
              <div className="flex items-center gap-3">
                <Avatar name={avaliador.nome} className="h-10 w-10 text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-text">{avaliador.nome}</p>
                  <p className="truncate text-xs text-text-muted">{avaliador.email}</p>
                </div>
                <Pencil className="h-4 w-4 shrink-0 text-text-muted" />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {avaliador.turmas.length === 0 ? (
                  <span className="text-xs font-semibold text-warning">
                    Sem turma definida — não vê nenhum projeto
                  </span>
                ) : (
                  avaliador.turmas.map((turma) => (
                    <Badge key={turma.id} tone="aluno">
                      Turma {turma.nome}
                    </Badge>
                  ))
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(alvo)}
        onClose={() => setAlvo(null)}
        title={alvo ? `Turmas de ${alvo.nome}` : 'Turmas do avaliador'}
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Marque as turmas que este avaliador poderá ver. As avaliações que ele já fez não são
            apagadas.
          </p>

          <div className="grid grid-cols-2 gap-2">
            {turmas.map((turma) => {
              const marcada = escolhidas.includes(turma.id);
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
                    onChange={() => alternar(turma.id)}
                    className="h-4 w-4 accent-primary"
                  />
                  Turma {turma.nome}
                </label>
              );
            })}
          </div>

          {escolhidas.length === 0 && (
            <p className="text-xs font-medium text-warning">Marque pelo menos uma turma.</p>
          )}
          {erroModal && <p className="text-sm font-medium text-danger">{erroModal}</p>}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setAlvo(null)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={salvar}
              disabled={salvando || escolhidas.length === 0 || semMudanca}
            >
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {salvando ? 'Salvando...' : 'Salvar turmas'}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
