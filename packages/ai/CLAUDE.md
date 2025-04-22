# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- Build: `pnpm build` (increases memory allocation)
- Dev: `pnpm dev` (starts development server)
- Start: `bun .mastra/output/index.mjs` (runs built app)
- TypeCheck: `pnpm typecheck` (checks types without emitting files)
- Knowledge:
  - `pnpm validate-knowledge` (validates knowledge files)
  - `pnpm ingest-knowledge` (ingests knowledge into vector store)
  - `pnpm knowledge` (validates and ingests)

## Guidelines
- TypeScript: Maintain strict typing with no implicit any
- Imports: Use ES modules (import/export)
- Structure: Follow existing organization with knowledge files in appropriate subdirectories
- Naming: Use camelCase for variables/functions, PascalCase for types/classes
- Error handling: Use proper TypeScript error typing and async/await with try/catch
- Knowledge files: Maintain consistent metadata structure in markdown frontmatter
- File types: TypeScript (.ts) for code, Markdown (.md) for knowledge files

This project uses the Mastra framework with PostgreSQL vector storage for managing real estate knowledge.