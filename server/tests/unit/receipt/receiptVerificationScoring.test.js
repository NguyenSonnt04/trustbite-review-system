import { describe, expect, it } from 'vitest';

import {
  haversineMeters,
  normalizeMerchantName,
  levenshteinSimilarity,
  computeTransactionHash,
  scoreReceipt,
  decideFromScore,
} from '../../../src/services/receiptVerificationScoring.js';
import { getFraudRules } from '../../../src/config/fraudRules.js';

const RULES = getFraudRules();

// A signals object that scores to exactly 0 (all "clean" buckets). Individual
// tests override one field at a time to isolate each scoring-table row.
function cleanSignals(overrides = {}) {
  return {
    gpsProvided: true,
    gpsDistanceMeters: 50, // <= 200m
    gpsAccuracyMeters: 20, // <= 100m
    submittedNear: true,
    merchantSimilarity: 95, // 80-100
    receiptAgeHours: 2, // <= 48h
    duplicateFileHash: false,
    duplicateTransactionHash: false,
    editedMetadata: false,
    newAccountFirstReview: false,
    manyRejectedReceipts: false,
    multiAccountSameDevice: false,
    ...overrides,
  };
}

function pointsFor(overrides) {
  return scoreReceipt(cleanSignals(overrides), RULES).score;
}

describe('haversineMeters', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineMeters(10.7769, 106.7009, 10.7769, 106.7009)).toBe(0);
  });

  it('is symmetric', () => {
    const a = haversineMeters(10.0, 106.0, 10.5, 106.5);
    const b = haversineMeters(10.5, 106.5, 10.0, 106.0);
    expect(Math.abs(a - b)).toBeLessThan(1e-6);
  });

  it('matches a known distance within tolerance', () => {
    // ~1 degree of latitude ≈ 111.19 km at the equator.
    const d = haversineMeters(0, 0, 1, 0);
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });

  it('computes a short intra-city distance', () => {
    // Two points ~1.5km apart in HCMC.
    const d = haversineMeters(10.7769, 106.7009, 10.7900, 106.7009);
    expect(d).toBeGreaterThan(1300);
    expect(d).toBeLessThan(1600);
  });
});

describe('normalizeMerchantName', () => {
  it('lowercases and strips Vietnamese diacritics', () => {
    expect(normalizeMerchantName('Phở Bắc Hải')).toBe('pho bac hai');
  });

  it('removes common business suffixes', () => {
    expect(normalizeMerchantName('Highlands Coffee Co., Ltd')).toBe('highlands coffee');
    expect(normalizeMerchantName('Pho 24 Chi Nhánh')).toBe('pho 24');
    expect(normalizeMerchantName('The Coffee House CN')).toBe('the coffee house');
  });

  it('drops punctuation and collapses whitespace', () => {
    expect(normalizeMerchantName('  Quán  Ăn -- Ngon!! ')).toBe('quan an ngon');
  });

  it('returns empty string for null/empty input', () => {
    expect(normalizeMerchantName(null)).toBe('');
    expect(normalizeMerchantName('')).toBe('');
  });
});

describe('levenshteinSimilarity', () => {
  it('returns 100 for identical strings', () => {
    expect(levenshteinSimilarity('highlands coffee', 'highlands coffee')).toBe(100);
  });

  it('returns 100 when both strings are empty', () => {
    expect(levenshteinSimilarity('', '')).toBe(100);
  });

  it('returns 0 when exactly one string is empty', () => {
    expect(levenshteinSimilarity('', 'abc')).toBe(0);
    expect(levenshteinSimilarity('abc', '')).toBe(0);
  });

  it('scores a one-character difference high', () => {
    // 1 edit over length 4 => 75%.
    expect(levenshteinSimilarity('phoo', 'phop')).toBe(75);
  });

  it('scores an unrelated pair low', () => {
    expect(levenshteinSimilarity('abcdef', 'zzzzzz')).toBeLessThan(60);
  });
});

