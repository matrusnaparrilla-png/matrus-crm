# Matrus · CRM de Experiência do Salão

Sistema de avaliação de experiência do cliente via QR Code individual por garçom (com suporte
preparado para QR Code por mesa), com dashboard administrativo, ranking de garçons, alertas
automáticos e relatórios.

Stack: Next.js 14 (App Router) + TypeScript + Tailwind + Supabase (Postgres + Auth + RLS).

Este projeto usa um projeto Supabase **dedicado** ("Matrus CRM", ref `uljnppykriaiiccwvjil`),
separado do `matros-ops`. Todas as tabelas usam o prefixo `salao_` para o caso de esse banco vir
a ser compartilhado com outro sistema no futuro.

## 1. Rodando localmente

```bash
npm install
npm run dev
```

Abra http://localhost:3001 (a porta está fixada em 3001 no `.env.local` para não colidir com o
matros-ops, que também roda na 3000).

## 2. Banco de dados

✅ **Já aplicado no projeto Supabase "Matrus CRM"** (ref `uljnppykriaiiccwvjil`): schema, RLS,
views, funções e dados de teste de desenvolvimento (5 garçons, 10 mesas, ~50 avaliações) foram
rodados via SQL Editor. O primeiro usuário administrador também já foi criado e testado.

Para reaplicar em outro projeto Supabase do zero, rode nesta ordem pelo
[SQL Editor](https://supabase.com/dashboard/project/uljnppykriaiiccwvjil/sql/new):

1. `supabase/migrations/20260813120000_salao_crm_init.sql` — tabelas, RLS, views e funções.
2. (opcional, só em desenvolvimento) `supabase/migrations/20260813120100_salao_crm_seed_dev.sql`
   — dados de teste.
3. Crie o usuário no painel (**Authentication → Users → Add user**, com "Auto Confirm User"),
   copie o **User UID** e rode:
   ```sql
   insert into salao_users (id, unit_id, name, email, role)
   values ('COLE_O_USER_UID_AQUI', (select id from salao_units limit 1), 'Seu Nome', 'seu-email@matrus.com.br', 'admin');
   ```
   Depois disso, novos usuários (gerente/garçom) podem ser criados direto pela tela **Usuários**
   do painel — sem precisar repetir esse passo manual.

## 3. Variáveis de ambiente

`.env.local` (já criado, reaproveitando o projeto Supabase do matros-ops):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=Matrus Experiência
```

Em produção, `NEXT_PUBLIC_APP_URL` deve ser o domínio público real — ele é usado para montar a
URL de cada QR Code (`{APP_URL}/avaliar/{token}`), então precisa estar certo antes de gerar e
imprimir os QR Codes definitivos.

## 4. Arquitetura implementada

- **Fluxo público do cliente** (`/avaliar/[token]`, sem login): identifica o garçom (e mesa, se
  aplicável) pelo token do QR Code, cria uma sessão, conduz o cliente por um formulário em 6
  etapas (experiência geral → garçom → comida → ambiente/agilidade → comentário/NPS/retorno →
  agradecimento com link do Google) e grava a avaliação via `/api/evaluations`.
- **Banco**: tabelas `salao_units`, `salao_users`, `salao_waiters`, `salao_tables`,
  `salao_qr_codes`, `salao_sessions`, `salao_evaluations`, `salao_evaluation_categories`,
  `salao_alerts`, `salao_settings`, `salao_rate_limits`. RLS habilitado em todas; acesso público
  do QR Code é feito só via função `SECURITY DEFINER` (sem policy pública de leitura).
- **RPC `submit_salao_evaluation`**: grava avaliação + notas por categoria + alerta automático
  (negativo se nota geral ou alguma categoria ≤ limiar configurado, ou se o cliente indicou baixa
  intenção de retorno; positivo/destaque se nota máxima em tudo) numa transação só.
- **Anti-fraude**: cada envio é vinculado a um fingerprint gerado no dispositivo (localStorage) +
  o `qr_code_id`; reenvios do mesmo par dentro de 15 minutos são bloqueados (`salao_rate_limits`).
- **Painel administrativo** (`/admin`, exige login):
  - **Dashboard**: KPIs (avaliações, nota média, NPS, retorno), gráfico de notas por categoria,
    ranking de garçons (com "Dados insuficientes" abaixo do mínimo configurável), "Precisa de
    atenção" e "Destaques da equipe", seção "O que está acontecendo?" e "O que devemos fazer?"
    geradas por regras determinísticas sobre os dados reais — nunca inventa números; quando não
    há amostra suficiente, mostra explicitamente "Dados insuficientes para concluir".
  - **Garçons**: cadastro, ativar/desativar, gerar/baixar/imprimir/regenerar QR Code individual.
  - **Alertas**: fila de ocorrências negativas com status (novo/em análise/resolvido/ignorado) e
    observação interna, + aba de destaques positivos.
  - **Relatórios**: filtros por período/garçom/mesa/nota, exportação CSV, resumo mensal
    automático (avaliações, nota média, melhor garçom, maior ponto positivo/negativo, horário
    crítico).
  - **Configurações** (admin): nome da empresa, mensagem de agradecimento, link de avaliação do
    Google (sempre exibido a todos os clientes — nunca ocultado dos insatisfeitos), limiar de
    alerta, mínimo de avaliações para ranking, cadastro de mesas com QR Code próprio.
  - **Usuários** (admin): criação de administradores/gerentes/garçons com acesso ao painel.
- **Permissões**: `admin` acesso total; `gerente` tudo exceto configurações críticas e usuários;
  `garcom` só vê os próprios indicadores (dashboard filtrado automaticamente por RLS — não é uma
  regra só de UI, o banco recusa a query de outros garçons mesmo que alguém tente burlar a tela).

## 5. O que foi testado de ponta a ponta (navegador real)

- Login do administrador e proteção de rotas `/admin/*`.
- Geração de QR Code por garçom (download e impressão).
- Fluxo completo do cliente pelo QR real: nota geral, garçom, comida, ambiente/agilidade,
  melhor aspecto, "o que melhorar", intenção de retorno, NPS, envio.
- Validação de formulário incompleto (botão "Enviar" permanece desabilitado e não envia).
- Alerta negativo gerado automaticamente em tempo real após avaliação nota 2, com motivo correto
  ("Nota geral baixa; Categoria avaliada abaixo do esperado; Baixa intenção de retorno").
- Fluxo de status do alerta (Novo → Em análise) com observação interna salva.
- Botão "Avaliar no Google" aparecendo mesmo após avaliação negativa (nota 2) — confirma que o
  link nunca é ocultado de cliente insatisfeito.
- Anti-fraude: segunda tentativa no mesmo QR Code em menos de 15 min foi bloqueada.
- Dashboard com KPIs, gráfico por categoria e ranking de garçons refletindo os dados reais.
- Relatório mensal automático (avaliações, nota média, melhor garçom, ponto positivo/negativo,
  horário crítico) e exportação CSV com filtros.
- Configurações: edição e persistência do link do Google e demais ajustes.
- Responsividade mobile (375px) na tela do cliente e no dashboard administrativo.

## 6. LGPD e privacidade

- A avaliação não exige nome/telefone do cliente — o campo de contato é opcional e claramente
  marcado como tal.
- Nenhum dado pessoal é embutido no QR Code (o token é opaco e não reversível).

## 7. Deploy

1. Suba o repositório para o GitHub (ainda não foi feito — projeto só tem `git init` local).
2. Importe na [Vercel](https://vercel.com/new) apontando para a pasta `matrus-crm`.
3. Configure as variáveis de ambiente do projeto na Vercel (mesmas do `.env.local`, **exceto**
   `NODE_TLS_REJECT_UNAUTHORIZED`, que é só para este sandbox):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` → o domínio final (ex: `https://experiencia.matrus.com.br`)
   - `NEXT_PUBLIC_APP_NAME`
4. Depois do primeiro deploy, regenere os QR Codes de todos os garçons (botão "Regenerar" em
   **Garçons**) só se os QR Codes impressos ainda apontarem para `localhost` — QR Codes gerados
   com `NEXT_PUBLIC_APP_URL` já correto não precisam ser regenerados.

## 8. Limitações conhecidas / próximos passos

- **Multiestabelecimento**: o schema já suporta múltiplas `salao_units`, mas a troca de unidade
  no painel é básica (seletor simples); um fluxo completo de gestão multi-loja não foi construído
  por não haver ainda uma segunda unidade real da Matrus.
- **E-mail transacional**: a criação de usuários define uma senha inicial diretamente (sem envio
  de e-mail de convite), pois não há um provedor de SMTP configurado no projeto Supabase
  compartilhado. Se quiser convites por e-mail, é preciso configurar SMTP no Supabase Auth.
- **Fingerprint anti-fraude**: usa um identificador salvo em `localStorage` do navegador — é
  suficiente para reduzir reenvios acidentais/spam casual, mas não é uma defesa contra um usuário
  técnico decidido (ex: modo anônimo). Para algo mais robusto, seria necessário CAPTCHA/Turnstile.
  Testado manualmente: uma segunda tentativa de avaliar o mesmo QR Code em menos de 15 minutos é
  bloqueada com a mensagem "Você já avaliou recentemente".
- **`NODE_TLS_REJECT_UNAUTHORIZED=0` no `.env.local`**: necessário só neste sandbox de
  desenvolvimento, onde o proxy de rede quebra a verificação de certificado TLS em chamadas
  HTTPS de saída do Node (o mesmo problema também impede o download da fonte Inter do Google
  Fonts). **Remova essa linha ao rodar em qualquer outra máquina ou em produção/deploy** — lá
  esse workaround não é necessário e reduz a segurança da conexão.
