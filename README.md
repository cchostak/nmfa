# NMFA - No Money For AI

A standalone IDE with local LLM integration using Gemma 270M via Ollama.

## Quick Start

1. **Install Ollama**: `curl -fsSL https://ollama.ai/install.sh | sh`
2. **Pull Gemma model**: `ollama pull gemma:2b`
3. **Start Ollama**: `ollama serve` (in another terminal)
4. **Install dependencies**: `npm install`
5. **Start the IDE**: `npm start`

## Features

- **File Operations**: Open and save TypeScript/JavaScript files
- **AI Chat**: Real-time conversation with local Gemma 270M model
- **Agentic Instructions**: Give AI commands like "refactor this code" or "add error handling"
- **AI Code Completion**: Intelligent completions as you type
- **Local AI Processing**: All AI runs locally via Ollama (privacy-focused)

## Demo Instructions

For the 30-minute demo, showcase these core features:

### 1. Start the IDE
```bash
make run
```

### 2. Open a File
- Click "Open File" in the toolbar
- Select a TypeScript or JavaScript file
- The file content loads in the editor

### 3. Chat with AI
- Use the chat panel on the right
- Ask coding questions like "How do I create a React component?"
- The AI responds using local Gemma 270M model

### 4. Agentic Instructions
- Try commands like:
  - "refactor this code"
  - "add error handling"
  - "optimize this function"
  - "fix any bugs"
- The AI analyzes your code and provides suggestions

### 5. Code Completion
- Type code in the editor
- AI completions appear as you type
- Press Tab to accept suggestions

### 6. Save Changes
- Click "Save File" to save your changes
- All operations work with local files

## Prerequisites for Demo

Make sure Ollama is running with Gemma model:
```bash
# Install Ollama if not already installed
# Then run:
ollama pull gemma:2b
ollama serve
```

## Development

1. Install dependencies: `npm install` or `make install`
2. Build: `npm run build` or `make build`
3. Start: `npm start` or `make run`

## Development

- `npm run dev` or `make dev` - Build and start in development mode
- `npm run lint` or `make lint` - Run ESLint
- `npm run format` or `make format` - Format code with clang-format
- `npm test` or `make test` - Run tests
- `npm run smoke-test` or `make smoke-test` - Run smoke tests (build + lint + test)

## Testing

All code must pass tests before shipping. Run `make smoke-test` for comprehensive validation.

## Documentation

Feature documentation and sequence diagrams are available in the `docs/` directory.

## Operations

Use the Makefile for common operations:

- `make all` - Build the project
- `make clean` - Clean build artifacts
- `make ci` - Run full CI pipeline
- `make audit` - Run security audit

## Security

Follows OWASP secure coding practices. All AI processing is local.

## License

MIT