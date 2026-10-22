import "./RoboBoasVindas.css";

/**
 * Robô de boas-vindas com balão de mensagem.
 * Fica no canto inferior esquerdo da tela e aparece com animação ao abrir.
 * Precisa do arquivo /public/robo.png
 */
export default function RoboBoasVindas() {
  return (
    <div className="robo-container" aria-hidden="true">
      <img src="/robo.png" alt="" className="robo-img" />

      <div className="robo-balao">
        <strong>Bem-vindo ao SGAG-PDS!</strong>
        <span>
          Somos um site desenvolvido para gestão e avaliação de grupos do CEMI!
        </span>
      </div>
    </div>
  );
}
