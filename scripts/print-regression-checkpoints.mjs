import fs from 'node:fs';
import path from 'node:path';
const filePath = path.join(process.cwd(), 'docs', 'regression-checkpoints.md');
console.log(fs.readFileSync(filePath, 'utf8'));
