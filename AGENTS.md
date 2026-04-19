# AGENTS.md - Rules for AI Agents in NMFA Development

This document outlines the rules and guidelines that AI agents must abide by when implementing code for the NMFA (No Money For AI) project. These rules are derived from established best practices in security, coding style, and application architecture to ensure high-quality, maintainable, and secure software.

## 1. OWASP Secure Coding Practices

Agents must follow OWASP (Open Web Application Security Project) guidelines to prevent common vulnerabilities. Key practices include:

### Input Validation and Handling
- Always validate and sanitize all user inputs to prevent injection attacks (e.g., SQL injection, XSS).
- Use parameterized queries or prepared statements for database interactions.
- Implement proper error handling without exposing sensitive information.

### Authentication and Authorization
- Implement secure authentication mechanisms (e.g., OAuth, JWT) with proper session management.
- Enforce least privilege principles; users should only access resources they need.
- Avoid storing sensitive data like passwords in plain text; use strong hashing (e.g., bcrypt).

### Data Protection
- Encrypt sensitive data at rest and in transit (e.g., use HTTPS, TLS).
- Implement proper access controls for data storage and retrieval.
- Avoid logging sensitive information.

### Secure Dependencies
- Regularly update dependencies to patch known vulnerabilities.
- Use tools like npm audit or Snyk to scan for security issues.
- Avoid using deprecated or insecure libraries.

### General Security
- Follow the principle of defense in depth.
- Implement proper logging and monitoring for security events.
- Conduct regular security reviews and testing (e.g., penetration testing).

## 2. Google JavaScript Style Guide

Agents must adhere to Google's JavaScript Style Guide for consistent, readable code. Key rules include:

### Source File Basics
- Use UTF-8 encoding.
- File names in lowercase with underscores or dashes, extension `.js` or `.ts`.
- Limit lines to 80 characters.

### Formatting
- Use 2 spaces for indentation.
- Use single quotes for strings.
- Place opening braces on the same line as the statement.
- Use trailing commas in array and object literals.

### Language Features
- Use `const` and `let` instead of `var`.
- Prefer arrow functions for anonymous functions.
- Use template literals for string interpolation.
- Avoid `this` outside of class constructors and methods.

### Naming
- `lowerCamelCase` for variables, functions, and methods.
- `UpperCamelCase` for classes, interfaces, and enums.
- `CONSTANT_CASE` for constants.
- Descriptive names; avoid abbreviations.

### JSDoc
- Document all classes, methods, and properties with JSDoc.
- Use proper type annotations.
- Include descriptions for parameters and return values.

### Policies
- Be consistent with existing code.
- Use tools like clang-format for formatting.
- Suppress compiler warnings only when necessary with proper justification.

## 3. 12-Factor App Manifesto

Agents must design the application following the 12-factor app principles for scalability, maintainability, and portability. Adapted for a VS Code extension:

### I. Codebase
- Maintain one codebase tracked in version control (e.g., Git).
- Use branches for different environments, but deploy from the same codebase.

### II. Dependencies
- Explicitly declare all dependencies in `package.json`.
- Isolate dependencies using npm or yarn; avoid global installations.

### III. Config
- Store configuration in environment variables.
- Never hardcode secrets or environment-specific settings in code.
- Use `.env` files for local development, but exclude from version control.

### IV. Backing Services
- Treat external services (e.g., Ollama API, databases) as attached resources.
- Configure connections via environment variables.
- Ensure the app can switch between different service providers without code changes.

### V. Build, Release, Run
- Strictly separate build, release, and run stages.
- Use build tools like webpack or esbuild for compilation.
- Tag releases and deploy immutable artifacts.

### VI. Processes
- Execute the app as stateless processes.
- Store state in backing services, not in the application process.
- Ensure horizontal scalability.

### VII. Port Binding
- Export services by binding to ports (though for VS Code extension, this applies to any servers).
- For local LLM servers, bind to configurable ports.

### VIII. Concurrency
- Scale out via the process model.
- Design components to run multiple instances concurrently.

### IX. Disposability
- Maximize robustness with fast startup and graceful shutdown.
- Handle signals properly for clean termination.

### X. Dev/Prod Parity
- Keep development, staging, and production environments as similar as possible.
- Use containerization (e.g., Docker) for consistency.

### XI. Logs
- Treat logs as event streams.
- Write logs to stdout/stderr; let the execution environment handle aggregation.
- Use structured logging with appropriate levels.

### XII. Admin Processes
- Run admin/management tasks as one-off processes.
- Separate maintenance scripts from the main application code.

## Agent Implementation Guidelines

When implementing code, agents must:

1. **Prioritize Security**: Always consider security implications in design and implementation.
2. **Maintain Consistency**: Follow the established style guide and patterns in the codebase.
3. **Ensure Scalability**: Design for growth, following 12-factor principles.
4. **Document Thoroughly**: Provide clear JSDoc and comments for all code. Ensure all features have comprehensive documentation and sequence diagrams.
5. **Test Rigorously**: Write unit tests, integration tests, and security tests for all code. Implement smoke tests for critical features. No code shall be shipped without passing all tests and reviews.
6. **Review and Iterate**: Be open to feedback and iterate based on reviews.

Agents should reference this document for any decisions and seek clarification if guidelines conflict or are unclear.