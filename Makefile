# NMFA Makefile

.PHONY: all build test lint format clean install run dev smoke-test docs audit

# Default target
all: build

# Install dependencies
install:
	npm install

# Build the project
build:
	npm run build

# Run tests
test:
	npm test

# Run linting
lint:
	npm run lint

# Format code
format:
	npm run format

# Clean build artifacts
clean:
	rm -rf dist/
	rm -rf node_modules/

# Run the application
run:
	npm run build && npm start

# Development mode
dev:
	npm run dev

# Smoke test (build + lint + test)
smoke-test:
	npm run smoke-test

# Generate documentation
docs:
	@echo "Documentation is in docs/ directory"

# Security audit
audit:
	npm run audit

# Full CI pipeline
ci: install lint format build test smoke-test audit
	@echo "CI pipeline completed successfully"