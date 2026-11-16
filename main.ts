// A best-game-01 entry (Node 22, standard library only): the game lives in this directory's
// game/ folder (static files a desktop browser loads offline), and this program hands it in. It
// copies game/ and screenshots/ from beside this file into the output directory named by
// MAKEFUN_OUTPUT_DIR (default /output) and writes dossier.json there — the summary the judge
// reads — via the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const tag = 'deep-drop';

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others
// refuse an entry the scorer would refuse (more than 4 screenshots or one over 256 KiB; more than
// 993 files in game/ or 48 MiB of game files, or a path under game/ over 1000 bytes).
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function log(stage: string, dest: string): void {
  console.log(`${tag}: ${stage} -> ${dest}`);
}

// Copy one directory into the output, first dropping anything a previous run left there so
// stale files never linger in the handed-over entry.
function copyDir(src: string, dest: string): void {
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
}

// How many plain files a directory holds, recursively (0 when it is missing).
function countFiles(dir: string): number {
  let n = 0;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) n += countFiles(join(dir, entry.name));
      else if (entry.isFile()) n += 1;
    }
  } catch {
    return 0;
  }
  return n;
}

function main(): void {
  log('prep', out);
  mkdirSync(out, { recursive: true });

  const gameDest = join(out, 'game');
  log('copy game', gameDest);
  copyDir(join(here, 'game'), gameDest);

  const shotsDest = join(out, 'screenshots');
  log('copy screenshots', shotsDest);
  const shotsSrc = join(here, 'screenshots');
  if (existsSync(shotsSrc)) copyDir(shotsSrc, shotsDest);
  else mkdirSync(shotsDest, { recursive: true });

  const dossierPath = join(out, 'dossier.json');
  log('dossier', dossierPath);
  writeFileSync(dossierPath, buildDossier(out, CAPS));

  const gameFiles = countFiles(gameDest);
  const shots = countFiles(shotsDest);
  console.log(
    `${tag}: handed over ${gameFiles} game file${gameFiles === 1 ? '' : 's'} and ${shots} screenshot${shots === 1 ? '' : 's'}`,
  );
}

main();
