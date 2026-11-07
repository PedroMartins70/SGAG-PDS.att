import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Crown, Plus, Shield, UserPlus, X } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Input from '../components/ui/Input.jsx';
import ThemeToggle from '../components/ui/ThemeToggle.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../auth/AuthContext.jsx';

/**
 * Limite de alunos que podem ser cadastrados junto com o grupo.
 * O grupo tem no máximo 7 integrantes e o líder e o vice já contam entre eles.
 */
const LIMITE_INTEGRANTES = 5;

/**
 * Página "Novo Grupo": cadastro de um grupo com nome, Líder e Vice-Líder.
 * Os alunos são opcionais (até 5 aqui): o Líder e o Vice-Líder podem adicionar
 * os demais integrantes depois, pela tela deles.
 *
 * @returns {JSX.Element} Página de novo grupo.
 */
export default function NovoGrupo() {
  const { turmaId } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();

  const [turma, setTurma] = useState(null);
  const [perfis, setPerfis] = useState([]);
  const [nome, setNome] = useState('');
  const [liderId, setLiderId] = useState('');
  const [viceId, setViceId] = useState('');
  const [integrantes, setIntegrantes] = useState([]);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const token = session?.token;

  /** Carrega a turma e os perfis de Líder/Vice-Líder. */
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const { turmas } = await api('/turmas', { token });
      setTurma(turmas.find((t) => t.id === turmaId) ?? null);
      const { perfis } = await api('/profiles', { token });
      setPerfis(perfis);
    } catch (e) {
      setErro(e.message || 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, [token, turmaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const lideres = useMemo(() => perfis.filter((p) => p.role === 'lider'), [perfis]);
  const vices = useMemo(() => perfis.filter((p) => p.role === 'vice_lider'), [perfis]);

  /** Adiciona um campo de integrante vazio (limite de 5). */
  function adicionarIntegrante() {
    setIntegrantes((atual) => (atual.length < LIMITE_INTEGRANTES ? [...atual, ''] : atual));
  }

  /** Atualiza o nome de um integrante. */
  function alterarIntegrante(indice, valor) {
    setIntegrantes((atual) => atual.map((n, i) => (i === indice ? valor : n)));
  }

  /** Remove um integrante da lista. */
  function removerIntegrante(indice) {
    setIntegrantes((atual) => atual.filter((_, i) => i !== indice));
  }

  const preenchidos = integrantes.filter((n) => n.trim()).length;

  /**
   * Envia a criação completa do grupo.
   *
   * @param {React.FormEvent} evento Evento de submissão.
   */
  async function handleSubmit(evento) {
    evento.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await api('/grupos/novo', {
        method: 'POST',
        token,
        body: {
          turma_id: turmaId,
          nome,
          lider_id: liderId,
          vice_lider_id: viceId,
          integrantes: integrantes.filter((n) => n.trim()),
        },
      });
      navigate('/grupos');
    } catch (e) {
      setErro(e.message || 'Nao foi possivel criar o grupo.');
    } finally {
      setEnviando(false);
    }
  }

  const podeEnviar = !enviando && nome.trim() && liderId && viceId && preenchidos <= LIMITE_INTEGRANTES;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="sm" aria-label="Voltar" onClick={() => navigate('/grupos')}>
              <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Voltar</span>
            </Button>
            <div className="min-w-0 leading-tight">
              <h1 className="font-display text-lg font-bold text-text">Novo Grupo</h1>
              <p className="truncate text-xs text-text-muted">Turma {turma?.nome ?? ''}</p>
            </div>
          </div>
          <div className="shrink-0">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {carregando ? (
          <p className="text-text-muted">Carregando...</p>
        ) : (
          <Card className="min-w-0 p-6 sm:p-8">
            {erro && (
              <div className="mb-4 rounded-lg border border-danger-soft bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
                {erro}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nome e papel */}
              <div>
                <h2 className="mb-3 font-display text-lg font-bold text-text">Identificação</h2>
                <Input
                  label="Nome do grupo"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Projeto IA"
                  required
                />
              </div>

              {/* Líder e Vice-Líder (grid-cols-1 limita a coluna à largura da tela no celular) */}
              <div>
                <h2 className="mb-3 font-display text-lg font-bold text-text">Líder e Vice-Líder</h2>
                <p className="mb-3 text-sm text-text-muted">
                  Escolha entre os perfis de Líder e Vice-Líder que você já cadastrou.
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <label className="mb-1.5 block text-sm font-semibold text-text">Líder</label>
                    <div className="relative">
                      <Crown className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary" />
                      <SelectPerfil
                        valor={liderId}
                        perfis={lideres}
                        vazio="Nenhum Líder cadastrado"
                        onChange={setLiderId}
                      />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <label className="mb-1.5 block text-sm font-semibold text-text">Vice-Líder</label>
                    <div className="relative">
                      <Shield className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
                      <SelectPerfil
                        valor={viceId}
                        perfis={vices}
                        vazio="Nenhum Vice-Líder cadastrado"
                        onChange={setViceId}
                      />
                    </div>
                  </div>
                </div>
                {lideres.length === 0 && (
                  <p className="mt-2 text-xs text-warning">
                    Cadastre um Líder antes (botão "Cadastrar Líder / Vice" na página anterior).
                  </p>
                )}
              </div>

              {/* Integrantes (opcional) */}
              <div>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-bold text-text">Integrantes (opcional)</h2>
                  <Badge tone="aluno">
                    {preenchidos}/{LIMITE_INTEGRANTES}
                  </Badge>
                </div>
                <p className="mb-3 text-sm text-text-muted">
                  Não é obrigatório. O Líder e o Vice-Líder poderão adicionar os demais alunos depois, pela tela
                  deles. Se quiser, você já pode cadastrar até {LIMITE_INTEGRANTES} alunos aqui (o Líder e o Vice
                  contam entre os 7 do grupo).
                </p>

                {integrantes.length === 0 && (
                  <p className="mb-2 text-sm text-text-muted">Nenhum integrante adicionado ainda.</p>
                )}

                <div className="space-y-2">
                  {integrantes.map((nomeAluno, indice) => (
                    <div key={indice} className="flex items-center gap-2">
                      <Input
                        label={`Aluno ${indice + 1}`}
                        value={nomeAluno}
                        onChange={(e) => alterarIntegrante(indice, e.target.value)}
                        className="flex-1"
                      />
                      <button
                        type="button"
                        aria-label={`Remover aluno ${indice + 1}`}
                        onClick={() => removerIntegrante(indice)}
                        className="mt-7 rounded-lg p-2 text-text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={adicionarIntegrante}
                  disabled={integrantes.length >= LIMITE_INTEGRANTES}
                >
                  <UserPlus className="h-4 w-4" /> Adicionar integrante
                </Button>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={() => navigate('/grupos')}>
                  Cancelar
                </Button>
                <Button type="submit" variant="success" disabled={!podeEnviar}>
                  <Plus className="h-5 w-5" /> {enviando ? 'Criando...' : 'Criar grupo'}
                </Button>
              </div>
            </form>
          </Card>
        )}
      </main>
    </div>
  );
}

/**
 * Seletor de perfil (Líder/Vice-Líder) com identidade visual.
 *
 * @param {Object} props Propriedades do seletor.
 * @param {string} props.valor UUID selecionado.
 * @param {Array<Object>} props.perfis Perfis disponíveis.
 * @param {string} props.vazio Mensagem quando vazio.
 * @param {Function} props.onChange Callback de mudança.
 * @returns {JSX.Element} Campo select.
 */
function SelectPerfil({ valor, perfis, vazio, onChange }) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className="h-12 w-full appearance-none rounded-xl border border-border bg-surface pl-11 pr-10 text-base text-text transition-all focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
    >
      <option value="">{perfis.length === 0 ? vazio : 'Selecione...'}</option>
      {perfis.map((perfil) => (
        <option key={perfil.id} value={perfil.id}>
          {perfil.nome} ({perfil.email})
        </option>
      ))}
    </select>
  );
}