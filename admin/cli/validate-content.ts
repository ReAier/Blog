import { resolve } from 'node:path';
import { getContentRoot } from '../server/content/paths';
import { validateContentRoot } from '../server/publish/runner';

await validateContentRoot({
  contentRoot: getContentRoot(),
  outputPath: resolve(process.cwd(), '.deploy-redirects.conf'),
});
process.stdout.write('content-validation=ok\n');
