# FAST HANDS — protótipo v0.6

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

**Menu inicial:** Jogar · Loja · Personalizar · Configurações.

**Jogar**
- **Buscar online:** você marca "Sim", "Não" ou "Tanto faz" pra cada regra, e o jogo acha as salas que batem. Se não achar, oferece criar uma sala com essas regras.
- **Ver salas:** lista as salas abertas. Cada uma tem o botão **📜 Regras** pra ver as regras antes de entrar.
- **Criar sala:** 🌎 Pública, 🔒 Privada com senha ou 🙈 Privada sem senha (só entra quem tiver o código/convite).
- **Entrar numa sala que já está jogando:** você escolhe entre **assistir** ou **esperar no chat**. Nos dois casos entra na próxima rodada.

| Ação | Como fazer |
|---|---|
| Jogar carta | Clique na carta. Se não puder, **a tela treme** (o jogo não mostra quais servem) |
| Comprar | Clique no monte (atalho no PC: **C**) |
| **FAST HAND!** | Acende quando você fica com 1 carta. Aparece um aviso gigante pra todo mundo. Se não apertar antes do próximo jogar, compra (atalho: **F**) |
| **+2 / +4** | Você compra e, se tiver carta que serve, **ainda joga**. Se não tiver, passa sozinho |
| **9** | Mãos voando: todo mundo bate na mesa. Quem bater por último compra (atalho: **Espaço**) |
| **0** | Troca é opcional: escolha alguém, **não troque**, ou faça **todos passarem a mão** no sentido do jogo |
| **Coringa / +4** | Não dá pra **bater** (terminar) com coringa ou +4 como última carta: tem que comprar |
| **7** | Silêncio: até o próximo jogar, só quem está na vez joga. Carta errada, jogar fora da vez ou mandar frase/meme = "falou" e compra multa (padrão 2, ajustável) |
| **Cortar** | Tem a carta **idêntica** (cor e número)? Jogue fora da vez. Os bots também cortam! |

**Humor dos bonecos:** quem é cortado ou bloqueado fica **congelado** 🧊 e triste; quem pega muitas cartas vai ficando **bravo** 💢 até aparecer uma **tempestade com raios** ⛈️ em cima dele (passa com o tempo e jogando cartas); quem está com 1 carta fica nervoso, com 2 fica feliz, e quem vence comemora 🎉.

**Música:** o jogo compõe a música ao vivo (calma no menu, animada na partida e mais acelerada quando alguém está de FAST HAND ou na hora de bater na mesa). Ajuste o volume em Configurações → Sons.

Toda vez que alguém pega cartas por castigo (+2, +4, FAST HAND esquecido, bater por último, tempo esgotado) aparece um aviso grande e um "+N" em cima da pessoa.

**Loja:** ganhe moedinhas jogando (+10 por partida, +1 por carta jogada, **+50 por vitória**) e compre bonecos, chapéus, óculos e acessórios.

**Personalizar:** troque boneco, cores, chapéu, óculos e acessório. Coloque uma **foto do rosto** dentro da cabeça do boneco. Grave ou envie **sons de até 10 segundos** e crie **frases** (deboche, mensagem, comemoração). Até 10 de cada aparecem na partida.

**Configurações:** apelido, vibração, atalhos, volumes (efeitos, sons dos outros, voz), tamanho das letras, tamanho das cartas, cor da mesa, animações e **Minhas regras** (crie conjuntos de regras do seu jeito pra usar ao criar salas).

---

## Tutorial

No menu tem **🎓 COMO JOGAR**: um passo a passo com mini-desafios (combinar cartas, comprar, FAST HAND!, cortar, bater no 9, silêncio do 7, humor do boneco). Quem entra pela primeira vez é convidado a fazer.

## Limitações deste protótipo (próximos passos)

- **Voz:** cada pessoa precisa clicar em **🎧** pra entrar na voz. Clicando de novo no 🎧 aparece o painel com a barrinha do seu microfone e o status de cada pessoa (🟢 conectado / 🔴 não conectou).
  - Entre redes diferentes (ex: celular no 4G e PC no Wi-Fi), muitas vezes a conexão direta é bloqueada. Pra isso existe o servidor **TURN**. A Metered dá **20 GB/mês grátis**:
    1. Crie conta grátis em https://dashboard.metered.ca/signup?tool=turnserver
    2. No painel, pegue o link de credenciais. Ele tem este formato: `https://SEUAPP.metered.live/api/v1/turn/credentials?apiKey=SUACHAVE`
    3. No Render, abra o serviço → **Environment** → adicione `METERED_URL` com esse link → salvar (ele reinicia sozinho).
- Com 15 pessoas na voz, cada um conecta com todos. Funciona, mas pesa em celular fraco. Pra versão final, o ideal é um servidor de voz (ex: LiveKit).
- Moedinhas, itens, sons e frases ficam salvos **no aparelho/navegador** de cada jogador (protegidos contra trapaça por uma assinatura do servidor). Não tem login ainda, então se limpar o navegador ou trocar de aparelho, começa do zero.
- Pra proteger as moedinhas, configure a variável `SECRET` no Render (Environment) com um texto aleatório e não mude mais.
- **App de celular:** o jogo já funciona no navegador do celular e pode ser adicionado à tela inicial. Pra publicar na Play Store/App Store, dá pra empacotar essa mesma tela com o **Capacitor**.

## Arquivos

- `server.js`: o "juiz" do jogo (salas, regras, bots, turnos)
- `minisock.js`: conexão em tempo real (feita do zero, não precisa instalar nada)
- `public/`: o que aparece na tela (`index.html`, `style.css`, `app.js`)
