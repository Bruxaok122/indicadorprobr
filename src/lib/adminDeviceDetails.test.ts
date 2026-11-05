import { describe, expect, it } from "vitest";
import { browserDetails, locationLabel } from "./adminDeviceDetails";

describe("administrative device details", () => {
  it("identifies Edge rather than Chrome on desktop without inventing hardware", () => {
    expect(browserDetails("Mozilla Windows Chrome/130.0 Safari/537.36 Edg/130.0")).toMatchObject({ browser: "Edge 130.0", os: "Windows", model: "Modelo não informado pelo navegador" });
  });
  it("identifies an available Android model", () => {
    expect(browserDetails("Mozilla/5.0 (Linux; Android 13; SM-S918B Build/TP1A) Chrome/130.0 Mobile")).toMatchObject({ model: "SM-S918B", os: "Android", device: "Mobile" });
  });
  it("does not infer a location from a timezone", () => {
    expect(locationLabel({ timezone: "America/Sao_Paulo" })).toBe("Localização indisponível");
  });
  it("shows only approximate city, region and country", () => {
    expect(locationLabel({ location: { city: "São Paulo", region: "SP", country: "Brasil", ip: "private", latitude: 1 } })).toBe("São Paulo · SP · Brasil");
  });
});