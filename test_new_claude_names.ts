import { getWorkspaceClient } from '@databricks/appkit';

const wsClient = getWorkspaceClient({});
const names = [
  'databricks-claude-sonnet-4-6',
  'databricks-claude-sonnet-4-5',
  'databricks-claude-haiku-4-5',
  'databricks-claude-opus-4-1',
  'databricks-claude-sonnet-4'
];

async function run() {
  for (const name of names) {
    try {
      console.log(`Querying ${name}...`);
      const res = await wsClient.servingEndpoints.query({
        name,
        messages: [{ role: 'user', content: 'Are you online Claude?' }]
      } as any);
      console.log(`Success with ${name}! Response:`, JSON.stringify(res, null, 2));
      return;
    } catch (err: any) {
      console.log(`Failed for ${name}:`, err.message || err);
    }
  }
}
run();
