import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import Card from './ui/Card.jsx';
import FormularioAvaliacao from './FormularioAvaliacao.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { BLOCOS, ESCALA, TOTAL_MAXIMO, formatarNota } from '../lib/criteriosAvaliacao.js';

const BIMESTRES = [1, 2, 3, 4];

/** Formata a data no padrão brasileiro (dd/mm/aaaa). */
function formatarData(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR');
}

/**
 * Avaliação da banca de um grupo, por bimestre.
 * - Avaliador: preenche e salva a própria avaliação (4 blocos + comentário).
 * - Professor, Líder e Vice-Líder: veem as avaliações (somente leitura).
 *
 * O servidor decide quem pode editar; este componente apenas obedece.
 *
 * @param {Object} props
 * @param {string} props.grupoId UUID do grupo.
 * @param {number} [props.bimestre] Se informado, usa o bimestre da tela que o
 *        chamou. Se não, mostra o seletor de bimestre aqui dentro.
 */
export default function AvaliacaoBanca({ grupoId, bimestre: bimestreExterno }) {
  const { session } = useAuth();
  const token = session?.token;

  const [bimestreInterno, setBimestreInterno] = useState(1);
  const bimestre = bimestreExterno ?? bimestreInterno;

  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const resposta = await api(`/grupos/${grupoId}/avaliacoes-banca?bimestre=${bimestre}`, { token });
      setDados(resposta);
    } catch (e) {
      setDados(null);
      setErro(e.message || 'Nao foi possivel carregar a avaliacao da banca.');
    } finally {
      setCarregando(false);
    }
  }, [grupoId, bimestre, token]);

  useEffect(() => {
    setFeedback(null);
    carregar();
  }, [carregar]);

  async function salvar({ notas, comentario }) {
    setSalvando(true);
    setFeedback(null);
    try {
      await api(`/grupos/${grupoId}/avaliacoes-banca`, {
        method: 'PUT',
        token,
        body: { bimestre, notas, comentario },
      });
      await carregar();
      setFeedback({ tipo: 'ok', texto: 'Avaliação salva!' });
    } catch (e) {
      setFeedback({ tipo: 'erro', texto: e.message || 'Falha ao salvar.' });
    } finally {
      setSalvando(false);
    }
  }

  const minha = dados?.avaliacoes?.[0];

  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-bold text-text">Avaliação da banca</h2>

      {bimestreExterno === undefined && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text">Bimestre:</span>
          <div className="flex gap-1">
            {BIMESTRES.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBimestreInterno(b)}
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
      )}

      {carregando ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : erro ? (
        <Card className="p-6 text-center text-sm text-text-muted">{erro}</Card>
      ) : dados?.permissao?.podeEditar ? (
        <>
          <p className="text-sm text-text-muted">
            Escolha uma nota para cada bloco e, se quiser, deixe suas observações. Você pode
            editar e salvar novamente quando precisar.
          </p>
          <FormularioAvaliacao
            valoresIniciais={minha ? { notas: minha.notas, comentario: minha.comentario } : undefined}
            salvando={salvando}
            onSalvar={salvar}
          />
          {feedback && (
            <p
              role="status"
              className={`flex items-center gap-1 text-sm font-medium ${
                feedback.tipo === 'ok' ? 'text-success' : 'text-danger'
              }`}
            >
              {feedback.tipo === 'ok' && <Check className="h-4 w-4" />} {feedback.texto}
            </p>
          )}
        </>
      ) : dados?.avaliacoes?.length ? (
        <>
          {dados.resumo.quantidade > 1 && (
            <p className="text-sm text-text-muted">
              Média da banca: <strong className="text-text">{formatarNota(dados.resumo.media_total)}</strong> /{' '}
              {formatarNota(TOTAL_MAXIMO)} ({dados.resumo.quantidade} avaliadores)
            </p>
          )}
          {dados.avaliacoes.map((avaliacao) => (
            <CartaoAvaliador key={avaliacao.id} avaliacao={avaliacao} />
          ))}
        </>
      ) : (
        <Card className="p-6 text-center text-sm text-text-muted">
          Nenhum avaliador registrou nota neste bimestre ainda.
        </Card>
      )}
    </section>
  );
}

/** Resumo somente leitura da avaliação de um avaliador. */
function CartaoAvaliador({ avaliacao }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-text">{avaliacao.avaliador?.nome ?? 'Avaliador'}</p>
          <p className="text-xs text-text-muted">Atualizada em {formatarData(avaliacao.updated_at)}</p>
        </div>
        <span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-bold text-primary">
          {formatarNota(avaliacao.nota_total)} / {formatarNota(TOTAL_MAXIMO)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {BLOCOS.map((bloco) => {
          const nota = avaliacao.notas[bloco.id];
          const rotulo = ESCALA.find((item) => item.valor === nota)?.rotulo;
          return (
            <div key={bloco.id} className="rounded-lg border border-border bg-surface-muted px-3 py-2">
              <p className="text-xs text-text-muted">{bloco.titulo}</p>
              <p className="font-semibold text-text">
                {formatarNota(nota)}{' '}
                <span className="text-xs font-normal text-text-muted">{rotulo}</span>
              </p>
            </div>
          );
        })}
      </div>

      {avaliacao.comentario && (
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-canvas px-3 py-2 text-sm text-text">
          {avaliacao.comentario}
        </p>
      )}
    </Card>
  );
}
