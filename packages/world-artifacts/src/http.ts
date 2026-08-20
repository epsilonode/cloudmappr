import { ResultAsync } from "neverthrow";
import type { ArtifactStore } from "./receiver-runtime.ts";
import type { ImmutableArtifactUrl, ManifestUrl, ReceiveFailure } from "./receiver.ts";

export type FetchPort = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const failure = (message: string): ReceiveFailure => ({ kind: "transport", message });
const fetchBytes = (url: string, fetchPort: FetchPort): ResultAsync<Uint8Array, ReceiveFailure> =>
  ResultAsync.fromPromise(
    fetchPort(url).then((response) => response.ok ? response.arrayBuffer().then((body) => new Uint8Array(body)) : Promise.reject(new Error("not-ok"))),
    () => failure("Configured artifact HTTP request failed."),
  );

export const createHttpArtifactStore = (manifestUrl: ManifestUrl, fetchPort: FetchPort = fetch): ArtifactStore => ({
  readManifest: (() => {
    const manifest = fetchBytes(manifestUrl, fetchPort);
    return () => manifest;
  })(),
  readArtifact: (url: ImmutableArtifactUrl) => fetchBytes(new URL(url, manifestUrl).toString(), fetchPort),
});
