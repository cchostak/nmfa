import { OllamaService } from '../ollama';

/**
 * Unit tests for OllamaService.
 */
describe('OllamaService', () => {
  let service: OllamaService;

  beforeEach(() => {
    service = new OllamaService();
  });

  test('should initialize with default URL', () => {
    expect(service).toBeDefined();
  });

  test('should handle generate method gracefully when Ollama is not available',
    async () => {
      const response = await service.generate('test prompt');
      expect(response).toContain('Error');
    });

  test('should handle chat method gracefully when Ollama is not available',
    async () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const response = await service.chat(messages);
      expect(response).toContain('Error');
    });
});