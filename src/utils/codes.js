export function generateNumericCode(length = 6) {
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < length; i++) code += digits[Math.floor(Math.random() * digits.length)];
  return code;
}

export function expiryFromNow(minutes = 15) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}
