import {
  asReleaseRef,
  asManifestUrl,
  initialReceiveState,
  parseManifest,
  planReceive,
  reduceManifest,
  reduceShard,
  selectArtifacts,
} from "./receiver.ts";
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
const descriptor = (
  id: ArtifactDescriptor["id"],
  bounds: ArtifactDescriptor["coverageBounds"][number],
  eager = false,
): ArtifactDescriptor => ({
  id,
  coverageBounds: [bounds],
  objectName: "land",
  eager,
  digest: `${id}-digest` as ArtifactDescriptor["digest"],
  url: `./${id}.topo.json`,
});
const manifest: WorldManifest = {
  format: 2,
  release,
  artifacts: [
    descriptor("world-basemap", [-180, -30, -160, -10], true),
    descriptor("north-america", [-140, 10, -50, 80]),
    descriptor("south-america", [-90, -60, -30, 15]),
    descriptor("europe", [-20, 30, 45, 75]),
    descriptor("africa", [-25, -40, 55, 40]),
    descriptor("asia", [40, 0, 180, 80]),
    descriptor("oceania-major", [110, -50, 180, 0]),
    descriptor("antarctica", [-180, -90, 180, -55]),
  ],
};

const rawManifest = (): unknown => ({
  release: "fixture-eight-shards-v1",
  format: 2,
  artifacts: manifest.artifacts.map((artifact) => ({
    ...artifact,
    digest: "a".repeat(64),
  })),
});

const artifactFor = (id: ArtifactDescriptor["id"]): ArtifactDescriptor => {
  const artifact = manifest.artifacts.find((candidate) => candidate.id === id);

  if (artifact === undefined) {
    throw new Error(`Fixture is missing ${id}.`);
  }

  return artifact;
};

Deno.test("selectArtifacts retains manifest order and handles antimeridian bounds", () => {
  assertEquals(
    selectArtifacts(manifest, [170, -20, -170, 20]).map((artifact) =>
      artifact.id
    ),
    ["world-basemap", "asia", "oceania-major"],
  );
});

Deno.test("planReceive requests a manifest before it can request shards", () => {
  const result = planReceive(
    initialReceiveState(),
    asReleaseRef("fixture-eight-shards-v1")._unsafeUnwrap(),
    [-140, 10, -50, 80],
  );

  assertEquals(
    result._unsafeUnwrap().commands.map((command) =>
      command.kind === "load_manifest"
        ? { kind: command.kind, release: String(command.release) }
        : command
    ),
    [{ kind: "load_manifest", release: "fixture-eight-shards-v1" }],
  );
});

Deno.test("planReceive requests only absent selected shards after manifest reduction", () => {
  const withManifest = reduceManifest(initialReceiveState(), manifest)
    ._unsafeUnwrap();
  const withBasemap = reduceShard(withManifest, {
    descriptor: artifactFor("world-basemap"),
    landIds: ["island"],
  })._unsafeUnwrap();
  const result = planReceive(
    withBasemap,
    asReleaseRef("fixture-eight-shards-v1")._unsafeUnwrap(),
    [-140, 20, -50, 80],
  );

  assertEquals(
    result._unsafeUnwrap().commands.map((command) =>
      command.kind === "load_shard" ? command.artifact.id : command.kind
    ),
    ["north-america"],
  );
});

Deno.test("reduceShard rejects a duplicate manifest shard", () => {
  const withManifest = reduceManifest(initialReceiveState(), manifest)
    ._unsafeUnwrap();
  const shard = {
    descriptor: artifactFor("world-basemap"),
    landIds: ["island"],
  };
  const loaded = reduceShard(withManifest, shard)._unsafeUnwrap();
  const result = reduceShard(loaded, shard);

  assertEquals(result.isErr(), true);
  if (result.isErr()) {
    assertEquals(result.error.kind, "state_conflict");
  }
});

Deno.test("parseManifest accepts the complete eight-shard release declaration", () => {
  const result = parseManifest(
    rawManifest(),
    asManifestUrl("./manifest.json")._unsafeUnwrap(),
  );

  assertEquals(result.isOk(), true);
  assertEquals(
    result._unsafeUnwrap().artifacts.map((artifact) => artifact.id),
    [
      "world-basemap",
      "north-america",
      "south-america",
      "europe",
      "africa",
      "asia",
      "oceania-major",
      "antarctica",
    ],
  );
});

Deno.test("parseManifest normalizes a v1 bounds descriptor to one coverage footprint", () => {
  const legacy = {
    release: "fixture-eight-shards-v1",
    artifacts: manifest.artifacts.map(({ coverageBounds, ...artifact }) => ({
      ...artifact,
      bounds: coverageBounds[0],
      digest: "a".repeat(64),
    })),
  };
  const result = parseManifest(legacy, asManifestUrl("./manifest.json")._unsafeUnwrap());

  assertEquals(result.isOk(), true);
  assertEquals(result._unsafeUnwrap().format, 1);
  assertEquals(result._unsafeUnwrap().artifacts[0]?.coverageBounds, [[-180, -30, -160, -10]]);
});

Deno.test("selectArtifacts chooses an optional Pacific descriptor through either dateline footprint", () => {
  const pacific = descriptor("islands-wpac", [150, -30, 180, 30]);
  const expanded: WorldManifest = {
    format: 2,
    release,
    artifacts: [...manifest.artifacts, { ...pacific, coverageBounds: [[150, -30, 180, 30], [-180, -30, -170, 30]] }],
  };

  assertEquals(selectArtifacts(expanded, [-179, -10, -175, 10]).map((artifact) => artifact.id), ["world-basemap", "islands-wpac"]);
  assertEquals(selectArtifacts(expanded, [160, -10, 170, 10]).map((artifact) => artifact.id), ["world-basemap", "asia", "oceania-major", "islands-wpac"]);
});

Deno.test("parseManifest rejects an incomplete shard declaration", () => {
  const raw = rawManifest() as { artifacts: unknown[] };
  const result = parseManifest(
    { ...raw, artifacts: raw.artifacts.slice(0, -1) },
    asManifestUrl("./manifest.json")._unsafeUnwrap(),
  );

  assertEquals(result.isErr(), true);
  if (result.isErr()) {
    assertEquals(result.error.kind, "malformed_manifest");
  }
});

Deno.test("parseManifest rejects a traversal artifact URL", () => {
  const raw = rawManifest() as {
    artifacts: Array<Record<string, unknown>>;
  };
  const result = parseManifest(
    {
      ...raw,
      artifacts: [
        { ...raw.artifacts[0], url: "./releases/../escape.topo.json" },
        ...raw.artifacts.slice(1),
      ],
    },
    asManifestUrl("./manifest.json")._unsafeUnwrap(),
  );

  assertEquals(result.isErr(), true);
  if (result.isErr()) {
    assertEquals(result.error.kind, "rejected_url");
  }
});
