import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Save, Trash2 } from 'lucide-react';
import Card from './ui/Card.jsx';
import Button from './ui/Button.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { SITUACOES } from '../lib/periodoBanca.js';

const CLASSE_DATA =
  'h-11 w-full rounded-xl border border-border bg-surface px-3 text-base text-text transition-all focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15';

/**
 * Painel do Professor para liberar a avaliação da banca por bimestre.
 * Cada bimestre tem data de abertura e de fechamento (as duas valem
 * inclusive, no horário de Brasília). Sem datas = avaliação bloqueada.
 *
 * @param {Object} props
 * @param {Function} [props.onAlterado] Chamado depois de salvar/limpar um período.
 */
export default function PeriodosAvaliacao({ onAlterado }) {
  const { session } = useAuth();
  const token = session?.token;

  const [periodos, setPeriodos] = useState([]);
  const [datas, setDatas] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(null); // bimestre sendo salvo
  const [mensagens, setMensagens] = useState({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const { periodos: lista } = await api('/avaliacoes-banca/periodos', { token });
      setPeriodos(lista);
      setDatas(Object.fromEntries(lista.map((p) => [p.bimestre, { abre: p.abre_em ?? '', fecha: p.fecha_em ?? '' }])));
    } catch (e) {
      setErro(e.message || 'Nao foi possivel carregar os periodos.');
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /** Atualiza só a linha do bimestre que acabou de ser salva/limpa. */
  function aplicar(periodo) {
    setPeriodos((atual) => atual.map((p) => (p.bimestre === periodo.bimestre ? periodo : p)));
    setDatas((atual) => ({
      ...atual,
      [periodo.bimestre]: { abre: periodo.abre_em ?? '', fecha: periodo.fecha_em ?? '' },
    }));
  }

  function mudar(bimestre, campo, valor) {
    setDatas((atual) => ({ ...atual, [bimestre]: { ...atual[bimestre], [campo]: valor } }));
    setMensagens((atual) => ({ ...atual, [bimestre]: null }));
  }

  async function salvar(bimestre) {
    setOcupado(bimestre);
    setMensagens((atual) => ({ ...atual, [bimestre]: null }));
    try {
      const { periodo } = await api(`/avaliacoes-banca/periodos/${bimestre}`, {
        method: 'PUT',
        token,
        body: { abre_em: datas[bimestre].abre, fecha_em: datas[bimestre].fecha },
      });
      aplicar(periodo);
      setMensagens((atual) => ({ ...atual, [bimestre]: { tipo: 'ok', texto: 'Período salvo!' } }));
      onAlterado?.();
    } catch (e) {
      setMensagens((atual) => ({ ...atual, [bimestre]: { tipo: 'erro', texto: e.message || 'Falha ao salvar.' } }));
    } finally {
      setOcupado(null);
    }
  }

  async function limpar(bimestre) {
    setOcupado(bimestre);
    setMensagens((atual) => ({ ...atual, [bimestre]: null }));
    try {
      const { periodo } = await api(`/avaliacoes-banca/periodos/${bimestre}`, { method: 'DELETE', token });
      aplicar(periodo);
      setMensagens((atual) => ({ ...atual, [bimestre]: { tipo: 'ok', texto: 'Avaliação bloqueada.' } }));
      onAlterado?.();
    } catch (e) {
      setMensagens((atual) => ({ ...atual, [bimestre]: { tipo: 'erro', texto: e.message || 'Falha ao limpar.' } }));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold text-text">Período de avaliação da banca</h2>
        <p className="mt-1 text-sm text-text-muted">
          Defina quando os avaliadores podem avaliar cada bimestre. Vale para todos os grupos. As duas
          datas são incluídas (horário de Brasília). Fora do período, ou sem datas, os avaliadores só
          conseguem ver.
        </p>
      </div>

      {carregando ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : erro ? (
        <Card className="p-6 text-center text-sm text-text-muted">{erro}</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {periodos.map((periodo) => {
            const b = periodo.bimestre;
            const linha = datas[b] ?? { abre: '', fecha: '' };
            const situacao = SITUACOES[periodo.situacao] ?? SITUACOES.nao_definido;
            const datasValidas = linha.abre && linha.fecha && linha.fecha >= linha.abre;
            const mensagem = mensagens[b];

            return (
              <Card key={b} className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-text">{b}º bimestre</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${situacao.classe}`}>
                    {situacao.texto}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-text">Abre em</span>
                    <input
                      type="date"
                      value={linha.abre}
                      onChange={(e) => mudar(b, 'abre', e.target.value)}
                      className={CLASSE_DATA}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-text">Fecha em</span>
                    <input
                      type="date"
                      value={linha.fecha}
                      min={linha.abre || undefined}
                      onChange={(e) => mudar(b, 'fecha', e.target.value)}
                      className={CLASSE_DATA}
                    />
                  </label>
                </div>

                {linha.abre && linha.fecha && linha.fecha < linha.abre && (
                  <p className="mt-2 text-xs font-medium text-danger">
                    A data de fechamento precisa ser igual ou posterior à de abertura.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="success" onClick={() => salvar(b)} disabled={!datasValidas || ocupado === b}>
                    {ocupado === b ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar período
                  </Button>
                  {periodo.abre_em && (
                    <Button size="sm" variant="outline" onClick={() => limpar(b)} disabled={ocupado === b}>
                      <Trash2 className="h-4 w-4" /> Bloquear
                    </Button>
                  )}
                  {mensagem && (
                    <span
                      role="status"
                      className={`flex items-center gap-1 text-sm font-medium ${
                        mensagem.tipo === 'ok' ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {mensagem.tipo === 'ok' && <Check className="h-4 w-4" />} {mensagem.texto}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
