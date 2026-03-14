const { getPeriode } = require('../../utils/period');

describe('getPeriode', () => {
  test('day 1 → first half (01-15)', () => {
    expect(getPeriode('2026-03-01')).toEqual({ debut: '2026-03-01', fin: '2026-03-15' });
  });

  test('day 7 → first half', () => {
    expect(getPeriode('2026-03-07')).toEqual({ debut: '2026-03-01', fin: '2026-03-15' });
  });

  test('day 14 → still first half', () => {
    expect(getPeriode('2026-03-14')).toEqual({ debut: '2026-03-01', fin: '2026-03-15' });
  });

  test('day 15 → second half (15 → 1st next month)', () => {
    expect(getPeriode('2026-03-15')).toEqual({ debut: '2026-03-15', fin: '2026-04-01' });
  });

  test('day 20 → second half', () => {
    expect(getPeriode('2026-03-20')).toEqual({ debut: '2026-03-15', fin: '2026-04-01' });
  });

  test('day 31 → second half', () => {
    expect(getPeriode('2026-03-31')).toEqual({ debut: '2026-03-15', fin: '2026-04-01' });
  });

  test('December second half rolls over to January next year', () => {
    expect(getPeriode('2026-12-20')).toEqual({ debut: '2026-12-15', fin: '2027-01-01' });
  });

  test('December first half stays in December', () => {
    expect(getPeriode('2026-12-05')).toEqual({ debut: '2026-12-01', fin: '2026-12-15' });
  });

  test('January first half', () => {
    expect(getPeriode('2026-01-01')).toEqual({ debut: '2026-01-01', fin: '2026-01-15' });
  });

  test('accepts Date object', () => {
    const date = new Date(2026, 2, 10); // March 10
    expect(getPeriode(date)).toEqual({ debut: '2026-03-01', fin: '2026-03-15' });
  });

  test('February second half goes to March 1st', () => {
    expect(getPeriode('2026-02-20')).toEqual({ debut: '2026-02-15', fin: '2026-03-01' });
  });
});
