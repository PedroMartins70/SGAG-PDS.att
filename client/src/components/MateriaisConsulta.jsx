import { useCallback, useEffect, useState } from 'react';
import { Download, ExternalLink, Loader2 } from 'lucide-react';
import Button from './ui/Button.jsx';
import Card from './ui/Card.jsx';
import ItemArquivo from './ItemArquivo.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { abrirOuBaixar, formatarDataHora, formatarTamanho, podeAbrirNoNavegador } from '../lib/materiais.js';

/**
 * Materiais do professor em modo SOMENTE LEITURA (ver, abrir e baixar).
 * - Líder e Vice-Líder: slides da própria turma + modelo do trabalho escrito.
 * - Avaliador: apenas o modelo do trabalho escrito (mostrarAulas = false).
 *
 * O servidor decide o que cada perfil pode ver; este componente só mostra.
 *
 * @param {Object} props
 * @param {boolean} [props.mostrarAulas] Se true, mostra também os slides das aulas.
 */
export default function MateriaisConsulta({ mostrarAulas = false }) {
  const { session } = useAuth();
  const token = session?.token;

  const [modelos, setModelos] = useState([]);
  const [aulas, setAulas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [erroAcao, setErroAcao] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const [dadosModelos, dadosAulas] = await Promise.all([
        api('/materiais/modelos', { token }),
        mostrarAulas ? api('/materiais/aulas', { token }) : Promise.resolve({ aulas: [] }),
      ]);
      setModelos(dadosModelos.modelos);
      setAulas(dadosAulas.aulas);
    } catch (e) {
      setErro(e.message || 'Nao foi possivel carregar os materiais.');
    } finally {
      setCarregando(false);
    }
  }, [token, mostrarAulas]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function acao(chave, caminho, baixar) {
    setOcupado(chave);
    setErroAcao('');
    try {
      await abrirOuBaixar({ caminho, token, baixar });
    } catch (e) {
      setErroAcao(e.message || 'Nao foi possivel abrir o arquivo.');
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

  const modelosDisponiveis = modelos.filter((m) => m.disponivel);

  return (
    <div className="space-y-8">
      {erroAcao && (
        <div className="rounded-lg border border-danger-soft bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
          {erroAcao}
        </div>
      )}

      {/* Modelo do trabalho escrito */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl font-bold text-text">Modelo do trabalho escrito</h2>
          <p className="text-sm text-text-muted">
            Modelo em Word disponibilizado pelo professor para cada bimestre. Serve de guia do que o
            trabalho precisa ter.
          </p>
        </div>

        {modelosDisponiveis.length === 0 ? (
          <Card className="p-6 text-center text-sm text-text-muted">
            O professor ainda não disponibilizou nenhum modelo.
          </Card>
        ) : (
          modelosDisponiveis.map((modelo) => {
            const chave = `modelo-${modelo.bimestre}`;
            const caminho = `/materiais/modelos/${modelo.bimestre}/link`;
            return (
              <ItemArquivo
                key={chave}
                titulo={`Modelo do ${modelo.bimestre}º bimestre`}
                linhaMeta={[
                  modelo.nome_original,
                  formatarTamanho(modelo.tamanho),
                  `atualizado em ${formatarDataHora(modelo.updated_at)}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                observacao={modelo.observacao}
                acoes={
                  <Button size="sm" onClick={() => acao(chave, caminho, true)} disabled={ocupado === chave}>
                    <Download className="h-4 w-4" /> Baixar
                  </Button>
                }
              />
            );
          })
        )}
      </section>

      {/* Slides das aulas (só líder e vice) */}
      {mostrarAulas && (
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-xl font-bold text-text">Slides das aulas</h2>
            <p className="text-sm text-text-muted">Materiais enviados pelo professor para a sua turma.</p>
          </div>

          {aulas.length === 0 ? (
            <Card className="p-6 text-center text-sm text-text-muted">
              O professor ainda não enviou materiais para a sua turma.
            </Card>
          ) : (
            aulas.map((aula) => {
              const caminho = `/materiais/aulas/${aula.id}/link`;
              return (
                <ItemArquivo
                  key={aula.id}
                  titulo={aula.titulo}
                  badge={aula.turma_nome ? `Turma ${aula.turma_nome}` : undefined}
                  linhaMeta={[
                    `Enviado em ${formatarDataHora(aula.created_at)}`,
                    aula.nome_original,
                    formatarTamanho(aula.tamanho),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  observacao={aula.observacao}
                  acoes={
                    <>
                      {podeAbrirNoNavegador(aula.nome_original) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => acao(`abrir-${aula.id}`, caminho, false)}
                          disabled={ocupado === `abrir-${aula.id}`}
                        >
                          <ExternalLink className="h-4 w-4" /> Abrir
                        </Button>
                      )}
                      <Button size="sm" onClick={() => acao(`baixar-${aula.id}`, caminho, true)} disabled={ocupado === `baixar-${aula.id}`}>
                        <Download className="h-4 w-4" /> Baixar
                      </Button>
                    </>
                  }
                />
              );
            })
          )}
        </section>
      )}
    </div>
  );
}
