import { asReleaseRef } from "../../world-artifacts/src/receiver.ts";
import { createFilesystemRenderStore } from "./render.ts";
import { serveLocalDevelopment } from "./local-development.ts";

const artifactRoot = Deno.env.get("CLOUDMAPPR_ARTIFACT_ROOT") ?? "build/world";
const renderRoot = Deno.env.get("CLOUDMAPPR_RENDER_ROOT") ?? "build/renders";
const releaseValue = Deno.env.get("CLOUDMAPPR_RELEASE") ?? "fixture-eight-shards-v1";
const release = asReleaseRef(releaseValue);

if (release.isErr()) {
  console.error(release.error.message);
  Deno.exit(1);
}

const server = await serveLocalDevelopment(
  { root: artifactRoot, release: release.value },
  { release: release.value, store: createFilesystemRenderStore(renderRoot), baseUrl: "http://127.0.0.1:8000" },
  { allowedOrigins: ["http://127.0.0.1:3000", "http://localhost:3000"] },
);
console.log(`Cloudmappr local API listening at http://127.0.0.1:8000/artifacts/${release.value}/manifest.json`);
await server.finished;
