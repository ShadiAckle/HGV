import { getWorkspaceClient } from '@databricks/appkit';

const wsClient = getWorkspaceClient({});

async function run() {
  try {
    console.log('Fetching serving endpoints (paginated)...');
    const endpointsIter = wsClient.servingEndpoints.list();
    let count = 0;
    for await (const ep of endpointsIter) {
      count++;
      console.log(`- Name: ${ep.name}, Creator: ${ep.creator}, State: ${JSON.stringify(ep.state)}`);
    }
    console.log(`Total endpoints found: ${count}`);
  } catch (err: any) {
    console.error('Failed to list endpoints:', err.message || err);
  }
}
run();
