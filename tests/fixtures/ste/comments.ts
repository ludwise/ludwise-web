/**
 * A compliant contract comment.
 *
 * The function reads one file. It returns the prose units of that file.
 */
export const compliant = 1;

// The value doesn't match, and the behaviour is wrong.
export const violating = 2;

const label = '// this string is not a comment, and the behaviour is fine';

export const total = compliant + violating + label.length;
