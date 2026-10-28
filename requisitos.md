# 📄 Documento de Requisitos do MVP — ERP Cantina & Balcão

## 🎯 1. Visão Geral do Produto

O ERP é uma solução Web App de alta performance e baixo custo, focada em otimizar o atendimento de balcão para picos de movimento (pós-culto/eventos), permitindo controle rígido de estoque de bebidas, flexibilidade no cardápio de lanches e **impressão direta de comandas em impressora térmica Bluetooth via navegador**.

* **Contexto de uso:** projeto de uso pessoal/comunitário, **sem fins comerciais** (não será comercializado).
* **Escopo operacional do MVP:** **um único dispositivo** (caixa) por evento, conectado a uma impressora. A cozinha trabalha exclusivamente com a **comanda impressa**.

---

## 🖨️ 2. Requisitos de Impressão Universal (Android / iOS / Desktop)

### Impressora selecionada

* **Modelo:** **GOOJPRT PT-210** (58 mm, firmware MTP-II, Bluetooth *dual mode*: SPP + **BLE**). É o modelo de marca da mesma família "MTP-2" do [anúncio de referência na Shopee](https://shopee.com.br/Mini-Impressora-T%C3%A9rmica-Port%C3%A1til-Bluetooth-Usb-58mm-Pos-i.1776929393.58266571690), porém com BLE documentado.
* **Motivo da escolha:** a Web Bluetooth API só se comunica via **BLE (GATT)**. Clones genéricos "MTP-2/4.0" frequentemente expõem apenas Bluetooth Clássico (SPP), o que inviabiliza a impressão pelo navegador. A PT-210 tem UUIDs de serviço BLE conhecidos e mapeados pela comunidade, o que elimina o risco de ausência de BLE.
* **Compra:** priorizar anúncio que cite explicitamente **"GOOJPRT PT-210"** e permita devolução (Mercado Livre/Amazon/Shopee).
* **Teste de aceite (no recebimento, antes de qualquer desenvolvimento de impressão):**
  1. Abrir o app **nRF Connect** (Android/iOS) e escanear; a impressora deve aparecer como dispositivo BLE.
  2. Conectar e confirmar a existência de um serviço com característica de escrita (`WRITE` / `WRITE WITHOUT RESPONSE`). UUIDs conhecidos dessa família:
     * `49535343-fe7d-4ae5-8fa9-9fafd205e455` (característica `49535343-8841-43f4-a8d4-ecbe34729bb3`)
     * `000018f0-0000-1000-8000-00805f9b34fb` (característica `00002af1-…`)
     * `0000ff00-0000-1000-8000-00805f9b34fb` (firmwares antigos)
  3. Se nenhum serviço BLE gravável aparecer → devolver o produto.

### Requisitos

* **[RF-01] Impressão Bluetooth Web (Web Bluetooth API & ESC/POS):**
* O Web App deve parear diretamente com a impressora térmica Bluetooth de 58mm da interface web.
* **Especificações Técnicas de Hardware Alvo:** Largura do papel de 58 mm (largura útil de impressão de 48 mm / 384 pontos por linha, resolução de 203 DPI), **32 caracteres por linha** na fonte padrão.
* **Protocolo de Comunicação:** Geração de comandos no padrão universal **ESC/POS** via código no frontend (ex: biblioteca `esc-pos-encoder`) para formatação de textos, quebras e avanço/corte de papel.
* **Descoberta do serviço:** o `requestDevice()` deve declarar todos os UUIDs conhecidos (acima) em `optionalServices` e o app deve localizar automaticamente a primeira característica gravável. O envio deve ser fragmentado em blocos (ex: 100–180 bytes) para respeitar o MTU do BLE.
* **Reconexão:** o pareamento exige gesto do usuário e HTTPS. O app deve exibir o estado da impressora (conectada/desconectada) e um botão "Conectar impressora" acessível em 1 toque; quando suportado, usar `navigator.bluetooth.getDevices()` para reconectar sem novo seletor.


* **[RF-02] Compatibilidade Multi-SO:**
* **Android / Chrome / Desktop:** Conexão direta via Web Bluetooth API (`navigator.bluetooth`) sem necessidade de aplicativos pontes ou intermediários. **Plataforma principal do MVP.**
* **iOS / iPadOS (Safari / Navegadores iOS):** Para contornar as restrições nativas do iOS com Web Bluetooth, o ecossistema do cliente deve prever:
1. Utilização de navegadores com suporte a Web Bluetooth no iOS (como o app *Bluefy Browser* ou *WebBLE* disponíveis na App Store) **OU**
2. Fallback por renderização de cupom em visualização rápida para impressão nativa via diálogo padrão do sistema operacional.


* **[RF-03] Reimpressão Rápida:**
* O painel deve conter um botão de histórico com opção de reimpressão imediata de qualquer comanda em caso de falha de papel ou atolamento.


* **[RF-03a] Acentuação (Português BR):**
* Impressoras MTP-II genéricas não têm tabela de caracteres latina garantida (muitas vêm em GBK), o que faz acentos saírem como símbolos ilegíveis.
* **Decisão:** todo texto enviado à impressora passa por **transliteração** — remoção de acentos (`ã→a`, `é→e`, `ç→c`) e conversão para **MAIÚSCULAS** —, garantindo legibilidade em qualquer firmware. O texto na tela e no banco mantém a acentuação original.
* Se o teste de aceite confirmar suporte à codepage **CP860 (Português)**, a acentuação pode ser habilitada por configuração, mantendo a transliteração como padrão.


* **[RF-03b] Momento e quantidade de vias:**
* **Uma via** é impressa automaticamente **ao gerar o pedido**; ela serve de controle para cozinha e entrega.

---

## 🛒 3. Requisitos do Fluxo de Balcão e Pedidos (Interface Única)

* **[RF-04] Identificação do Cliente:** Campo de texto simples e obrigatório para registrar o **Nome do Cliente** ou identificador rápido.
* **[RF-05] Cardápio Dinâmico (Lanches do Dia):**
* Configuração rápida das **Opções Ativas do Dia** (ex: *Pizza de Calabresa*, *Pão com Pernil*, *Pastel de Frango*) com preços configuráveis, vinculadas ao **Evento** aberto (RF-13).


* **[RF-06] Seleção de Bebidas e Combos:**
* Atalhos para bebidas fixas (*Pitchulinha*, *Refri Lata*, *Suco*, *Água com gás*).
* Montagem de **Combos Inteligentes** (1 Lanche do Dia + 1 Bebida Fixa).
* **Preço do combo é fixo** e definido no cadastro, independente da soma dos itens — o objetivo é facilitar a venda e arredondar valores (ex: salgado R$ 7,00 + pitchulinha R$ 3,00 → combo R$ 10,00; salgado R$ 7,50 + refri R$ 3,00 → combo R$ 10,00).
* O cadastro do combo define quais lanches e quais bebidas podem compô-lo. Cada item do combo baixa o seu próprio estoque.


* **[RF-07] Campo de Observação/Anotações:**
* Campo de texto livre vinculado ao item ou pedido (ex: *"Sem maionese"*, *"Bem passado"*).


* **[RF-08] Gestão de Status e Reservas:**
* Opção de marcar o pedido como **"Reserva / Antecipado"** (ficando em destaque para preparo futuro).
* Transição de status: `Pendente / Em Preparo` ➔ `Pronto` ➔ `Entregue`. Status adicional: `Cancelado`.
* Cancelamento disponível para o operador enquanto o pedido não estiver `Entregue`.


* **[RF-12] Pagamento:**
* Formas aceitas: **Pix**, **Dinheiro** e **Pagar depois** (fiado).
* **Pix:** exibir na tela a chave Pix (`jovens.cdc.7@gmail.com`, configurável no painel admin) e um **QR Code Pix estático com o valor do pedido** (BR Code "copia e cola"). A confirmação do recebimento é manual pelo operador.
* **Dinheiro:** campo opcional "valor recebido" com cálculo automático do troco.
* **Pagar depois:** o pedido fica registrado como **pendente de pagamento** vinculado ao nome do cliente; a quitação posterior é feita no painel admin (RF-16), informando a forma usada (Pix ou dinheiro).


* **[RF-13] Evento / Sessão de Vendas:**
* Toda venda pertence a um **Evento** (ex: *"Culto Domingo 02/11"*), aberto antes do início das vendas e fechado no fechamento de caixa.
* A **numeração dos pedidos reinicia em cada evento** (`#001`, `#002`, …).
* O evento concentra o cardápio do dia, as vendas, as movimentações de estoque e o fechamento de caixa daquele dia.


* **[RF-14] Origem do Pedido (preparação para evolução futura — fora do MVP):**
* Futuramente o próprio cliente poderá fazer o pedido pelo app; esse pedido entrará com status `Aguardando confirmação` e só será impresso/preparado após confirmação do caixa.
* No MVP, o modelo de dados já deve registrar a **origem** do pedido (`BALCAO` / `AUTOATENDIMENTO`), mas apenas `BALCAO` é implementado.

---

## 📦 4. Requisitos de Gestão de Estoque

* **[RF-09] Baixa Automática de Estoque:**
* Cada item vendido (avulso ou dentro de combo) diminui **automaticamente** o estoque **no momento da criação do pedido**, inclusive para pedidos marcados como **Reserva** (a reserva bloqueia o estoque).
* O **cancelamento** de um pedido **devolve** as quantidades ao estoque.
* Toda entrada, saída, bloqueio ou devolução é registrada em uma tabela de movimentações vinculada ao evento (auditoria).


* **[RF-09a] Tipos de Controle de Estoque por Produto:**
* **Contável** (padrão para bebidas): quantidade numérica com baixa automática; a venda é bloqueada quando o saldo for insuficiente.
* **Não contável** (lanches com rendimento incerto, ex: macarrão, marmitas, pratos montados): sem quantidade; o operador marca o item como **"Esgotado"** com 1 toque, removendo-o das opções de venda.
* Lanches cujo rendimento é conhecido (ex: 30 fatias de pizza) podem ser cadastrados como contáveis.


* **[RF-10] Alerta de Estoque Crítico:**
* Destaque visual na tela do operador indicando produtos contáveis que estão com quantidade zerada ou abaixo do limite configurado.


* **[RF-11] Ajuste/Entrada Rápida de Estoque:**
* Tela simples para o operador inserir a quantidade de bebidas que chegaram para o evento (ex: *"Adicionar +24 Refri Lata"*).

---

## 🔐 5. Perfis de Acesso e Painel Administrativo

* **[RF-15] Autenticação e Perfis:**
* Login por e-mail e senha (Supabase Auth). Usuários são criados pelo admin (sem cadastro público).
* **Admin:** acesso total — painel administrativo, dados financeiros, cadastros, fechamento de caixa e tudo que o operador faz.
* **Operador:** geração de pedidos, alteração de status, cancelamento, reimpressão, marcação de "Esgotado" e entrada rápida de estoque. **Sem acesso** a dados financeiros consolidados nem a cadastros.
* **Abertura/encerramento de evento e montagem do cardápio do dia** (incluir/remover lanches, cadastro rápido) são ações do **Admin**, por fazerem parte dos cadastros. Sem evento aberto, o operador vê o aviso para acionar o administrador.
* Usuário autenticado no Supabase sem perfil ativo no banco não acessa o sistema (desativar = `active = false`).
* Criação de usuários enquanto o painel administrativo não existe: script `pnpm user:create` (usa a chave secreta do Supabase, somente local/CI).
* A cozinha **não** utiliza o sistema; trabalha com a comanda impressa.


* **[RF-16] Painel Administrativo (visível somente ao Admin):**
* **Cadastros:** produtos (lanches e bebidas, preço, tipo de controle de estoque, limite crítico), combos (preço fixo e itens permitidos), eventos, usuários e configurações (chave Pix, nome no cabeçalho do cupom).
* **Dados financeiros:** vendas por evento, por forma de pagamento e por produto; lista de **pagamentos pendentes (fiado)** com quitação.
* **Fechamento de caixa por evento:** total vendido por forma de pagamento, total de fiado em aberto, valor esperado em dinheiro × valor contado (com registro da diferença) e encerramento do evento.

---

## 📱 6. Requisitos Não Funcionais e Arquitetura

* **[RNF-01] Stack Tecnológica:**
* **Princípio:** usar sempre a **versão estável mais recente** de cada dependência e os padrões atuais de mercado. O projeto *cdc-website* serve apenas como **referência** de integração com Supabase — **não** há obrigação de manter versões compatíveis com ele nem de seguir seus padrões de código.
* **Frontend/Backend:** Next.js 16 (App Router, Single Repository), TypeScript em modo `strict`.
* **Banco de Dados:** Supabase (PostgreSQL).
* **Autenticação:** Supabase Auth (`@supabase/ssr`).
* **Hospedagem:** Vercel (Hobby/Free Tier — adequado por ser uso pessoal, não comercial).


* **[RNF-02] Responsividade PWA (Progressive Web App):**
* A interface deve ser instalável na tela inicial (*Add to Home Screen*) e otimizada para toque em telas de 7" a 10" (tablets Android/iPad) e celulares.


* **[RNF-03] Velocidade de Operação:**
* O registro de um pedido completo (Nome + Combo + Obs) não deve exigir mais do que **3 a 4 toques na tela**.
* **Regra de contagem:** o preenchimento do nome inteiro conta como **1 toque**. Exemplo para 3 combos: 1 toque no nome + 1 toque para selecionar o combo + no máximo 2 toques para ajustar a quantidade.


* **[RNF-04] Persistência, ORM e Migrations:**
* **Referência x melhoria:** o *cdc-website* (branch `main` do remote, commit `d6b8bf1`) usa Prisma 7 + `@prisma/adapter-pg` e foi o ponto de partida, mas sua configuração **pode e deve ser aprimorada**. Itens dele que **não** devem ser replicados: ausência de pasta `prisma/migrations` (schema sem histórico), import de `@prisma/config` em vez de `prisma/config`, gerador legado `prisma-client-js`, mapeadores com `any`, `ignoreBuildErrors`/`ignoreDuringBuilds` no `next.config` e ausência de validação de variáveis de ambiente.
* **ORM:** **Prisma ORM 7.x — última versão estável** (7.10.x em out/2026). A linha 8.0 ainda está em *release candidate* (a tag `latest` do npm aponta para um RC); a migração para a 8 será feita quando sair a versão estável (GA). Versões fixadas no `package.json` sem `^` para `prisma`, `@prisma/client` e `@prisma/adapter-pg`, mantidas na mesma versão.
* **Generator:** `prisma-client` (gerador ESM atual) com `output` explícito (ex: `src/generated/prisma`, incluído no `.gitignore`), importado a partir desse caminho e não de `@prisma/client`.
* **`prisma.config.ts`:** `import { defineConfig, env } from 'prisma/config'` + `import 'dotenv/config'`; `datasource.url = env('DIRECT_URL')`; `migrations.path = 'prisma/migrations'`; `migrations.seed = 'tsx prisma/seed.ts'`.
* **Conexão em runtime (Vercel / Server Actions / Route Handlers):** `DATABASE_URL` → **Supavisor em modo transação** (porta `6543`), via `new PrismaPg({ connectionString: env.DATABASE_URL })` (o adapter gerencia o pool; sem instanciar `pg.Pool` manualmente).
* **Conexão para CLI (migrations / seed):** `DIRECT_URL` → **Supavisor em modo sessão** (porta `5432`) ou conexão direta (`db.<ref>.supabase.co:5432`, apenas se houver IPv6).
* **Client singleton** em `src/server/db.ts` (cache em `globalThis` fora de produção), importado apenas em código de servidor (`import 'server-only'`).
* **Variáveis de ambiente validadas** na inicialização com **Zod** (ex: `@t3-oss/env-nextjs`), falhando o build se faltar `DATABASE_URL`, `DIRECT_URL`, chaves do Supabase ou `CRON_SECRET`.
* **Tipagem:** usar os tipos gerados (`Prisma.PedidoGetPayload<…>`, `Prisma.validator`) e DTOs validados com Zod nas Server Actions; proibido `any` nos mapeadores.
* **Fluxo de migrations (obrigatório, versionado no Git):**
  1. **Desenvolvimento em banco local** (Supabase CLI `supabase start` ou PostgreSQL via Docker) — nunca em produção. `prisma migrate dev --name <descricao>` gera o SQL em `prisma/migrations/`.
  2. Comandos executados **explicitamente** (o Prisma 7 não roda `generate` nem `seed` automaticamente): `prisma generate` e `prisma db seed` quando necessário.
  3. SQL que o schema Prisma não expressa (RLS, *check constraints*, índices parciais) entra via `prisma migrate dev --create-only` e edição do `migration.sql` antes de aplicar.
  4. **Produção:** `prisma migrate deploy` executado por **GitHub Actions** no push para `main` (secret `DIRECT_URL`), seguido do deploy da Vercel. A migration **não** roda no `build` da Vercel, para que deploys de *preview* não alterem o banco de produção.
  5. **CI de PR:** `prisma validate`, `prisma format --check` e `prisma migrate diff` (schema × migrations) para impedir alteração de schema sem migration correspondente.
  6. `prisma db push` permitido somente para prototipação local descartável.
* **Seed:** `prisma/seed.ts` (via `tsx`), idempotente (`upsert`), com bebidas fixas, combos e usuário admin inicial.
* **Supabase JS (`@supabase/ssr`, versão mais recente):** usado **somente** para Auth. Todo acesso a dados de negócio passa pelo Prisma.
* **Segurança (RLS):** como a `anon key` do Supabase é pública e as tabelas do schema `public` ficam expostas pela Data API (PostgREST), toda tabela criada por migration deve ter **RLS habilitado sem policies** (o Prisma conecta como `postgres` e não é afetado) ou a Data API deve ser desabilitada para o schema.
* **Integridade de estoque:** a baixa de estoque (RF-09) deve ser atômica dentro de `prisma.$transaction`, usando `updateMany({ where: { id, quantidade: { gte: n } }, data: { quantidade: { decrement: n } } })` e registrando cada movimentação.
* **Datas:** colunas de data/hora como `@db.Timestamptz`; exibição sempre no fuso `America/Sao_Paulo` (a Vercel roda em UTC).


* **[RNF-05] Manter o Banco Ativo (Keep-alive):**
* O plano gratuito do Supabase **pausa projetos após 7 dias sem atividade**, e a cantina opera de forma intermitente.
* **Solução:** **Vercel Cron Job** diário (`vercel.json` → `crons`) chamando a rota `GET /api/cron/keep-alive`, que executa uma consulta leve via Prisma (`SELECT 1`) e retorna `200`.
* A rota deve validar o header `Authorization: Bearer ${CRON_SECRET}` (variável de ambiente injetada pela Vercel) e recusar chamadas sem ele.
* *Observação:* a branch `main` do remote do *cdc-website* (commit `d6b8bf1`) não contém esse mecanismo (sem `vercel.json`, sem `.github/workflows`, sem rota de ping); se o banco dele se mantém ativo, isso está configurado fora do repositório (ex: serviço externo de ping ou cron no painel).


* **[RNF-06] Conectividade:**
* O sistema é **somente online**. Sem Wi-Fi nem dados móveis, o sistema pode parar e a operação segue **manualmente** (sem fila offline no MVP).
* A interface deve exibir um aviso claro de "Sem conexão" e bloquear a criação de pedidos enquanto offline, evitando registros perdidos.


* **[RNF-07] CI/CD e Deploy Automático na Vercel:**
* **Repositório:** GitHub, branch principal `main`. Todo trabalho entra por Pull Request.
* **Deploy controlado pelo pipeline:** o deploy automático por Git da Vercel fica **desligado** (`vercel.json` → `"git": { "deploymentEnabled": false }`) para que a ordem *migrations → deploy* seja garantida pelo GitHub Actions. O projeto continua vinculado à Vercel (variáveis de ambiente e crons configurados lá).
* **Workflow `ci.yml`** (em todo PR e push na `main`):
  1. `pnpm install --frozen-lockfile`.
  2. `pnpm lint` e `pnpm typecheck` (`tsc --noEmit`).
  3. `prisma validate` e `prisma format --check`.
  4. Aplicação das migrations em um PostgreSQL efêmero (*service container* do Actions) e `prisma migrate diff --exit-code` entre o banco migrado e o `schema.prisma`, falhando se houver alteração de schema sem migration.
  5. `pnpm build` (com variáveis de ambiente fictícias de CI).
* **Workflow `deploy.yml`:**
  * **Push na `main` (produção):** após o CI passar → `prisma migrate deploy` usando o secret `DIRECT_URL` → `vercel pull --environment=production` → `vercel build --prod` → `vercel deploy --prebuilt --prod`.
  * **Pull Request (preview):** `vercel pull --environment=preview` → `vercel build` → `vercel deploy --prebuilt`, com a URL do preview publicada no resumo do job. **Sem** migrations no preview.
  * **Ativação condicional ("quando configurado"):** os jobs de deploy só executam se os secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID` (e `DIRECT_URL`, para produção) estiverem cadastrados no repositório; caso contrário, o job é pulado com um aviso, sem falhar o pipeline.
  * `concurrency` por ambiente para impedir dois deploys de produção simultâneos.
* **Secrets do GitHub:** `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DIRECT_URL`.
* **Variáveis na Vercel (Production/Preview):** `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `CRON_SECRET`.
* **Preview e banco:** recomendado um **segundo projeto Supabase** (o plano gratuito permite dois) para os deploys de preview, evitando que um PR com schema novo opere sobre o banco de produção.

---

## 🚫 7. Fora do Escopo do MVP

* Tela de cozinha (KDS) e múltiplos dispositivos operando simultaneamente / sincronização em tempo real.
* Pedido feito pelo próprio cliente (autoatendimento) — apenas preparado no modelo de dados (RF-14).
* Operação offline.
* Integração automática de confirmação de Pix (a confirmação é manual).

---

# 🛠️ Exemplo da Estrutura do Cupom da Comanda (58mm ESC/POS)

Abaixo está o modelo visual de como a impressora térmica imprimirá o pedido enviado pelo Web App (32 colunas, texto transliterado sem acentos):

```text
================================
         CANTINA G7 - ERP
================================
EVENTO: CULTO DOMINGO 02/11
PEDIDO #042          TIPO: BALCAO
CLIENTE: MARCOS SILVA
HORA: 20:45
--------------------------------
QTD  ITEM                 VALOR
--------------------------------
 1   COMBO LANCHE DIA   R$ 10,00
     -> PAO COM PERNIL
     -> REFRI LATA
     *OBS: SEM MAIONESE*

 1   AGUA COM GAS        R$  4,00
--------------------------------
TOTAL:                  R$ 14,00
PAGAMENTO: PIX
================================
   [ ] PREPARADO   [ ] ENTREGUE

```
