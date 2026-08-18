import { ResultAsync } from "neverthrow"
import { readLabel, type ReadLabel } from "./fp.ts"

const assertEquals = <Value>(actual: Value, expected: Value): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`)
  }
}

Deno.test("readLabel composes the public port with validation", async () => {
  const read: ReadLabel = (key) => ResultAsync.fromSafePromise(Promise.resolve(key === "title" ? " Cloudmappr " : ""))

  const result = await readLabel(read, "title")

  assertEquals(result.isOk(), true)
  if (result.isOk()) {
    assertEquals(result.value, "Cloudmappr")
  }
})
