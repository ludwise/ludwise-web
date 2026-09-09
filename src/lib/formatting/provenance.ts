/**
 * The contract's field name, as a visitor reads it.
 *
 * `ProvenanceView.field` names a canonical field in the backend's vocabulary,
 * so `release_date` reaches a page unreadable. Sentence case, because
 * `design/system/guidelines/content-style.md` § Labels fixes it for every
 * label in the product.
 */
export function provenanceFieldLabel(field: string): string {
  const words = field.replaceAll('_', ' ').trim();
  return words === '' ? field : `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}
