import { describe, expect, it, vi } from 'vitest';
import {
  BedrockGemmaProvider,
  validateBedrockMappings,
} from '../../../src/services/providers/bedrockGemmaProvider.js';

const menuId = '00000000-0000-4000-8000-000000000001';

describe('BedrockGemmaProvider', () => {
  it('sends names without prices and returns validated mappings', async () => {
    const send = vi.fn(async (command) => {
      const payload = JSON.parse(command.input.messages[0].content[0].text);
      expect(payload).toEqual({
        lines: [{ lineIndex: 0, name: 'Pho bo' }],
        menuItems: [{ menuItemId: menuId, name: 'Phở bò' }],
      });
      expect(JSON.stringify(payload)).not.toContain('50000');
      return {
        output: {
          message: {
            content: [{
              text: JSON.stringify({
                mappings: [{
                  lineIndex: 0,
                  menuItemId: menuId,
                  confidence: 0.98,
                }],
              }),
            }],
          },
        },
      };
    });
    const provider = new BedrockGemmaProvider({
      client: { send },
      modelId: 'google.gemma-test',
      timeoutMs: 1000,
    });

    await expect(provider.mapNames({
      lines: [{ name: 'Pho bo', unitPrice: 50_000 }],
      menuItems: [{ id: menuId, name: 'Phở bò', price: 50_000 }],
    })).resolves.toEqual([{
      lineIndex: 0,
      menuItemId: menuId,
      confidence: 0.98,
    }]);
  });

  it('fails closed without a configured model ID', async () => {
    const provider = new BedrockGemmaProvider({
      client: { send: vi.fn() },
      modelId: '',
    });
    await expect(provider.mapNames({
      lines: [{ name: 'Pho bo' }],
      menuItems: [{ id: menuId, name: 'Phở bò' }],
    })).rejects.toMatchObject({
      statusCode: 503,
      code: 'PROVIDER_UNAVAILABLE',
    });
  });

  it('normalizes provider timeouts without leaking raw errors', async () => {
    const client = {
      send: vi.fn((_command, options) => new Promise((resolve, reject) => {
        options.abortSignal.addEventListener('abort', () => {
          reject(new Error('socket credential timeout detail'));
        }, { once: true });
      })),
    };
    const provider = new BedrockGemmaProvider({
      client,
      modelId: 'google.gemma-test',
      timeoutMs: 1,
    });

    await expect(provider.mapNames({
      lines: [{ name: 'Pho bo' }],
      menuItems: [{ id: menuId, name: 'Phở bò' }],
    })).rejects.toMatchObject({
      statusCode: 503,
      code: 'BILL_SCAN_PROVIDER_FAILED',
      message: 'Bill scan name mapping failed.',
    });
  });

  it('rejects malformed, duplicate, unknown, or incomplete mappings', () => {
    const options = {
      lineCount: 2,
      allowedMenuItemIds: new Set([menuId]),
    };
    const invalidResponses = [
      '```json\n{"mappings":[]}\n```',
      JSON.stringify({ mappings: [{ lineIndex: 0, menuItemId: menuId, confidence: 1 }] }),
      JSON.stringify({
        mappings: [
          { lineIndex: 0, menuItemId: menuId, confidence: 1 },
          { lineIndex: 0, menuItemId: null, confidence: 0 },
        ],
      }),
      JSON.stringify({
        mappings: [
          { lineIndex: 0, menuItemId: '00000000-0000-4000-8000-000000000099', confidence: 1 },
          { lineIndex: 1, menuItemId: null, confidence: 0 },
        ],
      }),
    ];

    for (const response of invalidResponses) {
      expect(() => validateBedrockMappings(response, options)).toThrowError(
        expect.objectContaining({ code: 'BILL_SCAN_PROVIDER_FAILED' }),
      );
    }
  });
});
