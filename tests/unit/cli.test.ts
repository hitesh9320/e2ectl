import { createProgram } from '../../src/cli.js';

describe('createProgram', () => {
  it('registers the expected command namespaces', () => {
    const program = createProgram();

    expect(program.name()).toBe('e2ectl');
    expect(program.commands.map((command) => command.name())).toEqual([
      'config',
      'node'
    ]);
  });
});
