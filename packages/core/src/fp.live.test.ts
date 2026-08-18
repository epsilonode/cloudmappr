import { describeTestTier } from "./fp.ts"

Deno.test({
  name: "live: runtime proof is explicitly opt-in",
  fn: () => {
    if (describeTestTier("live") !== "explicit opt-in runtime proof") {
      throw new Error("The live-test convention changed unexpectedly.")
    }
  },
})
