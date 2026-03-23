const { TIMEZONES, CRENEAUX, ROLES, CHATTEUR_ROLES } = require('../../utils/constants');

describe('constants', () => {
  test('TIMEZONES contains expected zones', () => {
    expect(TIMEZONES).toContain('Europe/Paris');
    expect(TIMEZONES.length).toBeGreaterThan(0);
  });

  test('CRENEAUX has 4 slots', () => {
    expect(Object.keys(CRENEAUX)).toHaveLength(4);
    expect(CRENEAUX[1]).toHaveProperty('label');
    expect(CRENEAUX[1]).toHaveProperty('start');
    expect(CRENEAUX[1]).toHaveProperty('end');
  });

  test('ROLES contains admin and chatteur', () => {
    expect(ROLES).toContain('admin');
    expect(ROLES).toContain('chatteur');
  });

  test('CHATTEUR_ROLES contains expected roles', () => {
    expect(CHATTEUR_ROLES).toContain('chatteur');
    expect(CHATTEUR_ROLES).toContain('manager');
  });
});
