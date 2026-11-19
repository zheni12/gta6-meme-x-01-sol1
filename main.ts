// Entry program for make.fun's "Post a GTA 6 meme on X" bounty
// (gta6-meme-x-01). Node 22, standard library only, no network.
//
// What is being entered is a public post on X: a GTA 6 meme, published by
// @Ddona9052, whose text names @makefunai and carries the account's play
// code for this bounty. This repository is the entry's paper trail, and
// this program is its packager. When the house runs it, it assembles the
// entry package in the output directory:
//
//   * POST.json is checked, then copied across byte-for-byte. The house
//     reads that file to find the post, so its bytes are never rewritten
//     or re-serialised here — the parsed value only validates the shape.
//   * caption.txt (the post's text) and meme.webp (the post's picture)
//     are staged beside it when they are present, so the package can be
//     read on its own.
//
// Nothing here reads a clock, rolls dice or touches the network: the
// package is a pure function of the repository's files, and two runs
// produce byte-identical output.
//
// In the grading container the repository is /bot and the package goes
// to /output. Outside it, point the two environment variables at local
// directories instead:
//
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const repoDir = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const packageDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// A post address as X gives it: scheme, host, handle, /status/, numeric id.
// Query strings and fragments are tolerated; anything else is not a post.
const POST_ADDRESS = /^https:\/\/(www\.|mobile\.)?(x\.com|twitter\.com)\/[^/?#\s]+\/status\/[0-9]+([?#].*)?$/;

function die(reason: string): never {
  console.error(`gta6-meme-x-01-sol1: error: ${reason}`);
  process.exit(1);
}

// Load POST.json from the repository root and return the address it
// names. Any defect — unreadable file, invalid JSON, wrong shape — is
// fatal: an entry that cannot name its post is not an entry.
function postAddress(): string {
  const file = join(repoDir, 'POST.json');
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (cause) {
    die(`cannot read ${file}: ${(cause as Error).message}`);
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (cause) {
    die(`POST.json is not valid JSON: ${(cause as Error).message}`);
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    die('POST.json must hold a JSON object of the form {"url": "..."}');
  }
  const url = (data as Record<string, unknown>).url;
  if (typeof url !== 'string' || !POST_ADDRESS.test(url)) {
    die('POST.json "url" must be a post address: https://x.com/<handle>/status/<id>');
  }
  // The pattern above already pins the shape; this second, explicit pass
  // pins the host itself, so a future loosening of the pattern can never
  // quietly let a look-alike domain through.
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    die(`POST.json "url" is not a parseable URL: ${url}`);
  }
  if (!/^(www\.|mobile\.)?(x\.com|twitter\.com)$/.test(host)) {
    die(`POST.json "url" host must be x.com or twitter.com, got "${host}"`);
  }
  return url;
}

// Until the real post exists, POST.json carries a placeholder id — one
// digit repeated (1111111111111111111). Staging still proceeds, but the
// placeholder is shouted about on stderr: the house would refuse such a
// package, and nobody should ever submit one by accident.
function shoutIfPlaceholder(url: string): void {
  const id = /\/status\/([0-9]+)/.exec(url)?.[1] ?? '';
  if (/^([0-9])\1*$/.test(id) && id.length > 1) {
    console.error(
      `gta6-meme-x-01-sol1: *** WARNING *** POST.json names a PLACEHOLDER post ` +
        `(id ${id}). Replace it with the real post's address before submitting.`,
    );
  }
}

// Copy one file of the package into the output directory. Returns the
// staged file's size in bytes, or null when an optional file is absent.
// A required file that is absent is fatal; so is a present file smaller
// than minBytes — a truncated or placeholder stub is worse than none.
function stageOne(name: string, required: boolean, minBytes = 0): number | null {
  const source = join(repoDir, name);
  if (!existsSync(source)) {
    if (required) die(`required file ${name} is missing from ${repoDir}`);
    return null;
  }
  const size = statSync(source).size;
  if (size < minBytes) {
    die(`${name} is only ${size} bytes (minimum ${minBytes}): refusing to stage a stub`);
  }
  copyFileSync(source, join(packageDir, name));
  return size;
}

function build(): void {
  const url = postAddress();
  shoutIfPlaceholder(url);
  mkdirSync(packageDir, { recursive: true });
  const staged: string[] = [];
  const note = (name: string, size: number | null): void => {
    if (size !== null) staged.push(`${name} (${size} bytes)`);
  };
  note('POST.json', stageOne('POST.json', true));
  note('caption.txt', stageOne('caption.txt', false));
  // The meme is the entry's picture: when it is there it must be a real
  // image, not a stub — anything under a kilobyte cannot be one.
  note('meme.webp', stageOne('meme.webp', false, 1000));
  console.log(`gta6-meme-x-01-sol1: staged ${staged.join(', ')} -> ${packageDir}`);
}

build();
