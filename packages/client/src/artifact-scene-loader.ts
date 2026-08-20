import { err, ok, ResultAsync } from "neverthrow";
import {
  buildMapScene,
  canonicalizeMapSpec,
  validateMapSpec,
  type MapFailure,
  type MapScene,
  type MapSpec,
} from "../../core/mod.ts";
import {
  createHttpArtifactStore,
} from "../../world-artifacts/src/http.ts";
import {
  decodeLandGeometry,
  jsonManifestDecoder,
  sha256DigestPort,
  topologyLandDecoder,
} from "../../world-artifacts/src/local.ts";
import { executeReceivePlan } from "../../world-artifacts/src/receiver-runtime.ts";
import { planReceive, resolveArtifactUrl, type ManifestUrl, type ReceiveFailure, type ReleaseRef } from "../../world-artifacts/src/receiver.ts";
import type { CreateMapOptions } from "./create-map.ts";

export type BrowserArtifactConfig = Readonly<{ readonly manifestUrl: ManifestUrl; readonly release: ReleaseRef; readonly fetchPort?: typeof fetch }>;

const artifactFailure = (failure: ReceiveFailure): MapFailure => ({ kind: "artifact", message: failure.message });
const unexpected = (): MapFailure => ({ kind: "artifact", message: "Configured browser artifacts could not be resolved." });

export const createBrowserSceneLoader = (config: BrowserArtifactConfig): CreateMapOptions["loadScene"] => (input: MapSpec): ResultAsync<MapScene, MapFailure> => {
  const validated = validateMapSpec(input);
  if (validated.isErr()) return ResultAsync.fromSafePromise(Promise.resolve(err(validated.error))).andThen((result) => result);
  const spec = canonicalizeMapSpec(validated.value);
  const store = createHttpArtifactStore(config.manifestUrl, config.fetchPort);
  const ports = { store, manifest: jsonManifestDecoder, manifestUrl: config.manifestUrl, digest: sha256DigestPort, decoder: topologyLandDecoder };
  const initial = planReceive({ shards: [] }, config.release, spec.bounds);
  if (initial.isErr()) return ResultAsync.fromSafePromise(Promise.resolve(err(artifactFailure(initial.error)))).andThen((result) => result);
  return ResultAsync.fromPromise(
    (async () => {
      const withManifest = await executeReceivePlan(initial.value, ports);
      if (withManifest.isErr()) return err(artifactFailure(withManifest.error));
      const shards = planReceive(withManifest.value, config.release, spec.bounds);
      if (shards.isErr()) return err(artifactFailure(shards.error));
      const geometries = await Promise.all(shards.value.commands.flatMap((command) => command.kind === "load_shard" ? [command.artifact] : []).map(async (artifact) => {
        const url = resolveArtifactUrl(artifact);
        if (url.isErr()) return err(artifactFailure(url.error));
        const bytes = await store.readArtifact(url.value);
        if (bytes.isErr()) return err(artifactFailure(bytes.error));
        const digest = await sha256DigestPort.sha256(bytes.value);
        if (digest.isErr() || digest.value !== artifact.digest) return err(artifactFailure(digest.isErr() ? digest.error : { kind: "digest_mismatch", message: `Artifact ${artifact.id} did not match its manifest digest.` }));
        const decoded = await decodeLandGeometry(bytes.value, artifact);
        return decoded.isErr() ? err(artifactFailure(decoded.error)) : ok(decoded.value);
      }));
      const rejected = geometries.find((result) => result.isErr());
      if (rejected?.isErr()) return err(rejected.error);
      const scene = buildMapScene(spec, geometries.flatMap((result) => result._unsafeUnwrap()));
      return scene.isErr() ? err(scene.error) : ok(scene.value);
    })(),
    unexpected,
  ).andThen((result) => result);
};
