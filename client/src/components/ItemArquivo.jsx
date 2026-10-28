import { FileText } from 'lucide-react';
import Badge from './ui/Badge.jsx';
import Card from './ui/Card.jsx';

/**
 * Cartão de um arquivo (slide ou modelo), com título, informações,
 * observação e os botões de ação que a tela quiser colocar.
 *
 * @param {Object} props
 * @param {string} props.titulo Título do item.
 * @param {string} [props.badge] Etiqueta (ex.: "Turma 3A").
 * @param {string} [props.linhaMeta] Linha pequena com data, nome do arquivo e tamanho.
 * @param {string} [props.observacao] Observação do professor.
 * @param {React.ReactNode} [props.acoes] Botões.
 */
export default function ItemArquivo({ titulo, badge, linhaMeta, observacao, acoes }) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-text">
            <span className="break-words">{titulo}</span>
            {badge && <Badge tone="professor">{badge}</Badge>}
          </p>
          {linhaMeta && <p className="mt-0.5 break-words text-xs text-text-muted">{linhaMeta}</p>}
          {observacao && (
            <p className="mt-2 whitespace-pre-wrap rounded-lg bg-canvas px-3 py-2 text-sm text-text">{observacao}</p>
          )}
        </div>
        {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
      </div>
    </Card>
  );
}
