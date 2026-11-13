/**
 * Inputs reported masked (k.ctx Observers): a password by type or by the autocomplete tokens browsers use for one,
 * and any control bound to personal data (`data-k-pii`, k.privacy).
 */
export const SECRET_FIELDS =
  'input[type="password"],input[autocomplete~="current-password"],input[autocomplete~="new-password"],[data-k-pii]';
