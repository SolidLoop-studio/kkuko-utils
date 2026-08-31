import { spawnSync } from 'node:child_process';

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const commands = [
  ['supabase', 'start'],
  ['supabase', 'status'],
  ['supabase', 'db', 'reset', '--local'],
  ['supabase', 'test', 'db', '--local'],
];
const stopCommand = ['supabase', 'stop', '--no-backup'];

function runCommand(command) {
  const isWindows = process.platform === 'win32';
  const executable = isWindows ? (process.env.ComSpec ?? 'cmd.exe') : npxCommand;
  const arguments_ = isWindows
    ? ['/d', '/s', '/c', npxCommand, ...command]
    : command;
  const result = spawnSync(executable, arguments_, {
    shell: false,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `${npxCommand} ${command.join(' ')} failed with exit code ${result.status ?? 'unknown'}.`,
    );
  }
}

let firstFailure;

try {
  for (const command of commands) {
    runCommand(command);
  }
} catch (error) {
  firstFailure = error;
} finally {
  try {
    runCommand(stopCommand);
  } catch (error) {
    if (!firstFailure) {
      firstFailure = error;
    }
  }
}

if (firstFailure) {
  throw firstFailure;
}
