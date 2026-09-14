import { describe, expect, it } from 'vitest';
import { weightFormError } from '../../components/avatar/weight-record-validation';

describe('validación del registro de peso', () => {
  it.each(['', 'abc', '0', '-1', '501', '80.123', 'Infinity'])('rechaza peso %s', weight => {
    expect(weightFormError(weight, '2026-09-11', '2026-09-11')).not.toBeNull();
  });
  it.each(['1', '500', '80.25', '80,25'])('acepta peso %s', weight => {
    expect(weightFormError(weight, '2026-09-11', '2026-09-11')).toBeNull();
  });
  it.each(['', 'invalid', '2026-02-30', '2026-09-12', '0001-01-01'])('rechaza fecha %s', date => {
    expect(weightFormError('80', date, '2026-09-11')).not.toBeNull();
  });
});
