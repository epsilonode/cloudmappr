import { ResultAsync } from "neverthrow";
import {
  asReleaseRef,
  asManifestUrl,
  initialReceiveState,
  planReceive,
  selectedShardIds,
} from "./receiver.ts";
import { executeReceivePlan, type ReceiverPorts } from "./receiver-runtime.ts";
import {
  type ArtifactDescriptor,
  asReleaseIdentity,
  type WorldManifest,
} from "./shards.ts";

const assertEquals = <Value>(actual: Value, expected: Value): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }.`,
    );
  }
};

const release = asReleaseIdentity("fixture-eight-shards-v1")._unsafeUnwrap();
const artifact = (
  id: ArtifactDescriptor["id"],
  bounds: ArtifactDescriptor["coverageBounds"][number],
  eager = false,
): ArtifactDescriptor => ({
  id,
  coverageBounds: [bounds],
  objectName: "land",
  eager,
  digest: "a".repeat(64) as ArtifactDescriptor["digest"],
  url: `./${id}.topo.json`,
});
const manifest: WorldManifest = {
  format: 2,
  release,
  artifacts: [
    artifact("world-basemap", [-180, -30, -160, -10], true),
    artifact("north-america", [-140, 10, -50, 80]),
    artifact("south-america", [-90, -60, -30, 15]),
    artifact("europe", [-20, 30, 45, 75]),
    artifact("africa", [-25, -40, 55, 40]),
    artifact("asia", [40, 0, 180, 80]),
    artifact("oceania-major", [110, -50, 180, 0]),
    artifact("antarctica", [-180, -90, 180, -55]),
  ],
};
const releaseRef = asReleaseRef("fixture-eight-shards-v1")._unsafeUnwrap();
const ports: ReceiverPorts = {
  store: {
    readManifest: () =>
      ResultAsync.fromSafePromise(
        Promise.resolve(new TextEncoder().encode(JSON.stringify(manifest))),
      ),
    readArtifact: (url) =>
      ResultAsync.fromSafePromise(
        Promise.resolve(new TextEncoder().encode(String(url))),
      ),
  },
  manifest: {
    decode: (bytes) =>
      ResultAsync.fromSafePromise(
        Promise.resolve(JSON.parse(new TextDecoder().decode(bytes))),
      ),
  },
  manifestUrl: asManifestUrl("./manifest.json")._unsafeUnwrap(),
  digest: {
    sha256: () =>
      ResultAsync.fromSafePromise(
        Promise.resolve(
          "a".repeat(64) as ArtifactDescriptor["digest"],
        ),
      ),
  },
  decoder: {
    decode: (_bytes, descriptor) =>
      ResultAsync.fromSafePromise(
        Promise.resolve([`land-${descriptor.id}`]),
      ),
  },
};
const mismatchedDigestPorts: ReceiverPorts = {
  ...ports,
  digest: {
    sha256: () =>
      ResultAsync.fromSafePromise(
        Promise.resolve("wrong-digest" as ArtifactDescriptor["digest"]),
      ),
  },
};

Deno.test("receiver seam executes injected ports after pure planning", async () => {
  const manifestPlan = planReceive(initialReceiveState(), releaseRef, [
    -140,
    20,
    -50,
    80,
  ])._unsafeUnwrap();
  const withManifest = await executeReceivePlan(manifestPlan, ports);
  const shardPlan = planReceive(withManifest._unsafeUnwrap(), releaseRef, [
    -140,
    20,
    -50,
    80,
  ])._unsafeUnwrap();
  const received = await executeReceivePlan(shardPlan, ports);

  assertEquals(selectedShardIds(received._unsafeUnwrap()), [
    "world-basemap",
    "north-america",
  ]);
});

Deno.test("receiver seam rejects a shard before decode when its digest differs", async () => {
  const manifestPlan = planReceive(initialReceiveState(), releaseRef, [
    -140,
    20,
    -50,
    80,
  ])._unsafeUnwrap();
  const withManifest = await executeReceivePlan(manifestPlan, ports);
  const shardPlan = planReceive(withManifest._unsafeUnwrap(), releaseRef, [
    -140,
    20,
    -50,
    80,
  ])._unsafeUnwrap();
  const result = await executeReceivePlan(shardPlan, mismatchedDigestPorts);

  assertEquals(result.isErr(), true);
  if (result.isErr()) {
    assertEquals(result.error.kind, "digest_mismatch");
  }
});
