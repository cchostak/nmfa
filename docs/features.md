# NMFA Features Documentation

## AI Chat

Provides an interactive chat interface for coding assistance.

### Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant ChatPanel
    participant AgentEngine
    participant OllamaService

    User->>ChatPanel: Send message
    ChatPanel->>AgentEngine: Process query
    AgentEngine->>AgentEngine: Identify context
    AgentEngine->>AgentEngine: Retrieve data (RAG)
    AgentEngine->>OllamaService: Generate response
    OllamaService-->>AgentEngine: Streaming response
    AgentEngine-->>ChatPanel: Formatted response
    ChatPanel-->>User: Display response
```

## Inline Code Completion

Offers real-time code suggestions as the user types.

### Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant Editor
    participant CompletionProvider
    participant AgentEngine
    participant OllamaService

    User->>Editor: Type code
    Editor->>CompletionProvider: Request suggestions
    CompletionProvider->>AgentEngine: Analyze context
    AgentEngine->>OllamaService: Generate completions
    OllamaService-->>AgentEngine: Completion suggestions
    AgentEngine-->>CompletionProvider: Filtered suggestions
    CompletionProvider-->>Editor: Display suggestions
    Editor-->>User: Show completions
```

## Multi-File Editing (Composer)

Allows AI-assisted editing across multiple files.

### Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant Composer
    participant AgentEngine
    participant FileSystem

    User->>Composer: Request multi-file change
    Composer->>AgentEngine: Plan changes
    AgentEngine->>AgentEngine: Analyze dependencies
    AgentEngine->>FileSystem: Read files
    FileSystem-->>AgentEngine: File contents
    AgentEngine->>AgentEngine: Generate edits
    AgentEngine-->>Composer: Edit plan
    Composer->>FileSystem: Apply changes
    FileSystem-->>Composer: Confirmation
    Composer-->>User: Changes applied
```

## Terminal Integration

Integrates AI assistance with terminal commands.

### Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant TerminalIntegration
    participant AgentEngine
    participant SystemTerminal

    User->>TerminalIntegration: Request command
    TerminalIntegration->>AgentEngine: Suggest command
    AgentEngine-->>TerminalIntegration: Command suggestion
    TerminalIntegration-->>User: Show suggestion
    User->>TerminalIntegration: Execute command
    TerminalIntegration->>SystemTerminal: Run command
    SystemTerminal-->>TerminalIntegration: Output
    TerminalIntegration-->>User: Display output
```

## Settings Management

Handles configuration via environment variables.

### Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant SettingsUI
    participant SettingsManager
    participant EnvVars

    User->>SettingsUI: Change setting
    SettingsUI->>SettingsManager: Update config
    SettingsManager->>EnvVars: Write to .env
    EnvVars-->>SettingsManager: Confirmation
    SettingsManager-->>SettingsUI: Update applied
    SettingsUI-->>User: Confirmation
```

## Logging

Implements event stream logging.

### Sequence Diagram

```mermaid
sequenceDiagram
    participant Component
    participant Logger
    participant LogStream

    Component->>Logger: Log event
    Logger->>Logger: Format log
    Logger->>LogStream: Write to stream
    LogStream-->>Logger: Acknowledgment
```

## Admin Processes

Runs administrative tasks as one-off processes.

### Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant AdminProcesses
    participant System

    User->>AdminProcesses: Trigger admin task
    AdminProcesses->>System: Spawn process
    System-->>AdminProcesses: Process started
    AdminProcesses->>System: Execute task
    System-->>AdminProcesses: Task completed
    AdminProcesses-->>User: Result
```