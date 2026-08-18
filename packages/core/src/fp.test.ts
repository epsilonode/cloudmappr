import { describeTestTier, normalizeLabels, validateLabel } from "./fp.ts"

const assertEquals = <Value>(actual: Value, expected: Value): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`)
  }
}

Deno.test("normalizeLabels creates an immutable normalized collection", () => {
  const labels = [" Pacific ", "", "World"] as const

  assertEquals(normalizeLabels(labels), ["Pacific", "World"])
  assertEquals(labels, [" Pacific ", "", "World"])
})

Deno.test("validateLabel returns a typed expected failure", () => {
  const result = validateLabel("   ")

  assertEquals(result.isErr(), true)
  if (result.isErr()) {
    assertEquals(result.error.kind, "empty_label")
  }
})

Deno.test("describeTestTier exhaustively describes the atomic convention", () => {
  assertEquals(describeTestTier("atomic"), "adjacent pure behavior")
})
