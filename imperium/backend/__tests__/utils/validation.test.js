const { validatePassword, validateEmail, validatePhoto, validateDate, validatePositiveNumber } = require('../../utils/validation');

describe('validatePassword', () => {
  test('rejects empty password', () => {
    expect(validatePassword('')).toBeTruthy();
    expect(validatePassword(null)).toBeTruthy();
  });

  test('rejects short password', () => {
    expect(validatePassword('Ab1!')).toBeTruthy();
  });

  test('rejects password without uppercase', () => {
    expect(validatePassword('abcdefg1!')).toBeTruthy();
  });

  test('rejects password without digit', () => {
    expect(validatePassword('Abcdefgh!')).toBeTruthy();
  });

  test('rejects password without special char', () => {
    expect(validatePassword('Abcdefg1')).toBeTruthy();
  });

  test('accepts valid password', () => {
    expect(validatePassword('Abcdefg1!')).toBeNull();
  });
});

describe('validateEmail', () => {
  test('rejects empty email', () => {
    expect(validateEmail('')).toBeTruthy();
    expect(validateEmail(null)).toBeTruthy();
  });

  test('rejects invalid email', () => {
    expect(validateEmail('notanemail')).toBeTruthy();
  });

  test('accepts valid email', () => {
    expect(validateEmail('test@example.com')).toBeNull();
  });
});

describe('validatePhoto', () => {
  test('accepts null/empty photo', () => {
    expect(validatePhoto(null)).toBeNull();
    expect(validatePhoto('')).toBeNull();
  });

  test('rejects non-base64 photo', () => {
    expect(validatePhoto('not-a-valid-photo')).toBeTruthy();
  });

  test('accepts valid base64 photo', () => {
    const smallBase64 = 'data:image/png;base64,iVBORw0KGgo=';
    expect(validatePhoto(smallBase64)).toBeNull();
  });
});

describe('validateDate', () => {
  test('rejects invalid date format', () => {
    expect(validateDate('13/01/2024')).toBeTruthy();
    expect(validateDate('not-a-date')).toBeTruthy();
  });

  test('accepts valid YYYY-MM-DD date', () => {
    expect(validateDate('2024-01-15')).toBeNull();
  });
});

describe('validatePositiveNumber', () => {
  test('rejects negative numbers', () => {
    expect(validatePositiveNumber(-5)).toBeTruthy();
  });

  test('rejects non-numbers', () => {
    expect(validatePositiveNumber('abc')).toBeTruthy();
  });

  test('accepts zero', () => {
    expect(validatePositiveNumber(0)).toBeNull();
  });

  test('accepts positive numbers', () => {
    expect(validatePositiveNumber(42.5)).toBeNull();
  });
});
