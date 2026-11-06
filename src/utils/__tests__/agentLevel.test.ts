import { describe, expect, it } from "vitest";
import { boostLevel, readAgentOutputLevel, spectralMean } from "../agentLevel";

describe("boostLevel (ganancia perceptual)", () => {
  it("realza valores bajos sin exceder 1", () => {
    expect(boostLevel(0)).toBe(0);
    expect(boostLevel(0.05)).toBeGreaterThan(0.2);
    expect(boostLevel(0.6)).toBeGreaterThan(0.9);
    expect(boostLevel(2)).toBeCloseTo(1, 3);
  });

  it("ignora entradas no finitas", () => {
    expect(boostLevel(NaN)).toBe(0);
    expect(boostLevel(Infinity)).toBe(0);
    expect(boostLevel(-0.3)).toBe(0);
  });

  it("k mediante más agresivo mueve más", () => {
    expect(boostLevel(0.1, 8)).toBeGreaterThan(boostLevel(0.1, 2));
  });
});

describe("spectralMean", () => {
  it("vuelve 0 sin espectro o con bordes", () => {
    expect(spectralMean(null)).toBe(0);
    expect(spectralMean(new Uint8Array(0))).toBe(0);
    expect(spectralMean(new Uint8Array([0, 0, 0]))).toBe(0);
  });

  it("media 0..1 del interior del espectro", () => {
    // Bordes [0,0] ignorados; interior = 128 → media ≈ 128/255.
    const bytes = new Uint8Array([0, 255, 128, 255, 0]);
    expect(spectralMean(bytes)).toBeCloseTo(128 / 255, 3);
  });
});

describe("readAgentOutputLevel", () => {
  it("toma el máximo entre RMS y espectro, con boost", () => {
    const level = readAgentOutputLevel(
      () => 0.02,
      () => new Uint8Array(new Array(64).fill(120)),
    );
    expect(level).toBeGreaterThan(0.3);
  });

  it("no lanza si el SDK no está conectado", () => {
    expect(readAgentOutputLevel(undefined, undefined)).toBe(0);
    const boom = () => {
      throw new Error("no session");
    };
    expect(readAgentOutputLevel(boom, boom)).toBe(0);
  });
});
