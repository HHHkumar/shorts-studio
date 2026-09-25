// ---------------------------------------------------------------------------
// The two ports the studio needs, checked before it starts.
//
//   node tools/ports.mjs check   run automatically before `npm start`
//   node tools/ports.mjs free    `npm run free-ports`
//
// `npm start` launches two programs - the helper on 3030 and the web app on
// 5173 - and a window closed with the X can leave both running, invisibly,
// still holding their ports. The next start then died with a Vite stack trace
// and two red exits, which says nothing about what to do.
//
// `check` answers the question before anything is launched: which port, held
// by what, and the one command that fixes it. `free` stops only this studio's
// own leftovers - a process is only ever stopped if its command line is Vite
// or the helper, running from THIS folder. Anything else on the port is named
// and left alone: it is somebody else's program, and stopping it is their call.
// ---------------------------------------------------------------------------

import net from 'node:net';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HELPER = Number(process.env.HELPER_PORT || 3030);
const APP = 5173;
const PORTS = [
  { port: APP, name: 'web app' },
  { port: HELPER, name: 'helper server' },
];

/** Busy if anything is listening on it, on either the IPv4 or the IPv6 loopback. */
function isBusy(port) {
  const tryHost = (host) => new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => resolve(err && err.code === 'EADDRINUSE'));
    server.once('listening', () => server.close(() => resolve(false)));
    server.listen(port, host);
  });
  // ::1 can be missing on a machine with IPv6 off; that counts as free, not busy.
  return Promise.all([tryHost('127.0.0.1'), tryHost('::1')]).then((r) => r.some(Boolean));
}

/** What is listening on a port: [{ pid, command }]. Windows only; elsewhere, nothing. */
function holders(port) {
  if (process.platform !== 'win32') return [];
  let table = '';
  try {
    table = execFileSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' })
      + execFileSync('netstat', ['-ano', '-p', 'TCPv6'], { encoding: 'utf8' });
  } catch {
    return [];
  }
  const pids = new Set();
  for (const line of table.split(/\r?\n/)) {
    const cols = line.trim().split(/\s+/);
    // Proto  Local Address  Foreign Address  State  PID
    if (cols.length >= 5 && cols[3] === 'LISTENING' && cols[1].endsWith(':' + port)) pids.add(Number(cols[4]));
  }
  return [...pids].filter((pid) => pid > 0).map((pid) => ({ pid, command: commandLine(pid) }));
}

function commandLine(pid) {
  try {
    return execFileSync('powershell', [
      '-NoProfile', '-Command',
      '(Get-CimInstance Win32_Process -Filter "ProcessId = ' + pid + '").CommandLine',
    ], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/**
 * Is this one of ours? Vite or the helper, started from this folder. A helper
 * is started as a relative `server/index.mjs`, so its folder is not in its
 * command line - it is recognised by its script alone. The one thing that could
 * be mistaken for it is ANOTHER project also running server/index.mjs on one of
 * these two ports; rare enough to accept, and `free` names every process it
 * stops, so it never happens silently.
 */
export function isOurs(command) {
  const c = String(command || '').replace(/\//g, '\\').toLowerCase();
  const root = ROOT.replace(/\//g, '\\').toLowerCase();
  const vite = c.includes(root + '\\node_modules') && c.includes('vite');
  const helper = /(^|[\s"\\])server\\index\.mjs/.test(c);
  return vite || helper;
}

const describe = (command) => (isOurs(command)
  ? 'an older Shorts Studio that is still running'
  : 'another program' + (command ? ': ' + command.slice(0, 120) : ''));

async function check() {
  const busy = [];
  for (const p of PORTS) if (await isBusy(p.port)) busy.push(p);
  if (!busy.length) return;

  console.error('');
  console.error('  Shorts Studio cannot start: a port it needs is already in use.');
  console.error('');
  let ours = true;
  for (const p of busy) {
    const found = holders(p.port);
    if (!found.length) {
      console.error('  Port ' + p.port + ' (the ' + p.name + ') is in use.');
      ours = false;
      continue;
    }
    for (const h of found) {
      console.error('  Port ' + p.port + ' (the ' + p.name + ') is held by ' + describe(h.command) + '  [process ' + h.pid + ']');
      if (!isOurs(h.command)) ours = false;
    }
  }
  console.error('');
  if (ours) {
    console.error('  Usually that is the tool from last time, left running when its window was closed.');
    console.error('  If it is not open in another window, stop it and start again:');
    console.error('');
    console.error('      npm run free-ports');
    console.error('      npm start');
  } else {
    console.error('  Something other than Shorts Studio is using that port. Close that program,');
    console.error('  or see "When a port stays stuck" in the user guide.');
  }
  console.error('');
  process.exit(1);
}

async function free() {
  // Every holder is identified BEFORE anything is stopped. npm start ties its
  // two halves together, so stopping the web app takes the helper down with
  // it - and a process looked up after it has gone has no command line left,
  // which made the helper look like somebody else's program.
  const found = PORTS.flatMap((p) => holders(p.port).map((h) => ({ ...p, ...h })));
  if (!found.length) {
    console.log('  Both ports are already free.');
    return;
  }

  let stopped = 0;
  for (const h of found) {
    if (!isOurs(h.command)) {
      console.log('  Leaving port ' + h.port + ' alone - it belongs to ' + describe(h.command) + '  [process ' + h.pid + ']');
      continue;
    }
    try {
      execFileSync('taskkill', ['/PID', String(h.pid), '/F'], { stdio: 'ignore' });
      console.log('  Stopped the old ' + h.name + ' on port ' + h.port + '  [process ' + h.pid + ']');
    } catch {
      // Most often it went down with its other half a moment ago.
      console.log('  The old ' + h.name + ' on port ' + h.port + ' had already stopped  [process ' + h.pid + ']');
    }
    stopped++;
  }
  if (stopped) console.log('\n  Done. Run  npm start  now.');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const mode = process.argv[2];
  if (mode === 'free') await free();
  else await check();
}
