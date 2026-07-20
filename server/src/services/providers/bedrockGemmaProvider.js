import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import awsConfig from '../../config/aws.js';
import { createHttpError } from '../../utils/httpErrors.js';

const MAX_OCR_LINES = 100;
const MAX_MENU_ITEMS = 500;
const MAX_NAME_LENGTH = 200;
const MAX_RESPONSE_CHARS = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createClient() {
  return new BedrockRuntimeClient({
    region: awsConfig.region,
    ...(awsConfig.credentials ? { credentials: awsConfig.credentials } : {}),
    ...(awsConfig.endpointUrl ? { endpoint: awsConfig.endpointUrl } : {}),
  });
}

let bedrockClient = createClient();

export function setBedrockGemmaClientForTests(client) {
  bedrockClient = client;
}

export function resetBedrockGemmaClientForTests() {
  bedrockClient = createClient();
}

function normalizedName(value, field) {
  if (typeof value !== 'string') {
    throw createHttpError(422, 'VALIDATION_ERROR', `${field} must be a string.`);
  }
  const name = value.trim();
  if (!name || name.length > MAX_NAME_LENGTH) {
    throw createHttpError(
      422,
      'VALIDATION_ERROR',
      `${field} must contain 1 to ${MAX_NAME_LENGTH} characters.`,
    );
  }
  return name;
}

function buildPayload({ lines, menuItems }) {
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > MAX_OCR_LINES) {
    throw createHttpError(422, 'VALIDATION_ERROR', `OCR lines must contain 1 to ${MAX_OCR_LINES} items.`);
  }
  if (!Array.isArray(menuItems) || menuItems.length === 0 || menuItems.length > MAX_MENU_ITEMS) {
    throw createHttpError(422, 'VALIDATION_ERROR', `Branch menu must contain 1 to ${MAX_MENU_ITEMS} items.`);
  }

  return {
    lines: lines.map((line, lineIndex) => ({
      lineIndex,
      name: normalizedName(line?.name, `lines[${lineIndex}].name`),
    })),
    menuItems: menuItems.map((item, index) => {
      if (typeof item?.id !== 'string' || !UUID_RE.test(item.id)) {
        throw createHttpError(422, 'VALIDATION_ERROR', `menuItems[${index}].id must be a valid UUID.`);
      }
      return {
        menuItemId: item.id,
        name: normalizedName(item.name, `menuItems[${index}].name`),
      };
    }),
  };
}

export function validateBedrockMappings(text, { lineCount, allowedMenuItemIds }) {
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_RESPONSE_CHARS) {
    throw createHttpError(503, 'BILL_SCAN_PROVIDER_FAILED', 'Bill scan name mapping failed.');
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw createHttpError(503, 'BILL_SCAN_PROVIDER_FAILED', 'Bill scan name mapping failed.');
  }

  if (
    !parsed
    || Array.isArray(parsed)
    || Object.keys(parsed).length !== 1
    || !Array.isArray(parsed.mappings)
    || parsed.mappings.length !== lineCount
  ) {
    throw createHttpError(503, 'BILL_SCAN_PROVIDER_FAILED', 'Bill scan name mapping failed.');
  }

  const seen = new Set();
  const mappings = parsed.mappings.map((mapping) => {
    if (
      !mapping
      || Array.isArray(mapping)
      || Object.keys(mapping).length !== 3
      || !Object.hasOwn(mapping, 'lineIndex')
      || !Object.hasOwn(mapping, 'menuItemId')
      || !Object.hasOwn(mapping, 'confidence')
      || !Number.isInteger(mapping.lineIndex)
      || mapping.lineIndex < 0
      || mapping.lineIndex >= lineCount
      || seen.has(mapping.lineIndex)
      || (mapping.menuItemId !== null
        && (typeof mapping.menuItemId !== 'string'
          || !allowedMenuItemIds.has(mapping.menuItemId)))
      || typeof mapping.confidence !== 'number'
      || !Number.isFinite(mapping.confidence)
      || mapping.confidence < 0
      || mapping.confidence > 1
    ) {
      throw createHttpError(503, 'BILL_SCAN_PROVIDER_FAILED', 'Bill scan name mapping failed.');
    }
    seen.add(mapping.lineIndex);
    return {
      lineIndex: mapping.lineIndex,
      menuItemId: mapping.menuItemId,
      confidence: mapping.confidence,
    };
  });

  return mappings.sort((a, b) => a.lineIndex - b.lineIndex);
}

export class BedrockGemmaProvider {
  constructor({
    client = null,
    modelId = awsConfig.bedrock.modelId,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {}) {
    this.client = client;
    this.modelId = modelId;
    this.timeoutMs = timeoutMs;
  }

  async mapNames({ lines, menuItems }) {
    if (!this.modelId) {
      throw createHttpError(503, 'PROVIDER_UNAVAILABLE', 'Bill scan name mapping is not configured.');
    }

    const payload = buildPayload({ lines, menuItems });
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.timeoutMs);

    try {
      const response = await (this.client ?? bedrockClient).send(
        new ConverseCommand({
          modelId: this.modelId,
          system: [{
            text: [
              'Map each OCR item name to at most one menu item ID.',
              'Return strict JSON only: {"mappings":[{"lineIndex":0,"menuItemId":null,"confidence":0.0}]}.',
              'Include every input line index exactly once. Do not calculate or judge prices.',
            ].join(' '),
          }],
          messages: [{
            role: 'user',
            content: [{ text: JSON.stringify(payload) }],
          }],
          inferenceConfig: {
            maxTokens: 2048,
            temperature: 0,
          },
        }),
        { abortSignal: abortController.signal },
      );
      const text = response?.output?.message?.content
        ?.filter((part) => typeof part?.text === 'string')
        .map((part) => part.text)
        .join('');
      return validateBedrockMappings(text, {
        lineCount: payload.lines.length,
        allowedMenuItemIds: new Set(payload.menuItems.map((item) => item.menuItemId)),
      });
    } catch (error) {
      if (error?.code === 'BILL_SCAN_PROVIDER_FAILED' || error?.code === 'PROVIDER_UNAVAILABLE') {
        throw error;
      }
      throw createHttpError(503, 'BILL_SCAN_PROVIDER_FAILED', 'Bill scan name mapping failed.');
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const bedrockGemmaProvider = new BedrockGemmaProvider();
