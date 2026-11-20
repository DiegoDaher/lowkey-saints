export function validNewPassword(password: string): boolean {
  return password.length >= 12 && password.length <= 128;
}

/** Rejection sampling avoids modulo bias; every generated password has all classes. */
export function generatePassword(): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*-_=+";
  for (;;) {
    let password = "";
    while (password.length < 24) {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      for (const byte of bytes) {
        if (byte < Math.floor(256 / alphabet.length) * alphabet.length)
          password += alphabet[byte % alphabet.length];
        if (password.length === 24) break;
      }
    }
    if (
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /\d/.test(password) &&
      /[^\w]/.test(password)
    )
      return password;
  }
}
