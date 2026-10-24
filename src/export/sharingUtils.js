// Share links carry their data in the URL, so nothing is stored on a server.
// Payloads are deflated and base64url-encoded to keep links short enough for chat apps.

const toBase64Url = (bytes) => {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (value) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

export const encodeShare = async (payload) => {
  const json = new TextEncoder().encode(JSON.stringify(payload));
  return `z${toBase64Url(await pipe(json, new CompressionStream('deflate-raw')))}`;
};

export const decodeShare = async (value) => {
  try {
    const bytes = fromBase64Url(value.slice(1));
    return JSON.parse(new TextDecoder().decode(await pipe(bytes, new DecompressionStream('deflate-raw'))));
  } catch {
    return null;
  }
};

export const shareOrCopy = async ({ url, title }) => {
  if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ url, title });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
    }
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
};
