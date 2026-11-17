# Objetivos e fases do Psicárol

## Propósito e limites

O Psicárol é uma aplicação local-first para gestão administrativa e financeira de uma prática de psicologia. Não é um processo clínico nem um registo de saúde: não pode guardar notas de sessões, diagnósticos, hipóteses clínicas, planos terapêuticos ou conteúdo equivalente. Deve funcionar num único dispositivo, sem backend, cloud, sincronização, telemetria ou envio de dados pessoais a terceiros.

Este documento define resultados verificáveis, não obriga a uma estrutura técnica nova. Preferir o código, dependências e padrões já existentes. Fazer uma fase de cada vez, preservando alterações do utilizador. Não introduzir dados reais em desenvolvimento, testes, fixtures ou demonstrações.

## Estado conhecido

- Existe uma fundação React, TypeScript, Vite, Tailwind, React Router e Dexie/IndexedDB.
- Existem modelos, validação Zod, repositórios, migrações de base de dados e lógica de resumo de pagamentos.
- Existe uma implementação de PBKDF2/AES-GCM, codec de registos, sessão de segurança, bloqueio manual/automático e coordenação entre separadores; a política de palavra-passe e os parâmetros KDF são validados no domínio.
- As páginas principais já usam repositórios locais: utentes CRUD; consultas com criação/edição/estado e conflito temporal básico; salas CRUD/ativação; pagamentos parciais; dashboard e resumo financeiro do mês.
- A migração Dexie v4 remove os campos de associação `patientId`, `roomId` e `appointmentId` do armazenamento em claro; as consultas relacionais filtram os registos depois de os decifrar. Rever também qualquer novo índice antes de o adicionar.
- O bloqueio automático aplica as definições cifradas ao desbloquear, respeita a opção de bloquear ao ocultar a página e remove listeners/timers no cleanup; existem testes do temporizador e das opções de visibilidade.
- O estado `legacy` oferece migração explícita: valida o esquema e os IDs, prepara todos os payloads cifrados e grava-os com os metadados numa transação; falhas de validação não alteram os dados.
- A Fase 4 já tem gestão administrativa de utentes ligada aos repositórios cifrados: criar, editar, pesquisar, filtrar, arquivar e reativar. O estado vazio não apresenta dados de demonstração.
- Definições guardam duração, bloqueio e nova regra de comissão sem recalcular snapshots antigos. O backup tem formato versionado cifrado com palavra-passe própria, validação e restauro atómico, limitado a 20 MB.

## Fase 0 — Baseline e revisão

**Objetivo:** confirmar o que está realmente implementado e definir a próxima alteração segura.

**Tarefas:** ler `AGENTS.md`, inspecionar estado Git, rotas, modelos, repositórios, segurança e testes; executar lint, testes e build; identificar lacunas e dados de demonstração.

**Aceitação:** relatório separa implementação existente de pendente; alterações preexistentes são preservadas; falhas iniciais ficam registadas; não há edição alargada antes de escolher uma tarefa pequena e testável.

## Fase 1 — Interface e navegação

**Objetivo:** oferecer uma estrutura responsiva, consistente e acessível para os fluxos administrativos.

**Tarefas:** concluir navegação, cabeçalho, estados vazios, carregamento e erro, componentes reutilizáveis, foco visível, formulários com rótulos e mensagens de validação; manter português de Portugal e layouts utilizáveis em ecrãs estreitos.

**Aceitação:** todas as rotas principais são acessíveis; navegação por teclado e rótulos de formulário funcionam; nenhum botão aparenta uma ação não implementada; interface não apresenta dados fictícios como reais; layout não corta texto ou ações em mobile.

## Fase 2 — Modelo e persistência

**Objetivo:** consolidar os contratos de dados e operações locais sem misturar regras de negócio com apresentação.

**Tarefas:** validar entidades com Zod; IDs e datas consistentes; repositórios tipados e injetáveis; versões explícitas do esquema Dexie e migrações; transações para operações relacionadas; testes para validação, persistência, migração, referências e eliminação/arquivamento.

**Aceitação:** entidades persistidas são validadas; migrações têm testes e não descartam dados silenciosamente; falhas em operações compostas deixam a base de dados consistente; as páginas não contêm cópias divergentes da lógica financeira.

## Fase 3 — Segurança e privacidade (bloqueia dados reais)

**Objetivo:** garantir que o armazenamento, sessões, migrações e recuperação não expõem nem perdem registos pessoais em falhas normais.

**Estado:** implementação técnica concluída para avançar com o desenvolvimento da Fase 4. A aplicação continua sem aprovação para dados reais até existir revisão manual independente e um processo de backup/recuperação validado.

