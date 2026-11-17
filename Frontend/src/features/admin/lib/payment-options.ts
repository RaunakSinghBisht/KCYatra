// The payment choices an admin can pick for a registration. Each maps to a stored
// (payment_status, payment_method) pair, so status and method can never disagree.
export type PaymentOption = {
  value: string;
  label: string;
  status: "interested" | "paid" | "partial_paid" | "not_paid";
  method: "online" | "cash" | null;
};

export const PAYMENT_OPTIONS: PaymentOption[] = [
  { value: "interested", label: "Interested", status: "interested", method: null },
  { value: "online_paid", label: "Online • Paid", status: "paid", method: "online" },
  { value: "cash_not_paid", label: "Cash • Not Paid", status: "not_paid", method: "cash" },
  { value: "cash_partial", label: "Cash • Partial Paid", status: "partial_paid", method: "cash" },
  { value: "cash_paid", label: "Cash • Paid", status: "paid", method: "cash" },
];

/** Picks the option matching a stored registration (older rows may have a missing method). */
export function optionValueFor(status: string, method: string | null | undefined): string {
  if (status === "paid") return method === "cash" ? "cash_paid" : "online_paid";
  if (status === "partial_paid") return "cash_partial";
  if (status === "not_paid") return "cash_not_paid";
  return "interested";
}

export function optionByValue(value: string): PaymentOption {
  return PAYMENT_OPTIONS.find((o) => o.value === value) ?? PAYMENT_OPTIONS[0]!;
}
