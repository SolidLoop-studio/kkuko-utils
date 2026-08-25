import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

const scriptPath = join(process.cwd(), 'scripts', 'verify-local-supabase.mjs');

describe('verify-local-supabase', () => {
  let commandDirectory: string;
  let commandLogPath: string;

  beforeEach(() => {
    commandDirectory = mkdtempSync(join(tmpdir(), 'verify-local-supabase-'));
    commandLogPath = join(commandDirectory, 'commands.log');

    if (process.platform === 'win32') {
      writeFileSync(
        join(commandDirectory, 'npx.cmd'),
        `@echo off\r\n` +
          `echo %*>>"%VERIFY_LOCAL_SUPABASE_LOG%"\r\n` +
          `if "%VERIFY_LOCAL_SUPABASE_FAIL_STATUS%"=="1" if "%2"=="status" exit /b 21\r\n` +
          `if "%VERIFY_LOCAL_SUPABASE_FAIL_STOP%"=="1" if "%2"=="stop" exit /b 22\r\n` +
          `exit /b 0\r\n`,
      );
      return;
    }

    writeFileSync(
      join(commandDirectory, 'npx'),
      `#!/usr/bin/env sh\n` +
        `echo "$*" >> "$VERIFY_LOCAL_SUPABASE_LOG"\n` +
        `if [ "$VERIFY_LOCAL_SUPABASE_FAIL_STATUS" = "1" ] && [ "$2" = "status" ]; then exit 21; fi\n` +
        `if [ "$VERIFY_LOCAL_SUPABASE_FAIL_STOP" = "1" ] && [ "$2" = "stop" ]; then exit 22; fi\n`,
      { mode: 0o755 },
    );
  });

  afterEach(() => {
    rmSync(commandDirectory, { force: true, recursive: true });
  });

  function runScript(environment: Partial<NodeJS.ProcessEnv> = {}) {
    try {
      execFileSync(process.execPath, [scriptPath], {
        encoding: 'utf8',
        env: {
          ...process.env,
          ...environment,
          PATH: `${commandDirectory}${delimiter}${process.env.PATH}`,
          VERIFY_LOCAL_SUPABASE_LOG: commandLogPath,
        } as NodeJS.ProcessEnv,
      });

      return { status: 0, stderr: '' };
    } catch (error: unknown) {
      const processError = error as { status?: number; stderr?: string };

      return {
        status: processError.status,
        stderr: processError.stderr ?? '',
      };
    }
  }

  function readCommands() {
    return readFileSync(commandLogPath, 'utf8')
      .trim()
      .split(/\r?\n/);
  }

  it('stops after the first lifecycle failure and still cleans up', () => {
    const result = runScript({ VERIFY_LOCAL_SUPABASE_FAIL_STATUS: '1' });

    expect(result.status).toBe(1);
    expect(readCommands()).toEqual([
      'supabase start',
      'supabase status',
      'supabase stop --no-backup',
    ]);
  });

  it('fails a successful lifecycle when cleanup fails', () => {
    const result = runScript({ VERIFY_LOCAL_SUPABASE_FAIL_STOP: '1' });

    expect(result.status).toBe(1);
    expect(readCommands()).toEqual([
      'supabase start',
      'supabase status',
      'supabase db reset --local',
      'supabase test db --local',
      'supabase stop --no-backup',
    ]);
  });

  it('preserves the first lifecycle failure when cleanup also fails', () => {
    const result = runScript({
      VERIFY_LOCAL_SUPABASE_FAIL_STATUS: '1',
      VERIFY_LOCAL_SUPABASE_FAIL_STOP: '1',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('exit code 21');
    expect(readCommands()).toEqual([
      'supabase start',
      'supabase status',
      'supabase stop --no-backup',
    ]);
  });
});
