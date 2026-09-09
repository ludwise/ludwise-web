import { describe, expect, it } from 'vitest';

import { provenanceFieldLabel } from '../../../src/lib/formatting/provenance.js';

describe('a provenance field label', () => {
  it('reads a canonical field name as a visitor would say it', () => {
    expect(provenanceFieldLabel('release_date')).toBe('Release date');
    expect(provenanceFieldLabel('summary')).toBe('Summary');
  });

  it('capitalizes the first word only, as every other label does', () => {
    expect(provenanceFieldLabel('developer_and_publisher')).toBe('Developer and publisher');
  });

  it('returns a field it cannot read rather than an empty label', () => {
    // A blank label names nothing. The contract's own value is at least
    // something an operator can search the backend for.
    expect(provenanceFieldLabel('')).toBe('');
    expect(provenanceFieldLabel('_')).toBe('_');
  });
});
