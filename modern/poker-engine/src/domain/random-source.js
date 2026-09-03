export class RandomSourceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RandomSourceError";
    this.code = code;
  }
}

export class RandomSource {
  nextInt(_maxExclusive) {
    throw new RandomSourceError("POKER_RANDOM_SOURCE_NOT_IMPLEMENTED", "RandomSource.nextInt(maxExclusive) must be implemented.");
  }
}

export function assertRandomSource(randomSource) {
  if (randomSource === null || typeof randomSource !== "object" || typeof randomSource.nextInt !== "function") {
    throw new RandomSourceError("POKER_INVALID_RANDOM_SOURCE", "RandomSource with nextInt(maxExclusive) is required.");
  }
  return randomSource;
}

export function nextBoundedInt(randomSource, maxExclusive) {
  assertRandomSource(randomSource);

  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RandomSourceError("POKER_INVALID_RANDOM_BOUND", "maxExclusive must be a positive safe integer.");
  }

  const value = randomSource.nextInt(maxExclusive);
  if (!Number.isSafeInteger(value) || value < 0 || value >= maxExclusive) {
    throw new RandomSourceError(
      "POKER_RANDOM_VALUE_OUT_OF_RANGE",
      `RandomSource returned ${String(value)} for bound ${maxExclusive}.`,
    );
  }

  return value;
}
