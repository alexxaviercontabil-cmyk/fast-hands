# FAST HANDS — protótipo

Jogo de cartas online para 2 a 15 jogadores. Tem salas públicas e fechadas, regras que dá pra mudar, voz, frases e memes de áudio.

---

## 1) Jogar no seu PC (teste rápido)

1. Instale o **Node.js** em https://nodejs.org (clique no botão **LTS**, depois é só avançar até terminar).
2. Descompacte a pasta `fast-hands` em qualquer lugar (ex: Área de Trabalho).
3. Dê **dois cliques em `INICIAR.bat`**.
   - Se o Windows perguntar sobre o **Firewall**, clique em **Permitir**.
4. O navegador abre sozinho em `http://localhost:3000`. Se não abrir, digite esse endereço.
5. Para testar sozinho: crie uma sala → clique em **🤖 + Bot** algumas vezes → **COMEÇAR PARTIDA**.
6. Para simular outro jogador no mesmo PC, abra **outra janela anônima** (Ctrl+Shift+N) no mesmo endereço.

> Deixe a janela preta aberta enquanto joga. Se fechar, o jogo para.

## 2) Jogar com o celular na mesma rede Wi-Fi

1. Com o `INICIAR.bat` rodando, a janela preta mostra um endereço tipo `http://192.168.0.15:3000`.
2. No celular (no mesmo Wi-Fi), abra esse endereço no navegador.
3. Dica: no celular, use **"Adicionar à tela inicial"** e ele vai abrir como se fosse um app.

## 3) Colocar online (amigos e estranhos de qualquer lugar)

Use um site que hospeda o jogo de graça, como o **Render**:

1. Crie uma conta em https://github.com, crie um repositório novo e **arraste todos os arquivos da pasta** pra dentro dele (botão "Add file → Upload files").
2. Crie uma conta em https://render.com e entre com o GitHub.
3. Clique em **New → Web Service** e escolha o repositório.
4. Preencha:
   - **Build Command:** deixe em branco (ou `echo ok`)
   - **Start Command:** `node server.js`
   - **Plano:** Free
5. Clique em **Create**. Em uns 2 minutos aparece um link tipo `https://fast-hands.onrender.com`. É só mandar esse link pra galera.

> No plano grátis o servidor "dorme" depois de uns 15 minutos sem ninguém jogando. O primeiro acesso depois disso demora uns 30 a 50 segundos pra acordar.
> O microfone só funciona em link **https** (o Render já usa https) ou no `localhost`.

---

## Como funciona o jogo

| Ação | Como fazer |
|---|---|
| Jogar carta | Clique na carta. Se ela não puder ser jogada, **a tela treme**. O jogo não mostra quais cartas servem. |
| Comprar | Clique no monte preto (atalho no PC: **C**) |
| Passar | Aparece depois que você compra uma carta que serve |
| **LAST!** | Acende quando você fica com 1 carta. Se não apertar antes do próximo jogador agir, você compra cartas (atalho: **L**) |
| **9** | Aparece uma mão gigante: **todo mundo bate**. Quem bater por último, ou não bater, compra (atalho: **Espaço**) |
| **0** | Quem joga escolhe alguém pra **trocar a mão** |
| **7** | **Silêncio**: ninguém corta nem manda frase/meme até o próximo jogar |
| **Cortar** | Tem a carta **idêntica** (mesma cor e número) à da mesa? Jogue fora da sua vez e o jogo continua a partir de você |
| Coringa / +4 | Escolha a cor depois de jogar |

**Regras que o dono da sala pode mudar:** coringa, +4, +2, bloqueio, inverter, efeitos do 9/0/7, cortar, acumular +2/+4, comprar até servir, cartas iniciais, multas, tempo por jogada e quantidade de baralhos. No automático, o jogo usa mais baralhos quando tem muita gente.

**Frases e memes:** em **🎙️ Minhas frases & memes** você cria quantas frases quiser e grava (ou envia) vários áudios de até 8 segundos. Marque até **10 de cada** pra aparecerem nos botões durante a partida. Os áudios ficam salvos no seu navegador.

**Voz:** clique em **🎧** pra entrar na conversa de voz e em **🎤** pra mutar.

---

## Limitações deste protótipo (próximos passos)

- **Voz:** funciona na maioria das redes Wi-Fi. Em algumas redes de celular (4G/5G) ou de empresa, pode ser preciso adicionar um servidor "TURN" (ex: Twilio ou Metered), que é pago a partir de certo uso.
- Com 15 pessoas na voz, cada um conecta com todos. Funciona, mas pesa em celular fraco. Pra versão final, o ideal é um servidor de voz (ex: LiveKit).
- Os jogadores ficam salvos só enquanto o servidor está ligado (não tem login nem ranking permanente ainda).
- **App de celular:** o jogo já funciona no navegador do celular e pode ser adicionado à tela inicial. Pra publicar na Play Store/App Store, dá pra empacotar essa mesma tela com o **Capacitor**.

## Arquivos

- `server.js`: o "juiz" do jogo (salas, regras, bots, turnos)
- `minisock.js`: conexão em tempo real (feita do zero, não precisa instalar nada)
- `public/`: o que aparece na tela (`index.html`, `style.css`, `app.js`)
