// OCR provider selection — mirrors the identity-provider selection pattern.
// The mock is permitted only in test/development; selecting it elsewhere is a
// hard configuration error (fail closed).

import { getOcrConfig } from '../../config/ocr.js';
import { textractOcrProvider } from './textractProvider.js';
import { mockOcrProvider } from './__mocks__/mockOcrProvider.js';

const LOCAL_ENVS = new Set(['test', 'development']);

export function getOcrProvider({ provider } = {}) {
  const selected = provider || getOcrConfig().provider;

  if (selected === 'mock') {
    if (!LOCAL_ENVS.has(process.env.NODE_ENV)) {
      throw new Error(
        `OCR_PROVIDER='mock' is not allowed in NODE_ENV='${process.env.NODE_ENV}'.`,
      );
    }
    return mockOcrProvider;
  }

  if (selected === 'textract') {
    return textractOcrProvider;
  }

  throw new Error(`Unsupported OCR provider: '${selected}'`);
}