describe('computeTransactionHash', () => {
  const base = {
    name: 'Highlands Coffee',
    datetimeISO: '2026-06-10T08:30:00.000Z',
    invoiceNo: 'INV-001',
    totalAmount: 120000,
  };

  it('is deterministic for identical inputs', () => {
    expect(computeTransactionHash(base)).toBe(computeTransactionHash({ ...base }));
  });

  it('is stable across name casing/spacing via normalization', () => {
    const a = computeTransactionHash(base);
    const b = computeTransactionHash({ ...base, name: '  highlands   COFFEE ' });
    expect(a).toBe(b);
  });

  it('changes when any field differs', () => {
    const a = computeTransactionHash(base);
    expect(computeTransactionHash({ ...base, invoiceNo: 'INV-002' })).not.toBe(a);
    expect(computeTransactionHash({ ...base, totalAmount: 120001 })).not.toBe(a);
    expect(computeTransactionHash({ ...base, datetimeISO: '2026-06-10T08:31:00.000Z' })).not.toBe(a);
  });

  it('returns a 64-char hex sha256 digest', () => {
    expect(computeTransactionHash(base)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('scoreReceipt — Anti-Fraud §4.1 signal rows', () => {
  it('clean signals score 0', () => {
    expect(pointsFor({})).toBe(0);
  });

  // GPS rows
  it('GPS within 200m adds 0', () => {
    expect(pointsFor({ gpsDistanceMeters: 200 })).toBe(0);
  });

  it('GPS >200m submitted near (<=1h) adds 40', () => {
    expect(pointsFor({ gpsDistanceMeters: 201, submittedNear: true })).toBe(40);
  });

  it('GPS >200m submitted late (>1h) adds 10', () => {
    expect(pointsFor({ gpsDistanceMeters: 201, submittedNear: false })).toBe(10);
  });

  it('GPS not provided adds 30', () => {
    expect(pointsFor({ gpsProvided: false, gpsDistanceMeters: null, gpsAccuracyMeters: null })).toBe(30);
  });

  it('GPS accuracy >100m adds 15', () => {
    expect(pointsFor({ gpsAccuracyMeters: 150 })).toBe(15);
  });

  it('GPS accuracy >100m stacks with >200m distance', () => {
    expect(pointsFor({ gpsDistanceMeters: 500, submittedNear: true, gpsAccuracyMeters: 150 })).toBe(55);
  });

  // Merchant rows
  it('merchant similarity 80-100 adds 0', () => {
    expect(pointsFor({ merchantSimilarity: 80 })).toBe(0);
  });

  it('merchant similarity 60-79 adds 25', () => {
    expect(pointsFor({ merchantSimilarity: 79 })).toBe(25);
    expect(pointsFor({ merchantSimilarity: 60 })).toBe(25);
  });

  it('merchant similarity <60 adds 60', () => {
    expect(pointsFor({ merchantSimilarity: 59 })).toBe(60);
  });

  it('merchant name unreadable adds 50', () => {
    expect(pointsFor({ merchantSimilarity: null })).toBe(50);
  });

  // Timestamp rows
  it('receipt within 48h adds 0', () => {
    expect(pointsFor({ receiptAgeHours: 48 })).toBe(0);
  });

  it('receipt 49-168h adds 40', () => {
    expect(pointsFor({ receiptAgeHours: 49 })).toBe(40);
    expect(pointsFor({ receiptAgeHours: 168 })).toBe(40);
  });

  it('receipt >168h adds 70', () => {
    expect(pointsFor({ receiptAgeHours: 169 })).toBe(70);
  });

  it('receipt time unreadable adds 30', () => {
    expect(pointsFor({ receiptAgeHours: null })).toBe(30);
  });

  // Hard signals
  it('duplicate file hash adds 100', () => {
    expect(pointsFor({ duplicateFileHash: true })).toBe(100);
  });

  it('duplicate transaction hash adds 100', () => {
    expect(pointsFor({ duplicateTransactionHash: true })).toBe(100);
  });

  // Soft signals
  it('edited metadata adds 50', () => {
    expect(pointsFor({ editedMetadata: true })).toBe(50);
  });

  it('new account first review adds 15', () => {
    expect(pointsFor({ newAccountFirstReview: true })).toBe(15);
  });

  it('>=3 rejected receipts in 7d adds 40', () => {
    expect(pointsFor({ manyRejectedReceipts: true })).toBe(40);
  });

  it('multi-account same device/IP adds 50', () => {
    expect(pointsFor({ multiAccountSameDevice: true })).toBe(50);
  });

  it('stacks multiple signals additively', () => {
    const score = pointsFor({
      gpsDistanceMeters: 300,
      submittedNear: true, // +40
      merchantSimilarity: 70, // +25
      receiptAgeHours: 100, // +40
    });
    expect(score).toBe(105);
  });

  it('exposes a breakdown of contributing codes', () => {
    const { breakdown } = scoreReceipt(cleanSignals({ merchantSimilarity: 50, receiptAgeHours: 200 }), RULES);
    const codes = breakdown.map((b) => b.code);
    expect(codes).toContain('MERCHANT_MATCH_LOW');
    expect(codes).toContain('RECEIPT_AGE_OVER_168H');
  });
});

describe('decideFromScore — Anti-Fraud §4.2 buckets', () => {
  it('0 → VERIFIED', () => {
    expect(decideFromScore(0, RULES)).toMatchObject({
      decision: 'VERIFIED',
      reviewStatus: 'VERIFIED',
      verificationStatus: 'VERIFIED',
      receiptStatus: 'VERIFIED',
      trustLabel: 'VERIFIED',
      publicVisibility: 'PUBLIC',
      trustWeightBucket: 'HIGH',
    });
  });

  it('30 → VERIFIED (upper boundary)', () => {
    expect(decideFromScore(30, RULES).decision).toBe('VERIFIED');
  });

  it('31 → PENDING_ADMIN_REVIEW (lower boundary)', () => {
    expect(decideFromScore(31, RULES)).toMatchObject({
      decision: null,
      reviewStatus: 'PENDING_ADMIN_REVIEW',
      verificationStatus: 'PENDING_ADMIN_REVIEW',
      receiptStatus: 'PENDING_ADMIN_REVIEW',
      trustLabel: 'PENDING_ADMIN_REVIEW',
      publicVisibility: 'PRIVATE_UNTIL_DECISION',
      trustWeightBucket: 'NONE',
    });
  });

  it('60 → PENDING_ADMIN_REVIEW (upper boundary)', () => {
    expect(decideFromScore(60, RULES).reviewStatus).toBe('PENDING_ADMIN_REVIEW');
  });

  it('61 → REFERENCE_ONLY (lower boundary)', () => {
    expect(decideFromScore(61, RULES)).toMatchObject({
      decision: 'REFERENCE_ONLY',
      reviewStatus: 'REFERENCE_ONLY',
      verificationStatus: 'REFERENCE_ONLY',
      receiptStatus: 'REFERENCE_ONLY',
      trustLabel: 'REFERENCE_ONLY',
      publicVisibility: 'PUBLIC',
      trustWeightBucket: 'LOW',
    });
  });

  it('99 → REFERENCE_ONLY (upper boundary)', () => {
    expect(decideFromScore(99, RULES).reviewStatus).toBe('REFERENCE_ONLY');
  });

  it('100 → REJECTED (lower boundary)', () => {
    expect(decideFromScore(100, RULES)).toMatchObject({
      decision: 'REJECTED',
      reviewStatus: 'REJECTED',
      verificationStatus: 'REJECTED',
      receiptStatus: 'REJECTED',
      trustLabel: 'REJECTED',
      publicVisibility: 'PRIVATE',
      trustWeightBucket: 'NONE',
    });
  });

  it('150 → REJECTED', () => {
    expect(decideFromScore(150, RULES).decision).toBe('REJECTED');
  });
});