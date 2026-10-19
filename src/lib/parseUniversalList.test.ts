import { describe, it, expect } from "vitest";
import { maskCard, guessTarget } from "./parseUniversalList";

describe("maskCard", () => {
  it("keeps first 6 + XXXXXX + last 4", () => {
    expect(maskCard("1234 5678 9012 8620")).toBe("123456XXXXXX8620");
  });
  it("rejects money values", () => {
    expect(maskCard("R$ 1.234,56")).toBeNull();
  });
});

describe("guessTarget", () => {
  it("maps new fields", () => {
    expect(guessTarget("Nome Completo")).toBe("nome_completo");
    expect(guessTarget("Identificação")).toBe("identificacao");
    expect(guessTarget("CC")).toBe("final_cc");
  });
});
