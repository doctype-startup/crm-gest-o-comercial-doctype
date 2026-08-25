import { describe, expect, it } from "vitest";
import { isoDateFromUnix, stripeCycle, stripeId } from "@/lib/stripe-billing";

describe("cobrança Stripe por Pix Automático", () => {
  it("traduz os ciclos comerciais para recorrência e mandato Pix", () => {
    expect(stripeCycle("Mensal")).toEqual({ interval: "month", intervalCount: 1, schedule: "monthly", multiplier: 1 });
    expect(stripeCycle("Trimestral")).toEqual({ interval: "month", intervalCount: 3, schedule: "quarterly", multiplier: 3 });
    expect(stripeCycle("Anual")).toEqual({ interval: "year", intervalCount: 1, schedule: "yearly", multiplier: 12 });
  });

  it("normaliza identificadores e datas recebidos por webhook", () => {
    expect(stripeId("cus_123")).toBe("cus_123");
    expect(stripeId({ id: "sub_123" })).toBe("sub_123");
    expect(stripeId(null)).toBe("");
    expect(isoDateFromUnix(Date.UTC(2026, 8, 10) / 1000)).toBe("2026-09-10");
  });
});
