import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Clock, Loader2, Lock, Save, UserX } from 'lucide-react';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import ProjetoArquivos from '../components/ProjetoArquivos.jsx';
import AvaliacaoBanca from '../components/AvaliacaoBanca.jsx';
import MateriaisConsulta from '../components/MateriaisConsulta.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../auth/AuthContext.jsx';

/** Critérios de avaliação (0,00 a 0,20 cada; soma máxima 1,00). */
const CRITERIOS = [
  { key: 'interesse', rotulo: 'Interesse' },
  { key: 'entrega_prazo', rotulo: 'Entrega no prazo' },
  { key: 'participacao', rotulo: 'Participação' },
  { key: 'qualidade_trabalho', rotulo: 'Qualidade no trabalho' },
  { key: 'respeito_grupo', rotulo: 'Respeito no grupo' },
];

/** Bimestres disponíveis para seleção. */
const BIMESTRES = [1, 2, 3, 4];

/** Abas da tela. */
const ABAS = [
  { key: 'avaliacoes', rotulo: 'Avaliações' },
  { key: 'banca', rotulo: 'Notas da banca' },
  { key: 'materiais', rotulo: 'Materiais' },
  { key: 'arquivos', rotulo: 'Arquivos do projeto' },
];

/** Valores vazios padrão para cada critério. */
const vazio = () => Object.fromEntries(CRITERIOS.map((c) => [c.key, '']));

/**
 * Tela do Líder/Vice-Líder sobre o seu grupo, com quatro abas:
 * - Avaliações: avalia cada integrante por bimestre (5 critérios, nota máxima
 *   1,00, comentário opcional). Uma avaliação já alterada pelo professor fica
 *   travada para o Líder/Vice-Líder.
 * - Notas da banca: mostra (somente leitura) as notas e comentários dos
 *   avaliadores da banca para o grupo, por bimestre.
 * - Materiais: slides das aulas da turma e modelo do trabalho escrito (só ver, abrir e baixar).
 * - Arquivos do projeto: envio do trabalho escrito (PDF), do pitch (vídeo) e
 *   da logo, com o botão "Salvar alterações".
 *
 * @returns {JSX.Element} Tela do líder/vice.
 */
