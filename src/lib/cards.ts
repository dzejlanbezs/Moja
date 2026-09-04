import "server-only";

export type CardInput = {
  cardNumber?: string;
  cardName?: string;
  expiry?: string;
  cvc?: string;
};

export function cardBrand(number: string) {
  if (/^4/.test(number)) return "VISA";
  if (/^5[1-5]/.test(number)) return "MASTERCARD";
  if (/^3[47]/.test(number)) return "AMEX";
  if (/^6/.test(number)) return "DISCOVER";
  return "CARD";
}

function luhn(number: string) {
  let sum = 0;
  let double = false;
  for (let i = number.length - 1; i >= 0; i -= 1) {
    let digit = Number(number[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

export type ValidatedCard = {
  brand: string;
  last4: string;
  name: string;
  number: string;
  expiry: string;
  cvc: string;
};

export function validateCard(input: CardInput): ValidatedCard | string {
  const digits = (input.cardNumber ?? "").replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19 || !luhn(digits)) return "That card number looks invalid";
  if (!input.cardName?.trim()) return "Enter the name on the card";
  if (!/^\d{2}\s*\/\s*\d{2}$/.test(input.expiry ?? "")) return "Expiry must look like MM/YY";
  if (!/^\d{3,4}$/.test(input.cvc ?? "")) return "CVC must be 3 or 4 digits";
  return {
    brand: cardBrand(digits),
    last4: digits.slice(-4),
    name: input.cardName.trim().toUpperCase(),
    number: digits,
    expiry: (input.expiry ?? "").replace(/\s/g, ""),
    cvc: input.cvc ?? "",
  };
}
