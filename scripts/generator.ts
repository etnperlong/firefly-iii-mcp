import { getToolsFromOpenApi } from './generator/api';

(async () => {
  const tools = await getToolsFromOpenApi('https://api-docs.firefly-iii.org/firefly-iii-6.2.13-v1.yaml');

  console.log(JSON.stringify(tools, null, 2));
})();