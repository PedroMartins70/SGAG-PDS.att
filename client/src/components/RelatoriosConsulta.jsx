import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import Button from './ui/Button.jsx';
import Card from './ui/Card.jsx';
import ItemArquivo from './ItemArquivo.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { formatarDataHora } from '../lib/materiais.js';

/**
 * Relatórios (links do Google Docs) publicados pelo professor, para o
 * Líder e o Vice-Líder. Basta abrir o link e preencher no Google Docs.
 *
 * @returns {JSX.Element} Seção de relatórios.
 */
export default function RelatoriosConsulta() {
  const { session } = useAuth();
  const token = session?.token;

  const [relatorios, setRelatorios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

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

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-xl font-bold text-text">Relatórios</h2>
        <p className="text-sm text-text-muted">
          Links enviados pelo professor. Abra o documento e preencha direto no Google Docs: tudo fica salvo lá.
        </p>
      </div>

      {carregando ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : erro ? (
        <Card className="p-6 text-center text-sm text-text-muted">{erro}</Card>
      ) : relatorios.length === 0 ? (
        <Card className="p-6 text-center text-sm text-text-muted">
          O professor ainda não publicou nenhum relatório.
        </Card>
      ) : (
        relatorios.map((relatorio) => (
          <ItemArquivo
            key={relatorio.id}
            titulo={relatorio.titulo}
            linhaMeta={`Publicado em ${formatarDataHora(relatorio.created_at)}`}
            observacao={relatorio.descricao}
            acoes={
              <Button
                size="sm"
                onClick={() => window.open(relatorio.url, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="h-4 w-4" /> Abrir relatório
              </Button>
            }
          />
        ))
      )}
    </section>
  );
}