**Tarefas:**

- Rever derivação de chave, parâmetros versionados, geração aleatória de salt/IV, AES-GCM, dados autenticados associados e validação de payloads. Limitar parâmetros aceites para evitar valores maliciosos ou incompatíveis.
- Validar a palavra-passe de configuração e mudança, comunicar erros sem revelar se a palavra-passe está correta, e confirmar que a chave não é persistida nem incluída em logs/estado serializado.
- Verificar se nomes, contactos, IDs relacionáveis, datas, montantes e metadados aparecem em claro no IndexedDB, índices, mensagens de erro, logs ou backups. Minimizar índices em claro; justificar explicitamente qualquer metadado inevitável.
- Tornar o bloqueio automático configurável e efetivo segundo as definições; bloquear também ao ocultar a página quando ativado; limpar timers e listeners; testar bloqueio manual, inatividade, ciclo de vida da página e bloqueio entre separadores.
- Definir o comportamento de dados `legacy`: avisar sem os expor, permitir uma migração explícita para cifragem com verificação e recuperação em caso de falha; não eliminar nem transformar dados sem consentimento/backup recuperável.
- Rever mudança de palavra-passe e operações interrompidas. A aplicação deve continuar recuperável após falha durante preparação ou ativação, sem mistura de gerações que torne os dados ilegíveis.
- Tratar eliminação/perda de palavra-passe honestamente: não fingir que existe recuperação sem uma chave de recuperação concebida e testada.

**Aceitação bloqueante:** testes demonstram que os payloads persistidos não contêm valores pessoais fictícios em claro; alteração de ciphertext/IV/AAD falha; palavra-passe errada não desbloqueia; bloqueio impede leitura e escrita; as migrações e mudança de palavra-passe toleram falhas simuladas sem perda silenciosa; campos indexados em claro estão eliminados ou documentados e limitados. Revisão manual de segurança continua necessária antes de dados reais. Não alegar conformidade legal.

## Fase 4 — Utentes

**Objetivo:** gerir contactos estritamente administrativos, sem conteúdo clínico.

**Estado:** CRUD administrativo inicial implementado e testado; o histórico de consultas/pagamentos e integrações com dashboard permanecem para fases posteriores.

**Tarefas:** listar, pesquisar, criar, editar, arquivar e reativar; validar nome e contactos; confirmar antes de ações destrutivas; estados vazio, erro e carregamento; consultar histórico apenas por referências administrativas a consultas e pagamentos.

**Aceitação:** operações usam repositórios cifrados e validação de domínio; pesquisa não cria índices persistentes em claro sem decisão de segurança; arquivar não apaga histórico financeiro; validação acessível; testes cobrem CRUD, pesquisa, utentes homónimos, arquivamento/reativação e bloqueio da sessão.

## Fase 5 — Agenda e consultas

**Objetivo:** agendar e acompanhar consultas administrativas.

**Estado:** fluxo básico implementado: criar/editar consultas, alterar estado, associar utente/sala, guardar preço e comissão snapshot, e recusar sobreposição de consultas agendadas. A data/hora é interpretada no fuso local do navegador; o tratamento de Europe/Lisbon e transições DST ainda precisa de validação.

**Tarefas:** vistas diária/semanal com navegação de datas; criar/editar consulta, duração e modalidade presencial/online; associar utente e sala quando aplicável; estados agendada, concluída, cancelada e falta; definir zona horária Europe/Lisbon e regras para hora de verão; detetar sobreposição de consulta do mesmo profissional/sala e permitir resolução explícita.

**Aceitação:** datas e horas persistem sem ambiguidade; conflitos são detetados no domínio, não só na UI; consulta cancelada/falta não se confunde com estado de pagamento; alteração futura das regras de comissão não altera snapshots históricos; testes cobrem limites de horário, sobreposição, modalidade, estado e horário de verão.

## Fase 6 — Salas

**Objetivo:** gerir espaços e disponibilidade sem duplicar regras da agenda.

**Estado:** CRUD simples, ativar/desativar e bloqueio da desativação quando há consultas futuras associadas. Não há vista de ocupação por calendário.

**Tarefas:** criar, editar, ativar/desativar salas; mostrar ocupação calculada das consultas; não permitir desativar/eliminar sem avisar sobre consultas futuras; suportar consultas online sem exigir sala física.

**Aceitação:** disponibilidade resulta das consultas existentes; conflitos com sala são consistentes com a agenda; referências históricas não desaparecem ao desativar sala; formulários e estados vazios têm testes.

## Fase 7 — Pagamentos e comissões

