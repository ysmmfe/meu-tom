# Meu Tom — instruções para manutenção

- Leia `docs/progress.md`, `docs/architecture.md` e `docs/music-engine.md` antes de alterar o núcleo.
- Node 22.14+, npm, PostgreSQL 17. `npm ci`; `docker compose up -d db`; `npm run db:migrate`; `npm run db:seed`; `npm run dev`.
- Valide: `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`. Integração usa PostgreSQL real e catálogo de demonstração, nunca banco de produção.
- Browser: `npx playwright install --with-deps chromium`. Produção E2E: pare dev, faça build, use `E2E_PRODUCTION=true npm run test:e2e`.
- Motor puro em `lib/music/`, independente do framework; nunca simplifique acordes para forçar compatibilidade. Inclua testes de identidade completa, baixo, extensões e todas as classes de altura.
- Tom efetivo inclui capotraste; formas e notas produzidas não são a mesma coisa. Preserve todas as letras/âncoras ao transpor documentos estruturados.
- Catálogo persiste no PostgreSQL via Drizzle; UI não importa os JSONs do seed. Apenas versão canônica disponível pode usar o resumo da música.
- Índice offline em `indexed_songs/indexed_variants` é separado dos documentos: preserve `availability: index-only`, ausência de `document`, `preservesKey: null` e aviso de capo/tom desconhecidos. Nunca gere letras/âncoras ou uma cifra fictícia a partir de conjuntos. Leia `docs/offline-catalog.md`; não redistribua o corpus ou trate a licença do código como licença das obras.
- E2E com corpus real: `E2E_REAL_INDEX=true E2E_PRODUCTION=true npm run test:e2e`. Sem corpus, use `scripts/seed-index-test.ts` somente no banco de teste (fixtures autorais CC0). `E2E_PORT` permite isolamento de servidor/banco.
- Ingestão em `server/services/ingest.ts`; provedores isolados em `server/providers/`. Registre licença e permissão. APIs externas nunca devem bloquear a operação local. Não contorne 403, CAPTCHA ou autenticação.
- Administração: token secreto de ao menos 24 caracteres; nunca prefixo NEXT_PUBLIC. Não exponha importação arbitrária.
- Conteúdo demo CC0; software em LICENSE; Unslop CC BY 4.0 com crédito obrigatório a Damir Sokolovsky. Não misture licenças de extrator com direitos de letras.
- Design próximo à organização Greifbar, não landing promocional. CSS com tokens, foco, contraste e controles por toque. Consulte `.agents/skills/unslop/SKILL.md` para refinamentos autorizados.
- Screenshots: `npx tsx scripts/visual-audit.ts`, com app ativo. Verifique 1440/1280/768/390/320 e não declare validação que não executou.
- Migrações aplicadas são imutáveis; acrescente um arquivo `NNNN_nome.sql`; o runner ordena e verifica checksums automaticamente. Seed deve continuar idempotente.
- Atualize o progresso com comandos, resultados e bloqueios reais. CI configurada não significa CI remota executada.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
