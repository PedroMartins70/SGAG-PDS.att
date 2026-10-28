import { useState } from 'react';
import Modal from './ui/Modal.jsx';

// ============================================================================
// PREENCHA ESTES CAMPOS ANTES DE PUBLICAR (confirme com o professor/a escola)
// ============================================================================
/** Nome da instituição responsável pelos dados (o "controlador" da LGPD). */
const NOME_INSTITUICAO = 'Centro de Ensino Médio Integrado à Educação Profissional do Gama DF - CEMI Gama';
/** E-mail para o usuário pedir informações ou exercer os direitos dele. */
const CONTATO_PRIVACIDADE = 'sgagpds.cemi@gmail.com';
/** Por quanto tempo os dados ficam guardados. */
const PRAZO_GUARDA = 'Até o fim do ano letivo, conforme definido pelo calendário que a instituição Centro de Ensino Médio Integrado à Educação Profissional do Gama DF - CEMI Gama segue.';
/** Data da última revisão deste texto. */
const DATA_ATUALIZACAO = '27/10/2026';

/** Bloco de texto com título. */
function Secao({ titulo, children }) {
  return (
    <section className="space-y-2">
      <h3 className="font-display text-base font-bold text-text">{titulo}</h3>
      {children}
    </section>
  );
}

/** Lista com marcadores. */
function Lista({ itens }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-text-muted">
      {itens.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * Botão-link "Política de Privacidade". Ao clicar, abre uma janela com o texto
 * completo. Pode ser colocado em qualquer tela (ele guarda o próprio estado).
 *
 * Importante: coloque FORA de um <form>, para a janela não interferir no formulário.
 *
 * @param {Object} props
 * @param {string} [props.className] Classes extras para o botão.
 * @param {React.ReactNode} [props.children] Texto do botão.
 * @returns {JSX.Element} Link que abre a política.
 */
export default function LinkPrivacidade({ className = '', children = 'Política de Privacidade' }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={`font-semibold text-primary underline-offset-2 hover:underline ${className}`}
      >
        {children}
      </button>

      <Modal open={aberto} onClose={() => setAberto(false)} title="Política de Privacidade">
        <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-2 text-sm leading-relaxed">
          <p className="text-xs text-text-muted">Última atualização: {DATA_ATUALIZACAO}</p>

          <Secao titulo="1. O que é o SGAG-PDS">
            <p className="text-text-muted">
              O SGAG-PDS é um sistema web de gestão e avaliação de grupos de projeto, desenvolvido por
              estudantes como projeto escolar do {NOME_INSTITUICAO}. Esta política explica quais dados
              pessoais o sistema usa, para quê, e quais são os seus direitos.
            </p>
          </Secao>

          <Secao titulo="2. Quais dados usamos">
            <Lista
              itens={[
                'Conta de acesso (professor, líder, vice-líder e avaliador): nome, e-mail, senha e perfil. A senha é guardada de forma criptografada pelo serviço de autenticação e não fica visível para a equipe.',
                'Integrantes dos grupos: o nome dos estudantes cadastrados pelo professor (eles não têm conta no sistema).',
                'Avaliações: notas, comentários e a identificação de quem avaliou, por bimestre.',
                'Arquivos dos projetos: trabalho escrito, pitch (vídeo ou link, que pode conter imagem e voz dos integrantes) e logo do grupo.',
                'Materiais do professor: slides das aulas e modelo do trabalho escrito.',
                'Registros de segurança: e-mail digitado e endereço IP nas tentativas de login, e o registro de quem alterou notas, arquivos e outras informações, e quando.',
              ]}
            />
          </Secao>

          <Secao titulo="3. Para que usamos">
            <Lista
              itens={[
                'Gerir os grupos e acompanhar o desenvolvimento dos projetos.',
                'Registrar e consultar as avaliações dos bimestres.',
                'Compartilhar materiais de aula e o modelo do trabalho escrito.',
                'Proteger o sistema contra acessos indevidos e manter o histórico das alterações.',
              ]}
            />
            <p className="text-text-muted">
              Não vendemos dados, não fazemos publicidade e não usamos os dados para outras finalidades.
              Quando os dados forem de estudantes menores de 18 anos, o tratamento considera sempre o
              melhor interesse do estudante.
            </p>
          </Secao>

          <Secao titulo="4. Quem pode ver os dados">
            <Lista
              itens={[
                'Professor: todos os grupos, avaliações e arquivos.',
                'Líder e vice-líder: os dados do próprio grupo e os materiais da própria turma.',
                'Avaliador: os grupos que avalia e o modelo do trabalho escrito.',
              ]}
            />
            <p className="text-text-muted">
              Para o sistema funcionar, usamos serviços de terceiros: o Supabase (banco de dados,
              autenticação e armazenamento de arquivos) e a Vercel (hospedagem). Esses serviços podem
              guardar dados em servidores fora do Brasil.
            </p>
          </Secao>

          <Secao titulo="5. Cookies e armazenamento no navegador">
            <p className="text-text-muted">
              O sistema usa apenas o armazenamento local do navegador, e somente para o que é necessário
              ao funcionamento: manter a sua sessão de login e lembrar o tema escolhido (claro ou
              escuro). Não usamos cookies de publicidade, de análise de audiência nem de rastreamento.
              Ao sair do sistema, a sessão é apagada.
            </p>
          </Secao>

          <Secao titulo="6. Como protegemos os dados">
            <Lista
              itens={[
                'Conexão segura (HTTPS).',
                'Acesso separado por perfil: cada pessoa só vê o que o seu perfil permite.',
                'Arquivos em área privada, acessados por links temporários.',
                'Bloqueio temporário do login após várias senhas erradas.',
                'Registro de alterações (quem mudou o quê e quando).',
              ]}
            />
          </Secao>

          <Secao titulo="7. Por quanto tempo guardamos">
            <p className="text-text-muted">
              Os dados são guardados {PRAZO_GUARDA}. Os registros de tentativas de login são mantidos
              apenas pelo tempo necessário à segurança e podem ser apagados periodicamente.
            </p>
          </Secao>

          <Secao titulo="8. Seus direitos">
            <p className="text-text-muted">
              Pela Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você pode pedir:
            </p>
            <Lista
              itens={[
                'confirmação de que tratamos seus dados e acesso a eles;',
                'correção de dados incompletos, errados ou desatualizados;',
                'anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com a lei;',
                'informações sobre com quem os dados são compartilhados;',
                'portabilidade, quando aplicável.',
              ]}
            />
            <p className="text-text-muted">
              Para exercer qualquer direito ou tirar dúvidas, fale com {NOME_INSTITUICAO} pelo contato:{' '}
              <strong className="text-text">{CONTATO_PRIVACIDADE}</strong>. Se achar que seus direitos não
              foram respeitados, você também pode procurar a Autoridade Nacional de Proteção de Dados
              (ANPD).
            </p>
          </Secao>

          <Secao titulo="9. Mudanças nesta política">
            <p className="text-text-muted">
              Podemos atualizar este texto quando o sistema mudar. A data da última atualização aparece
              no início desta página.
            </p>
          </Secao>
        </div>
      </Modal>
    </>
  );
}
