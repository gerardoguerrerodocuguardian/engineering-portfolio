# Engineering Portfolio — Gerardo Guerrero

[![CI](https://github.com/gerardoguerrerodocuguardian/engineering-portfolio/actions/workflows/ad-bidding-platform.yml/badge.svg)](https://github.com/gerardoguerrerodocuguardian/engineering-portfolio/actions) [![CodeQL](https://github.com/gerardoguerrerodocuguardian/engineering-portfolio/actions/workflows/codeql.yml/badge.svg)](https://github.com/gerardoguerrerodocuguardian/engineering-portfolio/actions/workflows/codeql.yml) ![License](https://img.shields.io/badge/license-MIT-blue)

Software architect and full-stack engineer with **23 years of experience** in Java/Spring Boot, TypeScript (Angular, React/Next.js, NestJS), cloud-native architecture (AWS, GCP, Azure), event-driven systems and LLM/agent integration.

This repository contains small, runnable, tested projects that demonstrate how I design and build software. All of them share **one fictional domain — AdFlow, a sponsored-product ad platform** — so you can see how the pieces fit into a single system. Everything is synthetic: no employer or client code, data or names are included.

Every project README has an **"Experience this project reflects"** section that connects the code to the real-world experience behind it.

## Two tracks

| Track | Focus | Read this if you are hiring for… |
|---|---|---|
| [`track-architect`](track-architect) | Architecture decisions, event-driven systems, AI agents | Software / solutions / full-stack architect |
| [`track-fullstack-dev`](track-fullstack-dev) | Secure APIs, modern front end, testing | Senior Java / full-stack developer |

## Projects

| Project | Stack | Demonstrates |
|---|---|---|
| [01 Reference architecture](track-architect/01-reference-architecture) | C4, Mermaid, ADRs | Quality attributes, trade-offs, decision records |
| [02 Ad bidding platform](track-architect/02-ad-bidding-platform) | Java 21, Spring Boot, Kafka, PostgreSQL | Hexagonal architecture, idempotent consumers, transactional outbox |
| [05 AI agents with Claude](track-architect/05-ai-agents-claude) | TypeScript, Anthropic SDK, MCP | Tool-use agents, RAG, guardrails, evals, cost control |
| [02 Secure Campaign API](track-fullstack-dev/02-nestjs-secure-api) | NestJS, MongoDB, OAuth2/JWT | RBAC, validation, OpenAPI, aggregation, e2e tests |
| [03 Angular NgRx dashboard](track-fullstack-dev/03-angular-ngrx-dashboard) | Angular, NgRx, Signals | State management, accessibility, contract-typed client |
| [03 Learning platform on AWS](track-architect/03-learning-platform-aws) | Terraform, ECS Fargate, CloudFront, RDS, Cognito | IaC modules, HA design, least-privilege security |
| [04 Monolith to microservices](track-architect/04-monolith-to-microservices) | Java 21, strangler fig | Parallel run, anti-corruption layer, data reconciliation, playbook |
| [06 Platform engineering](track-architect/06-platform-engineering) | Helm, Kubernetes, Prometheus, Grafana, OpenTelemetry | Hardened charts, SLOs, DevSecOps pipeline |
| [04 Next.js storefront](track-fullstack-dev/04-nextjs-storefront) | Next.js, React, Zustand | SSG / ISR / SSR strategies, Core Web Vitals |
| [06 BDD and contract tests](track-fullstack-dev/06-bdd-test-suite) | Cucumber, Pact, OpenAPI | BDD, consumer-driven contracts, testing strategy |
| [07 GCP event pipeline](track-architect/07-gcp-event-pipeline) | Pub/Sub, BigQuery, Cloud Run, Java 21 | Swappable adapters, Kafka vs Pub/Sub trade-offs, Terraform on GCP |
| [01 Spring Boot TDD service](track-fullstack-dev/01-spring-boot-tdd-service) | Spring Boot 3, JPA, OAuth2, Resilience4j | TDD log, 97% mutation score, property-based tests |
| [05 Offline-first POS PWA](track-fullstack-dev/05-pos-offline-pwa) | React, IndexedDB, service worker, WebSocket | Outbox sync, idempotency, conflict resolution |
| [07 React design system](track-fullstack-dev/07-react-design-system) | React 19, tokens, Storybook, jest-axe | Accessible components, themes, size budgets |
| [08 Micro-frontends](track-fullstack-dev/08-micro-frontends) | Module Federation, Web Components | Runtime remotes, failure isolation, when NOT to use them |
| [09 React feature architecture](track-fullstack-dev/09-react-feature-architecture) | React, TanStack Query, MSW, zod | Enforced feature boundaries, contract-driven mocks, i18n |
| [10 Angular real-time console](track-fullstack-dev/10-angular-realtime-console) | Angular Signals (zoneless), RxJS, Web Worker | WebSocket/SSE streaming, 100k-row virtual scroll, measured performance |
| [08 Azure platform](track-architect/08-azure-platform) | Bicep, Container Apps, Service Bus, Key Vault, Azure DevOps | Cross-cloud mapping (AWS / GCP / Azure), managed identity, KEDA scaling |
| [11 Kotlin coroutines service](track-fullstack-dev/11-kotlin-coroutines-service) | Kotlin 2, Ktor, coroutines/Flow, Kotest | Scatter/gather auction, sealed results, virtual-time tests |
| [12 React Native app](track-fullstack-dev/12-react-native-app) | Expo, expo-router, TanStack Query | Mobile architecture, optimistic updates, offline cache |

Shared API and event contracts: [`shared/contracts`](shared/contracts) (OpenAPI + AsyncAPI).

## Skill → where to see it

| Skill | Project |
|---|---|
| Java 21, Spring Boot, JPA, Flyway | Ad bidding platform |
| Kafka, event-driven design, idempotency, outbox | Ad bidding platform |
| Architecture decisions & trade-offs | Reference architecture |
| NestJS, OAuth2/JWT, MongoDB | Secure Campaign API |
| Angular, NgRx, Signals, real-time streaming | Angular dashboard, Angular real-time console |
| React architecture, design systems, micro-frontends, PWA | Projects 05, 07, 08, 09 (fullstack track) |
| LLM agents, RAG, MCP, evals | AI agents with Claude |
| Testing (unit, ArchUnit, Testcontainers, e2e, contract) | All |

## How this repo is organised

Each project is self-contained: it has its own README, build tool, tests and CI example. Use the project's `Makefile` (`make run`, `make test`).

## Roadmap

Playwright visual regression for the design system, Lighthouse budgets in CI, a WebAssembly/edge example.

## Verification status

Each project README ends with an honest "not verified" list. CI runs on every push via `.github/workflows` and covers unit/e2e tests, Testcontainers integration tests (Kafka, Postgres, Pub/Sub emulator), a real MongoDB e2e run, Terraform and Bicep validation, Helm/kubeconform and Prometheus rule checks, and CodeQL. The Terraform and platform CI examples stay as `ci.yml.example` because they need cloud credentials and a SonarQube server.

## License

MIT
