'use strict';

const { spawn } = require('node:child_process');
const readline = require('node:readline');

/**
 * Closes the Windows Start menu when it opens over the kiosk.
 *
 * Windows will not hand the Windows key to an application, so pressing it
 * opens Start on top of Sukhi Play. Asking for focus back does nothing: Windows
 * refuses a foreground request from a background process, and Start is drawn
 * in a shell band above every application window, topmost or not. Measured on
 * Windows 11, the menu simply stayed.
 *
 * What does work is what a person would do: press Escape. So while the
 * lockdown is on, a PowerShell helper stays running, and when the window loses
 * focus it looks at who took it. Only if that is Start, Search or the quick
 * settings panel does it press Escape and bring the kiosk back. Anything else
 * is left alone, so a real dialog never has keys sent into it.
 *
 * Nothing is installed or changed on the machine. The helper is a child
 * process that ends with the app, and if PowerShell is missing or blocked the
 * app behaves exactly as it did before.
 */

// Processes that own the shell surfaces the Windows key and its combinations
// open. Escape dismisses every one of them.
const SHELL_HOSTS = [
  'StartMenuExperienceHost', 'SearchHost', 'SearchApp',
  'ShellExperienceHost', 'ShellHost'
];

const CSHARP = `
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;

public static class SukhiStart {
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);

  const uint KEYUP = 2;
  static readonly string[] Shell = { ${SHELL_HOSTS.map((n) => `"${n}"`).join(', ')} };

  static string OwnerOf(IntPtr h) {
    uint pid;
    GetWindowThreadProcessId(h, out pid);
    try { return Process.GetProcessById((int)pid).ProcessName; } catch { return "unknown"; }
  }

  static void Tap(byte vk) {
    keybd_event(vk, 0, 0, UIntPtr.Zero);
    keybd_event(vk, 0, KEYUP, UIntPtr.Zero);
  }

  public static string Foreground(long me) {
    IntPtr h = GetForegroundWindow();
    return h == new IntPtr(me) ? "self" : OwnerOf(h);
  }

  public static string Reclaim(long me) {
    IntPtr self = new IntPtr(me);
    IntPtr h = GetForegroundWindow();
    if (h == self) return "already in front";
    string owner = OwnerOf(h);
    if (Array.IndexOf(Shell, owner) < 0) return "left alone: " + owner;

    Tap(0x1B);
    Thread.Sleep(80);
    if (GetForegroundWindow() != self) {
      // Windows lets the process that produced the most recent input set the
      // foreground window, and the Alt tap makes that this one.
      Tap(0x12);
      SetForegroundWindow(self);
      Thread.Sleep(40);
    }
    return "closed " + owner + (GetForegroundWindow() == self ? ", back in front" : ", still not in front");
  }

  public static void TapWindowsKey() { Tap(0x5B); }
}
`;

// Commands arrive one per line as "<id> <verb> <hwnd>", replies go back as
// "<id> <result>", so a slow reply can never be matched to the wrong request.
const SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
${CSHARP}
'@
[Console]::Out.WriteLine('ready')
[Console]::Out.Flush()
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($line -eq $null) { break }
  $p = $line.Split(' ')
  try {
    switch ($p[1]) {
      'reclaim' { $r = [SukhiStart]::Reclaim([Int64]$p[2]) }
      'fg'      { $r = [SukhiStart]::Foreground([Int64]$p[2]) }
      'tapwin'  { [SukhiStart]::TapWindowsKey(); $r = 'pressed' }
      default   { $r = 'unknown command' }
    }
  } catch { $r = 'error ' + $_.Exception.Message }
  [Console]::Out.WriteLine($p[0] + ' ' + $r)
  [Console]::Out.Flush()
}
`;

let child = null;
let ready = false;
let nextId = 1;
const waiting = new Map();

function hwndOf (win) {
  const buf = win.getNativeWindowHandle();
  return buf.length >= 8 ? buf.readBigInt64LE(0).toString() : String(buf.readInt32LE(0));
}

function settleAll () {
  for (const resolve of waiting.values()) resolve(null);
  waiting.clear();
}

function start () {
  if (process.platform !== 'win32' || child) return;
  try {
    child = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-EncodedCommand', Buffer.from(SCRIPT, 'utf16le').toString('base64')
    ], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err) {
    console.warn(`[start menu] helper could not start: ${err.message}`);
    child = null;
    return;
  }

  readline.createInterface({ input: child.stdout }).on('line', (line) => {
    if (line === 'ready') {
      ready = true;
      console.log('[start menu] helper ready');
      return;
    }
    const space = line.indexOf(' ');
    const id = Number(line.slice(0, space));
    const resolve = waiting.get(id);
    if (!resolve) return;
    waiting.delete(id);
    resolve(line.slice(space + 1));
  });
  child.stderr.on('data', (d) => console.warn(`[start menu] ${String(d).trim()}`));

  const gone = () => { child = null; ready = false; settleAll(); };
  child.on('exit', gone);
  child.on('error', (err) => { console.warn(`[start menu] helper failed: ${err.message}`); gone(); });
}

function send (verb, win) {
  return new Promise((resolve) => {
    if (!child || !win || win.isDestroyed()) return resolve(null);
    const id = nextId++;
    waiting.set(id, resolve);
    try {
      child.stdin.write(`${id} ${verb} ${hwndOf(win)}\n`);
    } catch {
      waiting.delete(id);
      return resolve(null);
    }
    // PowerShell takes a moment to compile the helper on first start; a
    // request made before then simply waits in the pipe.
    setTimeout(() => {
      if (waiting.delete(id)) resolve(null);
    }, 5000);
  });
}

function stop () {
  if (!child) return;
  try { child.stdin.end(); } catch { /* already closed */ }
  try { child.kill(); } catch { /* already gone */ }
  child = null;
  ready = false;
  settleAll();
}

module.exports = {
  start,
  stop,
  reclaim: (win) => send('reclaim', win),
  foreground: (win) => send('fg', win),
  tapWindowsKey: (win) => send('tapwin', win),
  isReady: () => ready,
  SHELL_HOSTS
};
