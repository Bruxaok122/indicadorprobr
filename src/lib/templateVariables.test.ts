import { describe, it, expect } from "vitest";
import { guessVariableMappings, extractTemplateVariables } from "./templateVariables";

describe("guessVariableMappings", () => {
  it("guesses fields from surrounding template keywords", () => {
    const body =
      "Prezado {{1}}, informamos sobre o processo {{2}}. Sua fatura vence em {{3}}. Final do cartao: {{4}}. Gasto: {{5}}.";
    const mapping = guessVariableMappings(body);
    expect(mapping["1"]).toBe("name");
    expect(mapping["2"]).toBe("process_number");
    expect(mapping["3"]).toBe("vencimento");
    expect(mapping["4"]).toBe("final_cc");
    expect(mapping["5"]).toBe("gasto_utilizado");
  });

  it("fills EVERY variable with a default (no empty mappings)", () => {
    const body = "{{1}} {{2}} {{3}} {{4}} {{5}} {{6}}";
    const mapping = guessVariableMappings(body);
    const vars = extractTemplateVariables(body);
    for (const v of vars) {
      expect(mapping[String(v)], "variable " + v + " must be pre-selected").toBeTruthy();
    }
  });

  it("never assigns the same field twice", () => {
    const body = "Nome {{1}} e nome {{2}} e nome {{3}}";
    const mapping = guessVariableMappings(body);
    const values = Object.values(mapping);
    expect(new Set(values).size).toBe(values.length);
  });

  it("returns empty object for templates without variables", () => {
    expect(guessVariableMappings("Ola, tudo bem?")).toEqual({});
  });
});
