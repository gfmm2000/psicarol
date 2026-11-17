# Psicárol

Prova de conceito local-first para gestão administrativa e financeira de uma prática de psicologia. Não guarda notas clínicas, diagnósticos ou registos de terapia.

## Executar

Requisitos: Node.js e npm.

```bash
npm install
npm run dev
```

Verificações:

```bash
npm run lint
npm test
npm run build
```

## Documentação

- [AGENTS.md](AGENTS.md): regras de arquitetura, privacidade e negócio.
- [prompt-copilot.md](prompt-copilot.md): prompt para continuar o desenvolvimento com um agente.
- [objetivos-e-fases.md](objetivos-e-fases.md): estado, limitações e critérios das fases.

A prova de conceito já inclui gestão básica de utentes, consultas, salas, pagamentos, relatórios e definições, com IndexedDB e registos cifrados. Não usar dados reais: a revisão independente de segurança e a validação operacional do backup ainda estão pendentes.
