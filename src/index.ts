#!/usr/bin/env node
import { createProgram } from './cli.js';
import { createRuntime } from './runtime.js';
import { formatError, isCliError } from './utils/errors.js';

async function main(): Promise<void> {
  const program = createProgram(createRuntime());

  try {
    await program.parseAsync(process.argv);
  } catch (error: unknown) {
    process.stderr.write(formatError(error));
    process.exitCode = isCliError(error) ? error.exitCode : 1;
  }
}

void main();
