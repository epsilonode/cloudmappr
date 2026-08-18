import { err, ok, type Result, type ResultAsync } from "neverthrow"
import { filter, map, pipe } from "remeda"
import { match } from "ts-pattern"

export type CoreFailure = Readonly<{
  readonly kind: "empty_label" | "transport";
  readonly message: string;
}>

export type ReadLabel = (key: string) => ResultAsync<string, CoreFailure>

export type TestTier = "atomic" | "seam" | "live"

export const describeTestTier = (tier: TestTier): string =>
  match(tier)
    .with("atomic", () => "adjacent pure behavior")
    .with("seam", () => "public boundary with fake ports")
    .with("live", () => "explicit opt-in runtime proof")
    .exhaustive()

export const normalizeLabels = (labels: readonly string[]): readonly string[] =>
  pipe(
    labels,
    map((label) => label.trim()),
    filter((label) => label.length > 0),
  )

export const validateLabel = (label: string): Result<string, CoreFailure> => {
  const value = label.trim()

  return value.length === 0
    ? err({ kind: "empty_label", message: "A map label cannot be empty." })
    : ok(value)
}

export const readLabel = (read: ReadLabel, key: string): ResultAsync<string, CoreFailure> =>
  read(key).andThen(validateLabel)
