import { decodeInitialPayload, encodeInitialPayload, initialSelectionKey, verifyInitialPayload } from "./initial-payload.ts";
import { coreShardIds, asReleaseIdentity, createManifest, type ArtifactDescriptor } from "./shards.ts";

const assertEquals = <Value>(actual: Value, expected: Value): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
};
const hex = async (bytes: Uint8Array): Promise<string> =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer)), (value) => value.toString(16).padStart(2, "0")).join("");

const fixture = async () => {
  const artifacts = await Promise.all(coreShardIds.map(async (id, index): Promise<readonly [ArtifactDescriptor, Uint8Array]> => {
    const bytes = new TextEncoder().encode(`{"id":"${id}","index":${index}}`);
    return [{ id, coverageBounds: [[-180, -90, 180, 90]], objectName: "land", eager: id === "world-basemap", digest: await hex(bytes) as ArtifactDescriptor["digest"], url: `./${id}.topo.json` }, bytes];
  }));
  return { manifest: createManifest(asReleaseIdentity("fixture-initial-v1")._unsafeUnwrap(), artifacts.map(([descriptor]) => descriptor))._unsafeUnwrap(), members: artifacts.map(([descriptor, bytes]) => ({ descriptor, bytes })) };
};

Deno.test("initial payload has a canonical selected identity and validates every member before use", async () => {
  const { manifest, members } = await fixture();
  const bounds = [-20, -20, 20, 20] as const;
  const key = await initialSelectionKey(manifest, bounds);
  const encoded = encodeInitialPayload(manifest, bounds, key, members);
  assertEquals(encoded.isOk(), true);
  const decoded = decodeInitialPayload(manifest, bounds, key, encoded._unsafeUnwrap());
  assertEquals(decoded.isOk(), true);
  const verified = await verifyInitialPayload(decoded._unsafeUnwrap());
  assertEquals(verified.isOk(), true);
  assertEquals(verified._unsafeUnwrap().map((member) => member.descriptor.id), [...coreShardIds]);
});

Deno.test("initial payload rejects an identity mismatch or corrupted member before cache seeding", async () => {
  const { manifest, members } = await fixture();
  const bounds = [-20, -20, 20, 20] as const;
  const key = await initialSelectionKey(manifest, bounds);
  const encoded = encodeInitialPayload(manifest, bounds, key, members)._unsafeUnwrap();
  assertEquals(decodeInitialPayload(manifest, bounds, "wrong", encoded).isErr(), true);
  const decoded = decodeInitialPayload(manifest, bounds, key, encoded)._unsafeUnwrap();
  const corrupted = decoded.map((member, index) => index === 0 ? { ...member, bytes: Uint8Array.of(0) } : member);
  assertEquals((await verifyInitialPayload(corrupted)).isErr(), true);
});
