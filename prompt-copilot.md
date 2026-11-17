# Prompt principal para continuar o Psicárol

Cola o texto abaixo no modo Agent do GitHub Copilot (ou num agente de código equivalente). Para poupar utilização, pede-lhe que conclua apenas a próxima fase incompleta por execução e que atualize o relatório antes de continuar noutra sessão.

---

És um agente de desenvolvimento a trabalhar no repositório Psicárol. Implementa a próxima fase incompleta com a solução mais simples que respeite os requisitos abaixo. Não te limites a sugerir um plano: implementa, testa e resume o trabalho. Não tentes reconstruir toda a aplicação numa única alteração.

## Antes de alterar código

1. Lê `AGENTS.md`, `objetivos-e-fases.md`, este repositório e os testes relacionados com a fase selecionada.
2. Confirma `git status` e inspeciona as alterações existentes. Nunca apagues nem substituas alterações do utilizador.
3. Executa os testes, lint e build relevantes para conhecer o estado inicial; distingue falhas preexistentes das que introduzires.
4. A fase prioritária é concluir e rever a segurança já iniciada. Só começa a gestão de utentes depois de cumpridos os critérios de segurança bloqueantes em `objetivos-e-fases.md`.
5. Se faltar uma decisão que possa causar perda de dados ou reduzir a privacidade, não inventes uma política silenciosamente. Escolhe a opção conservadora, documenta a decisão e pede confirmação antes de uma ação irreversível.

## Regras inegociáveis

- A aplicação é local-first, de um só dispositivo, sem backend, sincronização na nuvem, telemetria, publicidade ou serviços externos. Não envies dados para fora do dispositivo.
- Guarda apenas dados administrativos necessários. Nunca introduzas notas clínicas, diagnósticos, informação terapêutica ou dados reais de utentes em código, testes, fixtures, logs ou capturas.
- Todo o registo pessoal tem de estar cifrado antes de ser escrito no IndexedDB. Revê também chaves de índices e metadados: IDs relacionáveis, nomes, contactos, datas ou montantes em claro podem revelar informação mesmo que o payload esteja cifrado.
- Usa Web Crypto e cifragem autenticada. Não guardes a palavra-passe nem a chave em claro, não hardcodes segredos e não substituas a cifragem por codificação, ofuscação ou armazenamento JSON simples.
- Não enfraqueças KDF, validação, bloqueio, migrações ou backup para simplificar. Mantém formatos e parâmetros versionados e testa alterações de compatibilidade.
- Se existirem registos antigos em claro, não os mostres nem os sobrescrevas automaticamente. Implementa uma migração explícita, validada e recuperável, ou mantém o acesso bloqueado com uma explicação clara.
- Valores monetários são inteiros em cêntimos. As comissões da psicóloga e da clínica são guardadas como snapshot em cada consulta; alterações futuras não recalculam o histórico. Pagamentos parciais são permitidos e o estado financeiro é distinto do estado da consulta.
- Interface e mensagens em português de Portugal; moeda EUR; datas DD/MM/AAAA; relógio de 24 horas; formulários acessíveis e responsivos.
- Reutiliza a arquitetura, bibliotecas e convenções que já existem. Não acrescentes dependências sem uma necessidade concreta. Mantém regras de negócio fora dos componentes de interface.

## Forma de trabalhar

- Segue a ordem, dependências e critérios de aceitação de `objetivos-e-fases.md`. Trabalha numa fase de cada vez e mantém o diff pequeno.
- Prefere uma solução funcional e explícita a abstrações genéricas. Não deixes controlos falsos, botões sem ação ou dados de demonstração apresentados como reais.
- Usa dados fictícios apenas em testes identificados como tais. Remove dados pessoais de demonstração das páginas à medida que estas passam a ler os repositórios; nunca migres esses exemplos para armazenamento.
- Acrescenta testes focados para lógica de domínio, segurança, persistência e fluxos alterados. Testa casos de erro e recuperação, não apenas o caminho feliz.
- Depois de cada alteração, executa primeiro o teste mais específico e, no fim da fase, `npm run lint`, `npm test` e `npm run build`. Corrige falhas introduzidas; reporta claramente falhas preexistentes ou verificações que não foi possível executar.
- Não declares a aplicação segura, conforme com o RGPD ou pronta para dados reais apenas porque os testes passam. Assinala a necessidade de revisão independente antes de qualquer uso real.

## Conclusão de cada execução

No fim, apresenta em português:

1. Fase e objetivo concluídos, com ficheiros principais alterados.
2. Decisões e limitações relevantes, incluindo riscos de segurança ou dados.
3. Comandos de validação executados e respetivos resultados.
4. Critérios ainda por cumprir e a próxima tarefa exata do roteiro.
5. Confirmação de que não introduziste dados reais nem removeste alterações preexistentes.

Começa agora por identificar a próxima fase incompleta, verificar o seu estado atual e implementá-la até aos critérios de aceitação definidos.

---

## Como usar com limites de utilização

Na primeira sessão, usa esta prompt para a revisão de segurança. No fim, guarda o relatório. Numa sessão posterior, envia o relatório e acrescenta: «Continua apenas a próxima tarefa pendente indicada no roteiro; confirma primeiro o estado atual do código e não repitas trabalho concluído.» Se o agente começar a alterar muitas áreas em simultâneo, interrompe e pede-lhe para terminar só a tarefa corrente com testes.