export default function Avaliacao() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const token = session?.token;
  const nomeUsuario = session?.user?.nome || '';

  const [aba, setAba] = useState('avaliacoes');
  const [grupo, setGrupo] = useState(null);
  const [bimestre, setBimestre] = useState(1);
  const [integrantes, setIntegrantes] = useState([]);
  const [permissao, setPermissao] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  /** Carrega o grupo do usuário e o estado das avaliações no bimestre atual. */
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const { grupo: meuGrupo } = await api('/grupos/me', { token });
      const data = await api(`/grupos/${meuGrupo.id}/avaliacoes?bimestre=${bimestre}`, { token });
      setGrupo(meuGrupo);
      setIntegrantes(data.integrantes);
      setPermissao(data.permissao);
    } catch (e) {
      setErro(e.message || 'Nao foi possivel carregar a avaliacao.');
    } finally {
      setCarregando(false);
    }
  }, [token, bimestre]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (carregando && !grupo) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (erro || !grupo) {
    return (
      <Card className="p-8 text-center text-text-muted">
        <UserX className="mx-auto mb-2 h-8 w-8" />
        {erro || 'Nenhum grupo encontrado para o seu perfil.'}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho do grupo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-text">{grupo.nome}</h2>
          {grupo.turma_nome && (
            <div className="mt-1">
              <Badge tone="professor">Turma {grupo.turma_nome}</Badge>
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(`/grupos/${grupo.id}/historico`)}>
          <Clock className="h-4 w-4" /> Histórico
        </Button>
      </div>

      {/* Abas */}
      <div className="flex gap-2 overflow-x-auto border-b border-border">
        {ABAS.map((item) => (
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

      {aba === 'arquivos' ? (
        <ProjetoArquivos grupoId={grupo.id} />
      ) : aba === 'banca' ? (
        <AvaliacaoBanca grupoId={grupo.id} />
      ) : aba === 'materiais' ? (
        <MateriaisConsulta mostrarAulas />
      ) : (
        <>
          <p className="text-sm text-text-muted">Avalie cada integrante de 0,00 a 0,20 por critério.</p>

          {/* Seletor de bimestre */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text">Bimestre:</span>
            <div className="flex gap-1">
              {BIMESTRES.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBimestre(b)}
                  className={`h-9 w-9 rounded-lg text-sm font-bold transition-all ${
                    bimestre === b
                      ? 'bg-primary text-white'
                      : 'border border-border bg-surface text-text-muted hover:border-primary'
                  }`}
                >
                  {b}º
                </button>
              ))}
            </div>
          </div>

          {/* Aviso de permissão (Vice em modo somente leitura) */}
          {permissao && !permissao.podeEditar && (
            <div className="rounded-lg border border-warning-soft bg-warning-soft px-3 py-2 text-sm font-medium text-warning">
              {permissao.motivo || 'Modo somente leitura.'}
            </div>
          )}

          {/* Lista de avaliação */}
          {integrantes.length === 0 ? (
            <Card className="p-8 text-center text-text-muted">Nenhum integrante no grupo.</Card>
          ) : (
            <div className="space-y-4">
              {integrantes.map((integrante) => {
                const ehVoce = nomeUsuario && integrante.nome_aluno === nomeUsuario;
                const travadoPeloProfessor = integrante.avaliacao?.alterado_por_professor ?? false;
                return (
                  <Card key={integrante.id} className="p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <Avatar name={integrante.nome_aluno} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-text">
                          {integrante.nome_aluno}
                          {ehVoce && <span className="text-primary"> (você)</span>}
                        </p>
                      </div>
                      {integrante.avaliacao && (
                        <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success">
                          Salva · {Number(integrante.avaliacao.nota_total).toFixed(2)}
                        </span>
                      )}
                    </div>

                    {travadoPeloProfessor && (
                      <div className="mb-3 flex items-center gap-2 rounded-lg border border-warning-soft bg-warning-soft px-3 py-2 text-sm font-medium text-warning">
                        <Lock className="h-4 w-4 shrink-0" />
                        Esta nota foi alterada pelo professor e não pode mais ser editada por aqui.
                      </div>
                    )}

                    <AvaliaIntegrante
                      integranteId={integrante.id}
                      grupoId={grupo.id}
                      bimestre={bimestre}
                      valoresIniciais={integrante.avaliacao ? deAvaliacao(integrante.avaliacao) : vazio()}
                      comentarioInicial={integrante.avaliacao?.comentario_esclarecimento ?? ''}
                      podeEditar={(permissao?.podeEditar ?? false) && !travadoPeloProfessor}
                      onSalva={carregar}
                    />
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Converte uma avaliação existente em valores de critérios (strings).
 *
 * @param {Object} avaliacao Avaliação retornada pela API.
 * @returns {Object} Mapa critério -> string.
 */
function deAvaliacao(avaliacao) {
  const valores = {};
  for (const c of CRITERIOS) {
    const v = avaliacao[c.key];
    valores[c.key] = v === null || v === undefined ? '' : String(v);
  }
  return valores;
}

/**
 * Formulário de avaliação de um integrante (5 critérios + comentário
 * opcional + total + salvar), para um bimestre específico.
 *
 * @param {Object} props Propriedades do formulário.
 * @param {string} props.integranteId UUID do integrante.
 * @param {string} props.grupoId UUID do grupo.
 * @param {number} props.bimestre Bimestre sendo avaliado (1 a 4).
 * @param {Object} props.valoresIniciais Valores iniciais dos critérios.
 * @param {string} props.comentarioInicial Comentário/justificativa já salvo, se houver.
 * @param {boolean} props.podeEditar Indica se pode editar.
 * @param {Function} props.onSalva Callback após salvar.
 * @returns {JSX.Element} Formulário de avaliação.
 */
function AvaliaIntegrante({ integranteId, grupoId, bimestre, valoresIniciais, comentarioInicial, podeEditar, onSalva }) {
  const { session } = useAuth();
  const [valores, setValores] = useState(valoresIniciais);
  const [comentario, setComentario] = useState(comentarioInicial);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState('');

  const numeros = CRITERIOS.map((c) => Number(valores[c.key]));
  const total = numeros.reduce((soma, n) => soma + (Number.isFinite(n) ? n : 0), 0);
  const todosValidos = numeros.every((n) => Number.isFinite(n) && n >= 0 && n <= 0.2);

  /**
   * Salva a avaliação do integrante no bimestre atual.
   */
  async function salvar() {
    setSalvando(true);
    setFeedback('');
    try {
      const corpo = { bimestre };
      for (const c of CRITERIOS) corpo[c.key] = Number(valores[c.key]);
      corpo.comentario_esclarecimento = comentario.trim() || null;
      await api(`/grupos/${grupoId}/avaliacoes/${integranteId}`, {
        method: 'PUT',
        token: session?.token,
        body: corpo,
      });
      setFeedback('Avaliação salva!');
      onSalva();
    } catch (e) {
      setFeedback(e.message || 'Falha ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {CRITERIOS.map((c) => (
          <label key={c.key} className="block">
            <span className="mb-1 block text-xs font-semibold text-text">{c.rotulo}</span>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="0.2"
                step="0.05"
                disabled={!podeEditar}
                value={valores[c.key]}
                onChange={(e) => setValores((atual) => ({ ...atual, [c.key]: e.target.value }))}
                className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-base text-text transition-all disabled:opacity-60 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
              />
            </div>
          </label>
        ))}
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-semibold text-text">Comentário (opcional)</span>
        <textarea
          rows={2}
          disabled={!podeEditar}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Justifique a nota, se achar necessário..."
          className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted transition-all disabled:opacity-60 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text">Nota total:</span>
          <span className="font-display text-lg font-extrabold text-primary">
            {Number.isFinite(total) ? total.toFixed(2) : '0,00'}
          </span>
          <span className="text-sm text-text-muted">/ 1,00</span>
        </div>
        {podeEditar && (
          <Button variant="success" size="sm" onClick={salvar} disabled={!todosValidos || salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {salvando ? 'Salvando...' : 'Salvar avaliação'}
          </Button>
        )}
      </div>

      {feedback && (
        <p className="mt-2 flex items-center gap-1 text-sm font-medium text-success">
          <Check className="h-4 w-4" /> {feedback}
        </p>
      )}

      <p className="mt-1 text-xs text-text-muted">
        A soma dos critérios gera a nota final do integrante (no máximo 1,00).
      </p>
    </div>
  );
}
