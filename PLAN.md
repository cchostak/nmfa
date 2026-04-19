## Plan: NMFA - AI Code Editor with Local Small Models

TL;DR: Build a standalone IDE that uses agentic workflows (RAG, caching, prompt engineering) with local Gemma 270M via Ollama to provide Cursor-like features: AI chat, inline completion, multi-file editing, and terminal integration. Focus on blazing-fast performance across systems using optimized inference and traditional software patterns, adhering to OWASP security practices, Google JavaScript Style Guide, and 12-Factor App principles.

**Steps**
1. Set up standalone IDE project structure with Electron, Monaco Editor, TypeScript, and necessary dependencies (parallel with step 2), ensuring dependencies are explicitly declared in package.json and isolated.
2. Integrate Ollama for Gemma 270M model serving and API wrapper, treating it as a backing service configured via environment variables.
3. Implement agentic workflow system: context identification, data retrieval (RAG), summarization, iteration, and generation, with secure input validation and error handling.
4. Build AI chat panel with streaming responses and file/symbol references, implementing proper authentication and data protection.
5. Implement inline code completion with debouncing and context-aware suggestions, following Google style guide for naming and formatting.
6. Add multi-file editing capabilities (composer-like feature) using agent workflows, ensuring stateless processes and disposability.
7. Integrate terminal commands and execution with AI assistance, with secure dependency management and regular updates.
8. Optimize for performance: caching, quantization, GPU detection, and cross-platform compatibility, maintaining dev/prod parity.
9. Add settings UI for model parameters, temperature, and workflow configurations, storing config in environment variables.
10. Implement logging as event streams and admin processes as one-off tasks.
11. Conduct security reviews, style checks with clang-format, and ensure 12-factor compliance throughout.
12. Testing and validation: unit tests, integration tests, security testing, and performance benchmarks, with thorough JSDoc documentation.

**Relevant files**
- [package.json](package.json) — Extension manifest and dependencies, explicitly declared.
- [src/extension.ts](src/extension.ts) — Main extension entry point, with JSDoc and secure coding.
- [src/ollama.ts](src/ollama.ts) — Ollama API integration, as a backing service.
- [src/agent.ts](src/agent.ts) — Agentic workflow engine (RAG, caching, prompt engineering), with input validation.
- [src/chat.ts](src/chat.ts) — Chat panel implementation, with data protection.
- [src/completion.ts](src/completion.ts) — Inline completion provider, following style guide.
- [src/composer.ts](src/composer.ts) — Multi-file editing logic, stateless.
- [src/terminal.ts](src/terminal.ts) — Terminal integration, secure.
- [src/settings.ts](src/settings.ts) — Configuration management via env vars.
- [src/logs.ts](src/logs.ts) — Event stream logging.
- [src/admin.ts](src/admin.ts) — One-off admin processes.

**Verification**
1. Install the standalone IDE app and verify Ollama setup automation, with secure dependency checks.
2. Test chat: Ask questions, reference files/symbols, get accurate responses, ensuring no sensitive data exposure.
3. Test completion: Type code, receive relevant inline suggestions within 2s, with proper error handling.
4. Test composer: Request multi-file changes, verify agent applies edits correctly, statelessly.
5. Performance: Measure latency (<2s for completion, <3s for chat first token), memory usage (<4GB), with fast startup/shutdown.
6. Cross-platform: Test on Linux, Windows, macOS, maintaining parity.
7. Security: Run OWASP checks, ensure encryption and access controls.
8. Style: Verify Google JS style compliance, JSDoc completeness.
9. 12-Factor: Confirm config in env, dependencies isolated, logs as streams.

**Decisions**
- Use Electron and Monaco Editor as base for standalone IDE (open source, extensible), following 12-factor codebase principle.
- Ollama for local inference (handles Gemma 270M, quantization, API), as a backing service.
- Agentic workflows to bridge small model limitations: RAG for code retrieval, caching for repeated queries, prompt engineering for better outputs, with security prioritization.
- TypeScript for code, with potential Rust bindings for performance-critical parts if needed, adhering to Google style.
- Focus on traditional patterns: modular architecture, LSP integration, event-driven design, with OWASP security and 12-factor scalability.
- Prioritize security, consistency, scalability, documentation, and testing as per agent guidelines.

**Further Considerations**
1. Model selection: Start with Gemma 270M, but allow switching to larger if user upgrades hardware, with secure updates.
2. Privacy: Ensure all processing is local, no data sent externally, encrypt sensitive data.
3. Extensibility: Design agent system to be pluggable for future enhancements, maintaining disposability.
4. Security: Implement defense in depth, regular vulnerability scans, secure dependencies.
5. Style: Use clang-format, consistent naming, JSDoc for all code.
6. 12-Factor: Stateless processes, port binding for services, dev/prod parity with containerization.
