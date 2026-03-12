#!/usr/bin/env node
import { formatError, isCliError } from '../core/errors.js';
import { createProgram } from './program.js';
import { createRuntime } from './runtime.js';

async function main(): Promise<void> {
  const program = createProgram(createRuntime());
  const json = process.argv.includes('--json');

  try {
    await program.parseAsync(process.argv);
  } catch (error: unknown) {
    process.stderr.write(formatError(error, { json }));
    process.exitCode = isCliError(error) ? error.exitCode : 1;
  }
}

void main();
