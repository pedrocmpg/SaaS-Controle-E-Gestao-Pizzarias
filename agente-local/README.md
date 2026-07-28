# Agente de Impressão — Hub de Gestão para Pizzarias

Programa que roda no **PC do caixa** e imprime automaticamente na impressora térmica:

- **comanda da cozinha** — sai sozinha assim que o pedido é registrado;
- **cupom do cliente** — sai quando o pedido vai para entrega;
- **romaneio do motoboy** — sai no fechamento do turno, em duas vias para assinar.

> **Por que existe este programa?** O sistema roda na internet e a impressora está dentro
> da pizzaria, ligada no PC. Um servidor na nuvem não consegue falar direto com uma
> impressora USB na cozinha. Este agente faz essa ponte.

O agente **não abre nenhuma porta** no PC e **não recebe conexões de fora**: é ele que
liga para o sistema. Não é preciso mexer em firewall nem no roteador.

---

## Instalação

### 1. Instalar o Node.js

Baixe a versão **LTS** em [nodejs.org](https://nodejs.org) e instale (avançar, avançar,
concluir). Só precisa ser feito uma vez por PC.

### 2. Instalar o agente

Copie a pasta `agente-local` para o PC do caixa (sugestão: `C:\hub-pizzarias\agente`).
Abra o **Prompt de Comando** nessa pasta e rode:

```
npm ci
```

### 3. Configurar

Na pasta do agente, faça uma cópia do arquivo `.env.example` e renomeie a cópia para
`.env` (sem o `.example`). Abra no Bloco de Notas e preencha:

| Linha | O que colocar |
|---|---|
| `BACKEND_URL` | Endereço do sistema, sem barra no final. Fornecido pelo suporte. |
| `AGENTE_TOKEN` | Token da **sua** pizzaria. Fornecido pelo suporte. |
| `IMPRESSORA_TIPO` | `epson` na maioria dos casos. |
| `IMPRESSORA_INTERFACE` | Veja abaixo como descobrir. |
| `LARGURA_COLUNAS` | `48` para bobina de 80mm, `32` para bobina de 58mm. |

### 4. Testar a impressora

```
npm run testar-impressora
```

Deve sair um papel escrito "TESTE DE IMPRESSÃO". **Só siga adiante depois que isso
funcionar** — se o teste não imprime, o agente também não vai imprimir.

### 5. Ligar o agente

```
npm start
```

Deve aparecer `Agente no ar`. Pode minimizar a janela — mas **não feche**.

---

## Como descobrir o `IMPRESSORA_INTERFACE`

### Impressora ligada por cabo USB (mais comum)

1. Abra **Painel de Controle → Dispositivos e Impressoras**.
2. Ache a impressora térmica e anote o **nome exato** dela (ex.: `POS-80`, `EPSON TM-T20`).
3. No `.env`, escreva `printer:` seguido do nome, exatamente como aparece:

```
IMPRESSORA_INTERFACE=printer:POS-80
```

> O nome precisa bater **letra por letra**, incluindo espaços e maiúsculas.

### Impressora de rede (ligada no roteador por cabo de rede)

1. Com a impressora ligada, segure o botão **FEED** e ligue-a: sai um papel de
   autoteste com o IP (algo como `192.168.0.100`).
2. No `.env`:

```
IMPRESSORA_INTERFACE=tcp://192.168.0.100:9100
```

> Peça ao seu técnico de rede para **fixar o IP** da impressora no roteador. Se o IP
> mudar sozinho, o agente para de imprimir e será preciso corrigir esta linha.

---

## Deixar o agente ligando junto com o PC

Para o agente subir sozinho quando alguém ligar o computador — o caminho manual abaixo é
o mais fácil de dar suporte por telefone.

1. Crie um arquivo `iniciar-agente.bat` na pasta do agente, com este conteúdo (ajuste o
   caminho se você instalou em outro lugar):

```bat
@echo off
cd /d C:\hub-pizzarias\agente
npm start
```

2. Aperte **Windows + R**, digite `shell:startup` e dê Enter. Abre a pasta de
   inicialização do Windows.
3. Copie um **atalho** do `iniciar-agente.bat` para dentro dessa pasta.

Pronto: toda vez que o PC ligar, o agente sobe junto.

---

## Quando algo não imprime

O agente grava tudo o que faz no arquivo **`agente.log`**, na própria pasta. Abra no Bloco
de Notas e leia as últimas linhas — a mensagem está em português.

| O que aparece no log | O que fazer |
|---|---|
| `A impressora nao respondeu` | Impressora desligada, sem papel ou cabo solto. Resolva e reimprima pela tela do sistema. |
| `O AGENTE_TOKEN ... foi recusado` | Token errado ou vencido. Peça um novo ao suporte. |
| `sem conexao com o sistema` | Internet caiu. Assim que voltar, o agente reconecta e imprime o que ficou pendente. |
| `Desistindo do job ... apos 5 tentativas` | O agente pulou este papel para não travar os próximos. Resolva a impressora e clique em **Reimprimir** na tela do pedido. |

**Nada se perde se o agente estiver desligado.** Os pedidos ficam guardados no sistema e
são impressos assim que o agente voltar a conectar.

### Perguntas frequentes

**Posso fechar a janela preta?**
Não. Enquanto ela estiver aberta, o agente está funcionando. Pode minimizar.

**O PC do caixa precisa ficar ligado?**
Sim, durante o expediente — é ele que fala com a impressora.

**Dá para usar duas impressoras (cozinha e balcão)?**
Ainda não, nesta versão. Uma impressora por PC.

**Como atualizo o agente?**
Nesta versão a atualização é manual: o suporte envia a pasta nova, você substitui os
arquivos e roda `npm ci` de novo. O arquivo `.env` não é substituído.

---

## Informações técnicas (para o suporte)

- **Conexão:** cliente Socket.io autenticado com JWT (`auth.token`), com
  `auth.agente = true` — é o que acende o indicador de agente conectado no painel.
- **Recuperação:** a cada `connect`/`reconnect`, o agente chama
  `GET /api/impressao/pendentes` e enfileira o que houver.
- **Fila:** `fila.json` na pasta do agente, gravada a cada mudança. Sobrevive a
  desligamento do PC. Se o arquivo corromper, o agente sobe limpo e rebusca do backend.
- **Retry:** 5 tentativas por job, espaçadas de 10s. No limite, o backend marca o job como
  `ERRO` e o agente segue para o próximo (uma impressora sem papel não trava a fila).
- **Processamento:** serial — uma impressora imprime uma coisa por vez.
- **Layout:** vem pronto do backend (`backend/src/lib/impressaoLayout.js`, com testes). O
  agente só traduz estilo → ESC/POS e nunca decide conteúdo.
- **Log:** `agente.log`, rotacionado em 2 MB (mantém um `.anterior`).
