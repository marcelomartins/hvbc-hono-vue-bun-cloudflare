// Kept free of Zod so the browser can import it: the forms use these limits as
// hints, and the server schemas enforce them.
export const PERSON_NAME_MIN_CODE_POINTS = 2;
export const PERSON_NAME_MAX_CODE_POINTS = 120;
export const PASSWORD_MIN_CODE_POINTS = 8;
export const PASSWORD_MAX_CODE_POINTS = 128;
