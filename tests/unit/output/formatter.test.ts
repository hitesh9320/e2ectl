import {
  formatJson,
  formatProfilesTable,
  summarizeProfiles
} from '../../../src/output/formatter.js';
import type { ConfigFile } from '../../../src/types/config.js';

describe('formatter helpers', () => {
  it('formats JSON deterministically', () => {
    const json = formatJson({
      zebra: 2,
      apple: 1
    });

    expect(json).toBe('{\n  "apple": 1,\n  "zebra": 2\n}\n');
  });

  it('masks secrets in profile summaries and table output', () => {
    const config: ConfigFile = {
      profiles: {
        prod: {
          api_key: '12345678',
          auth_token: 'abcdefgh',
          project_id: '42',
          location: 'Delhi'
        }
      },
      default: 'prod'
    };

    const summary = summarizeProfiles(config);
    const table = formatProfilesTable(summary);

    expect(summary[0]).toMatchObject({
      api_key: '****5678',
      auth_token: '****efgh'
    });
    expect(table).toContain('****5678');
    expect(table).toContain('prod');
  });
});
