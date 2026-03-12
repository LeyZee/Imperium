import { describe, test, expect } from 'vitest';
import { validateEmail, validateRequired, validatePassword, validatePositiveNumber } from '../../utils/validators';

describe('validateEmail', () => {
  test('rejects empty email', () => {
    expect(validateEmail('')).toBeTruthy();
    expect(validateEmail(null)).toBeTruthy();
  });

  test('rejects invalid format', () => {
    expect(validateEmail('notanemail')).toBeTruthy();
  });

  test('accepts valid email', () => {
    expect(validateEmail('test@example.com')).toBeNull();
  });
});

describe('validateRequired', () => {
  test('rejects empty values', () => {
    expect(validateRequired('', 'Name')).toBeTruthy();
    expect(validateRequired(null, 'Name')).toBeTruthy();
    expect(validateRequired(undefined, 'Name')).toBeTruthy();
  });

  test('accepts non-empty values', () => {
    expect(validateRequired('hello', 'Name')).toBeNull();
  });
});

describe('validatePassword', () => {
  test('rejects weak passwords', () => {
    expect(validatePassword('short')).toBeTruthy();
    expect(validatePassword('nocapital1!')).toBeTruthy();
    expect(validatePassword('NoDigit!')).toBeTruthy();
    expect(validatePassword('NoSpecial1')).toBeTruthy();
  });

  test('accepts strong password', () => {
    expect(validatePassword('StrongP@ss1')).toBeNull();
  });
});

describe('validatePositiveNumber', () => {
  test('rejects negative', () => {
    expect(validatePositiveNumber(-1, 'Amount')).toBeTruthy();
  });

  test('accepts positive', () => {
    expect(validatePositiveNumber(10, 'Amount')).toBeNull();
  });
});
