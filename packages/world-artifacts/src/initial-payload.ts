import { err, ok, Result, type Result as ResultType } from "neverthrow";
import { resolveArtifactUrl, selectArtifacts, type ReceiveFailure } from "./receiver.ts";
import type { ArtifactDescriptor, ArtifactDigest, LonLatBounds, WorldManifest } from "./shards.ts";

export type InitialPayloadMember = Readonly<{ readonly descriptor: ArtifactDescriptor; readonly bytes: Uint8Array }>;
export type InitialPayloadIndex = Readonly<{
  readonly format: 1;
  readonly release: string;
  readonly selectionKey: string;
  readonly manifest: WorldManifest;
  readonly members: readonly Readonly<{ readonly id: string; readonly url: string; readonly objectName: string; readonly digest: string; readonly offset: number; readonly length: number }>[];
}>;

const magic = new TextEncoder().encode("CMAP");
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const failure = (message: string): ReceiveFailure => ({ kind: "decode", message });

const sameSelection = (left: readonly ArtifactDescriptor[], right: readonly ArtifactDescriptor[]): boolean =>
  left.length === right.length && left.every((descriptor, index) => descriptor.id === right[index]?.id && descriptor.url === right[index]?.url && descriptor.digest === right[index]?.digest);

export const initialSelectionKey = async (manifest: WorldManifest, bounds: LonLatBounds): Promise<string> => {
  const selected = selectArtifacts(manifest, bounds).map((artifact) => [artifact.id, artifact.digest]);
  const bytes = encoder.encode(JSON.stringify([manifest.release, selected]));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
};

export const encodeInitialPayload = (
  manifest: WorldManifest,
  bounds: LonLatBounds,
  selectionKey: string,
  members: readonly InitialPayloadMember[],
): ResultType<Uint8Array, ReceiveFailure> => {
  const selected = selectArtifacts(manifest, bounds);
  if (!sameSelection(selected, members.map((member) => member.descriptor))) return err(failure("Initial payload members do not match the selected manifest artifacts."));
  if (members.some((member) => resolveArtifactUrl(member.descriptor).isErr())) return err(failure("Initial payload contains an unsafe artifact URL."));
  const index: InitialPayloadIndex = {
    format: 1,
    release: manifest.release,
    selectionKey,
    manifest,
    members: members.map((member, index) => ({
      id: member.descriptor.id,
      url: member.descriptor.url,
      objectName: member.descriptor.objectName,
      digest: member.descriptor.digest,
      offset: members.slice(0, index).reduce((total, candidate) => total + candidate.bytes.byteLength, 0),
      length: member.bytes.byteLength,
    })),
  };
  const indexBytes = encoder.encode(JSON.stringify(index));
  const length = indexBytes.byteLength;
  const header = Uint8Array.from([...magic, 1, (length >>> 24) & 255, (length >>> 16) & 255, (length >>> 8) & 255, length & 255, ...indexBytes]);
  return ok(Uint8Array.from([...header, ...members.flatMap((member) => [...member.bytes])]));
};

export const decodeInitialPayload = (
  manifest: WorldManifest,
  bounds: LonLatBounds,
  expectedSelectionKey: string,
  payload: Uint8Array,
): ResultType<readonly InitialPayloadMember[], ReceiveFailure> => {
  if (payload.byteLength < 9 || !magic.every((value, index) => payload[index] === value) || payload[4] !== 1) return err(failure("Initial payload header is invalid."));
  const indexLength = new DataView(payload.buffer, payload.byteOffset, payload.byteLength).getUint32(5, false);
  if (indexLength > payload.byteLength - 9) return err(failure("Initial payload index exceeds its body."));
  const parsed = Result.fromThrowable(() => JSON.parse(decoder.decode(payload.slice(9, 9 + indexLength))) as InitialPayloadIndex, () => failure("Initial payload index is invalid JSON."))();
  if (parsed.isErr()) return err(parsed.error);
  const index = parsed.value;
  const selected = selectArtifacts(manifest, bounds);
  if (index.format !== 1 || index.release !== manifest.release || index.selectionKey !== expectedSelectionKey || JSON.stringify(index.manifest) !== JSON.stringify(manifest) || index.members.length !== selected.length) return err(failure("Initial payload identity does not match the requested selection."));
  const body = payload.slice(9 + indexLength);
  const members = index.members.map((entry, position) => {
    const descriptor = selected[position];
    if (descriptor === undefined || descriptor.id !== entry.id || descriptor.url !== entry.url || descriptor.objectName !== entry.objectName || descriptor.digest !== entry.digest || !Number.isSafeInteger(entry.offset) || !Number.isSafeInteger(entry.length) || entry.offset < 0 || entry.length < 0 || entry.offset + entry.length > body.byteLength) return undefined;
    return { descriptor, bytes: body.slice(entry.offset, entry.offset + entry.length) };
  });
  const lastEnd = index.members.reduce((end, entry) => Math.max(end, entry.offset + entry.length), 0);
  return members.some((member) => member === undefined) || lastEnd !== body.byteLength
    ? err(failure("Initial payload members are invalid."))
    : ok(members as readonly InitialPayloadMember[]);
};

export const verifyInitialPayload = async (
  members: readonly InitialPayloadMember[],
): Promise<ResultType<readonly InitialPayloadMember[], ReceiveFailure>> =>
  (await Promise.all(members.map(async (member) => ({
    member,
    digest: Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(member.bytes).buffer)), (value) => value.toString(16).padStart(2, "0")).join("") as ArtifactDigest,
  })))).find(({ member, digest }) => digest !== member.descriptor.digest) === undefined
    ? ok(members)
    : err({ kind: "digest_mismatch", message: "An initial payload artifact did not match its manifest digest." });
