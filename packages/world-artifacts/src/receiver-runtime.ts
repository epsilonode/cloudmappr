import { err, type Result, ResultAsync } from "neverthrow";
import {
  type ImmutableArtifactUrl,
  type ManifestUrl,
  type ReceiveCommand,
  type ReceiveFailure,
  type ReceivePlan,
  type ReceiveState,
  reduceManifest,
  reduceShard,
  parseManifest,
  resolveArtifactUrl,
} from "./receiver.ts";
import type {
  ArtifactDescriptor,
  ArtifactDigest,
} from "./shards.ts";
import type { ReleaseRef } from "./receiver.ts";

export type ArtifactStore = Readonly<{
  readonly readManifest: (
    release: ReleaseRef,
  ) => ResultAsync<Uint8Array, ReceiveFailure>;
  readonly readArtifact: (
    url: ImmutableArtifactUrl,
  ) => ResultAsync<Uint8Array, ReceiveFailure>;
}>;

export type ManifestDecoder = Readonly<{
  readonly decode: (
    bytes: Uint8Array,
    source: ManifestUrl,
  ) => ResultAsync<unknown, ReceiveFailure>;
}>;

export type DigestPort = Readonly<{
  readonly sha256: (
    bytes: Uint8Array,
  ) => ResultAsync<ArtifactDigest, ReceiveFailure>;
}>;

export type TopologyDecoder = Readonly<{
  readonly decode: (
    bytes: Uint8Array,
    descriptor: ArtifactDescriptor,
  ) => ResultAsync<readonly string[], ReceiveFailure>;
}>;

export type ReceiverPorts = Readonly<{
  readonly store: ArtifactStore;
  readonly manifest: ManifestDecoder;
  readonly manifestUrl: ManifestUrl;
  readonly digest: DigestPort;
  readonly decoder: TopologyDecoder;
}>;

const transportFailure = (): ReceiveFailure => ({
  kind: "transport",
  message: "An artifact receiver port rejected unexpectedly.",
});

const executeManifest = async (
  state: ReceiveState,
  release: ReleaseRef,
  ports: ReceiverPorts,
): Promise<Result<ReceiveState, ReceiveFailure>> => {
  const bytes = await ports.store.readManifest(release);
  if (bytes.isErr()) return err(bytes.error);

  const raw = await ports.manifest.decode(bytes.value, ports.manifestUrl);

  return raw.isErr()
    ? err(raw.error)
    : parseManifest(raw.value, ports.manifestUrl).andThen((manifest) =>
      reduceManifest(state, manifest)
    );
};

const executeShard = async (
  state: ReceiveState,
  descriptor: ArtifactDescriptor,
  ports: ReceiverPorts,
): Promise<Result<ReceiveState, ReceiveFailure>> => {
  const url = resolveArtifactUrl(descriptor);

  if (url.isErr()) return err(url.error);

  const bytes = await ports.store.readArtifact(url.value);
  if (bytes.isErr()) return err(bytes.error);

  const digest = await ports.digest.sha256(bytes.value);
  if (digest.isErr()) return err(digest.error);

  if (digest.value !== descriptor.digest) {
    return err({
      kind: "digest_mismatch",
      message: `Artifact ${descriptor.id} did not match its manifest digest.`,
    });
  }

  const landIds = await ports.decoder.decode(bytes.value, descriptor);

  return landIds.isErr()
    ? err(landIds.error)
    : reduceShard(state, { descriptor, landIds: landIds.value });
};

const executeCommand = (
  state: ReceiveState,
  command: ReceiveCommand,
  ports: ReceiverPorts,
): ResultAsync<ReceiveState, ReceiveFailure> =>
  ResultAsync.fromPromise(
    command.kind === "load_manifest"
      ? executeManifest(state, command.release, ports)
      : executeShard(state, command.artifact, ports),
    transportFailure,
  ).andThen((result) => result);

export const executeReceivePlan = (
  plan: ReceivePlan,
  ports: ReceiverPorts,
): ResultAsync<ReceiveState, ReceiveFailure> =>
  plan.commands.reduce<ResultAsync<ReceiveState, ReceiveFailure>>(
    (state, command) =>
      state.andThen((value) => executeCommand(value, command, ports)),
    ResultAsync.fromPromise(Promise.resolve(plan.state), transportFailure),
  );
