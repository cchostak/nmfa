import { AgentEngine } from '../agent';

/**
 * Unit tests for agent tool-call parsing.
 */
describe('AgentEngine', () => {
  let engine: AgentEngine;

  beforeEach(() => {
    engine = new AgentEngine();
  });

  test('should parse canonical tool calls', () => {
    const step = engine.parseStep(
      '{"thought":"inspect","action":"list_files","args":{"path":"."}}',
    );

    expect(step).toEqual({
      thought: 'inspect',
      action: 'list_files',
      args: { path: '.' },
    });
  });

  test('should recover from tool field aliases', () => {
    const step = engine.parseStep(
      '{"thought":"find chat","tool":"rg","query":"chat messages"}',
    );

    expect(step).toEqual({
      thought: 'find chat',
      action: 'search_files',
      args: { query: 'chat messages' },
    });
  });

  test('should ignore literal tool_name placeholders', () => {
    const step = engine.parseStep(
      '{"action":"tool_name","tool":"read","path":"src/main.ts"}',
    );

    expect(step).toEqual({
      thought: '',
      action: 'read_file',
      args: { path: 'src/main.ts' },
    });
  });

  test('should reject unavailable external tools', () => {
    const step = engine.parseStep('{"tool":"graphviz","args":["-O"]}');

    expect(step).toBeNull();
  });
});
