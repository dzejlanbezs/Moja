"use client";

export type CardState = { number: string; name: string; expiry: string; cvc: string };

export const emptyCard: CardState = { number: "", name: "", expiry: "", cvc: "" };

export function formatCardNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

export function brandOf(value: string) {
  const digits = value.replace(/\D/g, "");
  if (/^4/.test(digits)) return "VISA";
  if (/^5[1-5]/.test(digits)) return "MASTERCARD";
  if (/^3[47]/.test(digits)) return "AMEX";
  if (/^6/.test(digits)) return "DISCOVER";
  return "CARD";
}

export function CardForm({
  value,
  onChange,
  idPrefix = "card",
}: {
  value: CardState;
  onChange: (next: CardState) => void;
  idPrefix?: string;
}) {
  const set = (patch: Partial<CardState>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-blush-600 via-[#8b2bd6] to-violet-500 p-6 shadow-[0_30px_60px_-30px_rgba(255,61,127,0.8)]">
        <div className="absolute -top-16 -right-10 h-44 w-44 rounded-full bg-white/12 blur-2xl" />
        <div className="flex items-start justify-between">
          <div className="h-9 w-12 rounded-md bg-gradient-to-br from-amber-200/90 to-amber-400/70" />
          <span className="text-sm font-semibold tracking-[0.18em] text-white/90">{brandOf(value.number)}</span>
        </div>
        <p className="mt-7 font-mono text-lg tracking-[0.14em] text-white">
          {formatCardNumber(value.number) || "•••• •••• •••• ••••"}
        </p>
        <div className="mt-6 flex items-end justify-between text-white/85">
          <div>
            <p className="text-[10px] tracking-[0.14em] uppercase opacity-70">Card holder</p>
            <p className="text-sm tracking-wide uppercase">{value.name || "YOUR NAME"}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] tracking-[0.14em] uppercase opacity-70">Expires</p>
            <p className="text-sm">{value.expiry || "MM/YY"}</p>
          </div>
        </div>
      </div>

      <div>
        <label className="label" htmlFor={`${idPrefix}-number`}>
          Card number
        </label>
        <input
          id={`${idPrefix}-number`}
          inputMode="numeric"
          autoComplete="cc-number"
          className="field font-mono tracking-widest"
          placeholder="4242 4242 4242 4242"
          value={formatCardNumber(value.number)}
          onChange={(event) => set({ number: event.target.value })}
        />
      </div>

      <div>
        <label className="label" htmlFor={`${idPrefix}-name`}>
          Name on card
        </label>
        <input
          id={`${idPrefix}-name`}
          autoComplete="cc-name"
          className="field"
          placeholder="Alex Morgan"
          value={value.name}
          onChange={(event) => set({ name: event.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor={`${idPrefix}-expiry`}>
            Expiry
          </label>
          <input
            id={`${idPrefix}-expiry`}
            inputMode="numeric"
            autoComplete="cc-exp"
            className="field"
            placeholder="09/28"
            value={value.expiry}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
              set({ expiry: digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits });
            }}
          />
        </div>
        <div>
          <label className="label" htmlFor={`${idPrefix}-cvc`}>
            CVC
          </label>
          <input
            id={`${idPrefix}-cvc`}
            inputMode="numeric"
            autoComplete="cc-csc"
            className="field"
            placeholder="123"
            value={value.cvc}
            onChange={(event) => set({ cvc: event.target.value.replace(/\D/g, "").slice(0, 4) })}
          />
        </div>
      </div>
    </div>
  );
}