**Objetivo:** registar recebimentos e calcular valores de forma auditável.

**Estado:** pagamentos parciais, métodos predefinidos, estados financeiros derivados e configuração de comissão vigente implementados. Estornos, correções auditáveis e edição de métodos não estão incluídos na prova de conceito.

**Tarefas:** criar métodos de pagamento configuráveis; registar vários pagamentos parciais por consulta, data e montante; mostrar recebido, em falta e estado não pago/parcial/pago/sobrepago; definir tratamento explícito de pagamento excedente e estorno/correção; configurar regras de comissão com vigência; guardar snapshot da divisão em cada consulta; calcular valores em cêntimos sem arredondamento binário.

**Aceitação:** montantes são inteiros em cêntimos e validados; soma de comissões obedece à regra de negócio configurada; nenhuma edição das regras recalcula consultas anteriores; pagamentos ficam ligados à consulta e não alteram o estado da consulta; testes cobrem pagamento parcial, exato, excedente, estorno e arredondamentos.

## Fase 8 — Dashboard e relatórios

**Objetivo:** apresentar indicadores locais derivados de dados válidos, sem criar uma segunda fonte de verdade.

**Estado:** dashboard e totais básicos são calculados dos registos locais; relatório limitado ao mês atual, sem filtros por período ou gráfico.

**Tarefas:** resumir consultas por estado, valores recebidos e pendentes, com filtros por período; distinguir receitas efetivamente recebidas de valores acordados; excluir ou identificar cancelamentos/faltas conforme regras explícitas; usar agregações no domínio; apresentar gráficos acessíveis e alternativa tabular.

**Aceitação:** totais reconciliam com pagamentos e consultas; filtros respeitam datas e zona horária; não há valores de demonstração quando a base está vazia; testes verificam períodos, estados e reconciliação; gráficos não são a única forma de aceder aos dados.

## Fase 9 — Definições e cópias de segurança

**Objetivo:** permitir configuração segura e exportação/importação recuperável do conjunto de dados.

**Estado:** definições básicas e backup v1 cifrado com palavra-passe própria, limite de 20 MB, validação de payloads/referências e substituição transacional implementados. A importação substitui todos os dados e pede confirmação. Ainda falta validação operacional independente e teste em diferentes navegadores.

**Tarefas:** editar duração predefinida, bloqueio automático e opções da prática; implementar formato de backup versionado, cifrado, autenticado e independente do formato interno; validar tamanho, versão, estrutura, referências e integridade antes de importar; restaurar atomicamente, com confirmação explícita, compatibilidade e proteção contra substituir dados por acidente; oferecer exportação sem cifragem apenas se houver requisito explícito e aviso forte, por omissão não.

**Aceitação:** backup não revela payloads pessoais em claro; palavra-passe errada e ficheiro adulterado são rejeitados; ficheiro inválido ou incompatível não altera dados atuais; importação funciona atomicamente e tem testes para falhas, duplicados, versões futuras e versão suportada; documentar que perder a palavra-passe do backup impede a recuperação.

## Fase 10 — Preparação para distribuição

**Objetivo:** verificar comportamento de instalação/execução e criar uma versão distribuível sem alegações de segurança excessivas.

**Tarefas:** validar build e configuração de alojamento pretendida; verificar que recursos e fontes não dependem de terceiros; confirmar que atualização/limpeza do navegador não é apresentada como backup; documentar limitações, suporte e procedimento de cópia de segurança; rever dependências e executar revisão de segurança independente.

**Aceitação:** instalação e rotas funcionam no ambiente pretendido; lint, testes e build passam; não há segredos, analytics nem chamadas de rede com dados pessoais; riscos residuais e procedimento de recuperação estão documentados. Não declarar conformidade com RGPD sem avaliação profissional.

## Regras financeiras transversais

- Todos os valores monetários persistidos são inteiros em cêntimos de EUR.
- A consulta guarda o preço acordado e os snapshots das percentagens de comissão aplicáveis nesse momento.
- O estado da consulta e o estado dos pagamentos são dimensões diferentes.
- Um pagamento não é assumido como liquidação integral; pagamentos parciais são suportados.
- Alterações a regras futuras nunca recalculam registos históricos.
- Regras para reembolsos, sobrepagamentos, cancelamentos e faltas devem ser explícitas e testadas antes de afetarem relatórios.

## Comandos de validação

Executar os comandos existentes no projeto, sem declarar sucesso se não forem executados:

```bash
npm run lint
npm test
npm run build
```

Para cada fase, começar pelo teste mais específico; no fim da fase, executar os três comandos e registar resultados e limitações.