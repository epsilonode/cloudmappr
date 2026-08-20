import { err, ok, ResultAsync } from "neverthrow";
import type { LandGeometry } from "../../core/mod.ts";
import {
  createFilesystemArtifactStore,
  createLocalArtifactRoute,
  createLocalManifestUrl,
  decodeLandGeometry,
  jsonManifestDecoder,
  sha256DigestPort,
  topologyLandDecoder,
  type LocalReleaseConfig,
} from "../../world-artifacts/src/local.ts";
import { planReceive, resolveArtifactUrl } from "../../world-artifacts/src/receiver.ts";
import type { ReceiveFailure } from "../../world-artifacts/src/receiver.ts";
import { executeReceivePlan } from "../../world-artifacts/src/receiver-runtime.ts";
import { createRenderApi, type LandProvider, type RenderFailure, type RenderServiceConfig } from "./render.ts";

const renderFailure = (failure: ReceiveFailure): RenderFailure => ({ kind: "geometry", message: failure.message });
const unexpected = (): RenderFailure => ({ kind: "geometry", message: "Configured world artifacts could not be resolved." });

export const createLocalLandProvider = (config: LocalReleaseConfig): LandProvider => ({
  load: (() => {
    const store = createFilesystemArtifactStore(config);
    const ports = { store, manifest: jsonManifestDecoder, manifestUrl: createLocalManifestUrl(config), digest: sha256DigestPort, decoder: topologyLandDecoder };
    return (spec) => {
    const initial = planReceive({ shards: [] }, config.release, spec.bounds);
    if (initial.isErr()) return ResultAsync.fromSafePromise(Promise.resolve(err(renderFailure(initial.error)))).andThen((result) => result);
    return ResultAsync.fromPromise(
      (async () => {
        const withManifest = await executeReceivePlan(initial.value, ports);
        if (withManifest.isErr()) return err(renderFailure(withManifest.error));
        const shards = planReceive(withManifest.value, config.release, spec.bounds);
        if (shards.isErr()) return err(renderFailure(shards.error));
        const decoded = await Promise.all(shards.value.commands.flatMap((command) => command.kind === "load_shard" ? [command.artifact] : []).map(async (artifact) => {
          const url = resolveArtifactUrl(artifact);
          if (url.isErr()) return err(renderFailure(url.error));
          const bytes = await store.readArtifact(url.value);
          if (bytes.isErr()) return err(renderFailure(bytes.error));
          const digest = await sha256DigestPort.sha256(bytes.value);
          if (digest.isErr()) return err(renderFailure(digest.error));
          if (digest.value !== artifact.digest) return err({ kind: "geometry", message: `Artifact ${artifact.id} did not match its manifest digest.` } satisfies RenderFailure);
          const geometry = await decodeLandGeometry(bytes.value, artifact);
          return geometry.isErr() ? err(renderFailure(geometry.error)) : ok(geometry.value);
        }));
        const failed = decoded.find((result) => result.isErr());
        return failed?.isErr() ? err(failed.error) : ok(decoded.flatMap((result) => result._unsafeUnwrap()) as readonly LandGeometry[]);
      })(),
      unexpected,
    ).andThen((result) => result);
    };
  })(),
});

export const createLocalDevelopmentHandler = async (
  artifacts: LocalReleaseConfig,
  render: Omit<RenderServiceConfig, "provider">,
  allowedOrigins: readonly string[] = [],
): Promise<(request: Request) => Promise<Response>> => {
  const artifactRoute = await createLocalArtifactRoute(artifacts, allowedOrigins);
  const renderApi = createRenderApi({ ...render, provider: createLocalLandProvider(artifacts) });
  return artifactRoute.isErr()
    ? () => Promise.resolve(new Response(JSON.stringify({ error: "artifact_configuration" }), { status: 500, headers: { "content-type": "application/json" } }))
    : (request) => new URL(request.url).pathname.startsWith("/artifacts/") ? artifactRoute.value(request) : renderApi(request);
};

export const serveLocalDevelopment = async (
  artifacts: LocalReleaseConfig,
  render: Omit<RenderServiceConfig, "provider">,
  options: Readonly<{ readonly port?: number; readonly hostname?: string; readonly allowedOrigins?: readonly string[] }> = {},
): Promise<Deno.HttpServer> => Deno.serve(
  { port: options.port ?? 8000, hostname: options.hostname ?? "127.0.0.1" },
  await createLocalDevelopmentHandler(artifacts, render, options.allowedOrigins ?? []),
);
