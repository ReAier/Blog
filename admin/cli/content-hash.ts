import { getContentRoot } from '../server/content/paths';
import { hashContentTree } from '../server/publish/snapshot';

process.stdout.write(`${await hashContentTree(getContentRoot())}\n`);
