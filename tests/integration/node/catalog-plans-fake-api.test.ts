import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('node catalog plans against a fake MyAccount API', () => {
  it('passes the selected OS query and emits sorted deterministic json', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/images/': () => ({
        body: {
          code: 200,
          data: [
            {
              available_inventory_status: true,
              currency: 'INR',
              image: 'Ubuntu-24.04-Distro',
              location: 'Delhi',
              name: 'C3.8GB',
              os: {
                category: 'Ubuntu',
                image: 'Ubuntu-24.04-Distro',
                name: 'Ubuntu',
                version: '24.04'
              },
              plan: 'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi',
              specs: {
                cpu: 4,
                disk_space: 100,
                price_per_month: 2263,
                ram: '8.00',
                series: 'C3',
                sku_name: 'C3.8GB'
              }
            },
            {
              available_inventory_status: true,
              currency: 'INR',
              image: 'Ubuntu-24.04-Distro',
              location: 'Delhi',
              name: 'C3.4GB',
              os: {
                category: 'Ubuntu',
                image: 'Ubuntu-24.04-Distro',
                name: 'Ubuntu',
                version: '24.04'
              },
              plan: 'C3-2vCPU-4RAM-50DISK-C3.4GB-Ubuntu-24.04-Delhi',
              specs: {
                cpu: 2,
                disk_space: 50,
                price_per_month: 1321,
                ram: '4.00',
                series: 'C3',
                sku_name: 'C3.4GB'
              }
            }
          ],
          errors: {},
          message: 'OK'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          '--json',
          'node',
          'catalog',
          'plans',
          '--display-category',
          'Linux Virtual Node',
          '--category',
          'Ubuntu',
          '--os',
          'Ubuntu',
          '--os-version',
          '24.04'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe(
        `${stableStringify({
          action: 'catalog-plans',
          plans: [
            {
              available_inventory_status: true,
              currency: 'INR',
              image: 'Ubuntu-24.04-Distro',
              location: 'Delhi',
              name: 'C3.4GB',
              os: {
                category: 'Ubuntu',
                image: 'Ubuntu-24.04-Distro',
                name: 'Ubuntu',
                version: '24.04'
              },
              plan: 'C3-2vCPU-4RAM-50DISK-C3.4GB-Ubuntu-24.04-Delhi',
              specs: {
                cpu: 2,
                disk_space: 50,
                price_per_month: 1321,
                ram: '4.00',
                series: 'C3',
                sku_name: 'C3.4GB'
              }
            },
            {
              available_inventory_status: true,
              currency: 'INR',
              image: 'Ubuntu-24.04-Distro',
              location: 'Delhi',
              name: 'C3.8GB',
              os: {
                category: 'Ubuntu',
                image: 'Ubuntu-24.04-Distro',
                name: 'Ubuntu',
                version: '24.04'
              },
              plan: 'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi',
              specs: {
                cpu: 4,
                disk_space: 100,
                price_per_month: 2263,
                ram: '8.00',
                series: 'C3',
                sku_name: 'C3.8GB'
              }
            }
          ],
          query: {
            category: 'Ubuntu',
            display_category: 'Linux Virtual Node',
            os: 'Ubuntu',
            osversion: '24.04'
          }
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/images/',
        query: {
          apikey: 'prod-api-key',
          category: 'Ubuntu',
          display_category: 'Linux Virtual Node',
          location: 'Delhi',
          os: 'Ubuntu',
          osversion: '24.04',
          project_id: '46429'
        }
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
