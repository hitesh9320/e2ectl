import { Command } from 'commander';
import { resolveCredentials } from '../client/auth.js';
import {
  formatJson,
  formatNodeCreateResult,
  formatNodeDetails,
  formatNodesTable
} from '../output/formatter.js';
import type { CliRuntime } from '../runtime.js';
import type { NodeCreateRequest } from '../types/node.js';
import { CliError, EXIT_CODES } from '../utils/errors.js';

interface GlobalOptions {
  json?: boolean;
}

interface NodeAliasOptions {
  alias?: string;
}

interface NodeCreateCommandOptions extends NodeAliasOptions {
  image: string;
  name: string;
  plan: string;
}

interface NodeDeleteCommandOptions extends NodeAliasOptions {
  force?: boolean;
}

const DEFAULT_NODE_CREATE_REQUEST = {
  backups: false,
  default_public_ip: false,
  disable_password: true,
  enable_bitninja: false,
  is_ipv6_availed: false,
  is_saved_image: false,
  label: 'default',
  number_of_instances: 1,
  ssh_keys: [],
  start_scripts: []
} as const satisfies Omit<NodeCreateRequest, 'image' | 'name' | 'plan'>;

export function buildNodeCommand(runtime: CliRuntime): Command {
  const command = new Command('node').description('Manage MyAccount nodes.');

  command
    .command('list')
    .description(
      'List nodes for the selected profile or environment credentials.'
    )
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .action(async (options: NodeAliasOptions, commandInstance: Command) => {
      const client = await createNodeClient(runtime, options.alias);
      const response = await client.listNodes();

      if (commandInstance.optsWithGlobals<GlobalOptions>().json ?? false) {
        runtime.stdout.write(
          formatJson({
            action: 'list',
            nodes: response.data,
            total_count: response.total_count ?? null,
            total_page_number: response.total_page_number ?? null
          })
        );
        return;
      }

      runtime.stdout.write(
        response.data.length === 0
          ? 'No nodes found.\n'
          : `${formatNodesTable(response.data)}\n`
      );
    });

  command
    .command('create')
    .description('Create a new node with the prototype defaults.')
    .requiredOption('--name <name>', 'Node name.')
    .requiredOption('--plan <plan>', 'MyAccount node plan identifier.')
    .requiredOption('--image <image>', 'MyAccount image identifier.')
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .action(
      async (options: NodeCreateCommandOptions, commandInstance: Command) => {
        const client = await createNodeClient(runtime, options.alias);
        const request = buildNodeCreateRequest(options);
        const response = await client.createNode(request);

        if (commandInstance.optsWithGlobals<GlobalOptions>().json ?? false) {
          runtime.stdout.write(
            formatJson({
              action: 'create',
              created: response.data.total_number_of_node_created,
              nodes: response.data.node_create_response,
              requested: response.data.total_number_of_node_requested
            })
          );
          return;
        }

        runtime.stdout.write(`${formatNodeCreateResult(response.data)}\n`);
      }
    );

  command
    .command('get <nodeId>')
    .description('Get details for a node.')
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .action(
      async (
        nodeId: string,
        options: NodeAliasOptions,
        commandInstance: Command
      ) => {
        assertNodeId(nodeId);
        const client = await createNodeClient(runtime, options.alias);
        const response = await client.getNode(nodeId);

        if (commandInstance.optsWithGlobals<GlobalOptions>().json ?? false) {
          runtime.stdout.write(
            formatJson({
              action: 'get',
              node: response.data
            })
          );
          return;
        }

        runtime.stdout.write(`${formatNodeDetails(response.data)}\n`);
      }
    );

  command
    .command('delete <nodeId>')
    .description('Delete a node.')
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .option('--force', 'Skip the interactive confirmation prompt.')
    .action(
      async (
        nodeId: string,
        options: NodeDeleteCommandOptions,
        commandInstance: Command
      ) => {
        assertNodeId(nodeId);
        const globalOptions = commandInstance.optsWithGlobals<GlobalOptions>();

        if (!(options.force ?? false)) {
          assertCanDelete(runtime);
          const confirmed = await runtime.confirm(
            `Delete node ${nodeId}? This cannot be undone.`
          );

          if (!confirmed) {
            writeDeleteCancelled(runtime, globalOptions, nodeId);
            return;
          }
        }

        const client = await createNodeClient(runtime, options.alias);
        const response = await client.deleteNode(nodeId);

        if (globalOptions.json ?? false) {
          runtime.stdout.write(
            formatJson({
              action: 'delete',
              cancelled: false,
              message: response.message,
              node_id: Number(nodeId)
            })
          );
          return;
        }

        runtime.stdout.write(`Deleted node ${nodeId}.\n`);
      }
    );

  command.action(() => {
    command.outputHelp();
  });

  return command;
}

async function createNodeClient(runtime: CliRuntime, alias?: string) {
  const config = await runtime.store.read();
  const credentials = resolveCredentials({
    ...(alias === undefined ? {} : { alias }),
    config,
    configPath: runtime.store.configPath
  });

  return runtime.createApiClient(credentials);
}

function assertCanDelete(runtime: CliRuntime): void {
  if (runtime.isInteractive) {
    return;
  }

  throw new CliError(
    'Deleting a node requires confirmation in an interactive terminal.',
    {
      code: 'CONFIRMATION_REQUIRED',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Re-run the command with --force to skip the prompt.'
    }
  );
}

function assertNodeId(nodeId: string): void {
  if (!/^\d+$/.test(nodeId)) {
    throw new CliError('Node ID must be numeric.', {
      code: 'INVALID_NODE_ID',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Pass the numeric node id as the first argument.'
    });
  }
}

function buildNodeCreateRequest(
  options: NodeCreateCommandOptions
): NodeCreateRequest {
  return {
    ...DEFAULT_NODE_CREATE_REQUEST,
    image: normalizeRequiredString(options.image, 'Image', '--image'),
    name: normalizeRequiredString(options.name, 'Name', '--name'),
    plan: normalizeRequiredString(options.plan, 'Plan', '--plan')
  };
}

function normalizeRequiredString(
  value: string,
  label: string,
  flag: string
): string {
  const normalized = value.trim();
  if (normalized.length > 0) {
    return normalized;
  }

  throw new CliError(`${label} cannot be empty.`, {
    code: 'EMPTY_REQUIRED_VALUE',
    exitCode: EXIT_CODES.usage,
    suggestion: `Pass a non-empty value with ${flag}.`
  });
}

function writeDeleteCancelled(
  runtime: CliRuntime,
  globalOptions: GlobalOptions,
  nodeId: string
): void {
  if (globalOptions.json ?? false) {
    runtime.stdout.write(
      formatJson({
        action: 'delete',
        cancelled: true,
        node_id: Number(nodeId)
      })
    );
    return;
  }

  runtime.stdout.write('Deletion cancelled.\n');
}
