import fs from 'fs';
import path from 'path';

const routesDir = './src/routes';
const registryDir = './src/prompts/registry';

fs.mkdirSync(registryDir, { recursive: true });

function processFile(filename, agentId, profileName, constName, depth) {
  const filePath = path.join(routesDir, filename);
  let content = fs.readFileSync(filePath, 'utf8');
  const regex = new RegExp(`(?:export\\s+)?const\\s+${constName}\\s*=\\s*\`([\\s\\S]*?)\`;`);
  const match = content.match(regex);
  
  if (!match) {
    console.log(`No match for ${constName} in ${filePath}`);
    return;
  }
  
  const templateContent = match[1];
  
  const registryCode = `import { PromptProfile } from '../types';

export const ${profileName}: PromptProfile = {
  id: '${agentId}-system',
  version: '1.0.0',
  name: '${agentId.charAt(0).toUpperCase() + agentId.slice(1)} System Prompt',
  description: 'AI-04 Extracted',
  template: \`${templateContent}\`
};
`;
  
  fs.writeFileSync(path.join(registryDir, `${agentId}.ts`), registryCode);
  
  let newContent = content.replace(match[0], '');
  newContent = newContent.replace(new RegExp(constName, 'g'), `${profileName}.template`);
  
  const importPath = depth === 2 ? '../../prompts' : '../prompts';
  const importStatement = `import { ${profileName} } from '${importPath}';\n`;
  newContent = newContent.replace(/(import .*;\n)+/, (m) => m + importStatement);
  newContent = newContent.replace(/\/\/\s*── 系統 Prompt ─────────────────────(.*)\n\n/, '');
  fs.writeFileSync(filePath, newContent);
  console.log(`Processed ${filename}`);
}

processFile('zora.ts', 'zora', 'zoraSystemPrompt', 'ZORA_SYSTEM_PROMPT', 1);
processFile('scout.ts', 'scout', 'scoutSystemPrompt', 'SCOUT_SYSTEM_PROMPT', 1);
processFile('lex.ts', 'lex', 'lexSystemPrompt', 'LEX_SYSTEM_PROMPT', 1);
processFile('guardian.ts', 'guardian', 'guardianSystemPrompt', 'GUARDIAN_SYSTEM_PROMPT', 1);
processFile('finance.ts', 'finance', 'financeSystemPrompt', 'FINANCE_SYSTEM_PROMPT', 1);
processFile('interior.ts', 'interior', 'interiorSystemPrompt', 'INTERIOR_SYSTEM_PROMPT', 1);
processFile('estimator.ts', 'estimator', 'estimatorSystemPrompt', 'ESTIMATOR_SYSTEM_PROMPT', 1);
processFile('bim.ts', 'bim', 'bimSystemPrompt', 'BIM_SYSTEM_PROMPT', 1);
processFile('regulation.ts', 'regulation', 'regulationSystemPrompt', 'REGULATION_SYSTEM_PROMPT', 1);

// Accountant specific
const accPromptsPath = path.join(routesDir, 'accountant/prompts.ts');
const accContent = fs.readFileSync(accPromptsPath, 'utf8');

const regexAcc = new RegExp(`(?:export\\s+)?const\\s+ACCOUNTANT_SYSTEM_PROMPT\\s*=\\s*\`([\\s\\S]*?)\`;`);
const regexTax = new RegExp(`(?:export\\s+)?const\\s+TAXPLAN_SYSTEM_PROMPT\\s*=\\s*\`([\\s\\S]*?)\`;`);

const matchAcc = accContent.match(regexAcc);
const matchTax = accContent.match(regexTax);

const accRegistryCode = `import { PromptProfile } from '../types';

export const accountantSystemPrompt: PromptProfile = {
  id: 'accountant-system',
  version: '1.0.0',
  name: 'Accountant System Prompt',
  description: 'AI-04 Extracted',
  template: \`${matchAcc[1]}\`
};

export const taxplanSystemPrompt: PromptProfile = {
  id: 'taxplan-system',
  version: '1.0.0',
  name: 'Taxplan System Prompt',
  description: 'AI-04 Extracted',
  template: \`${matchTax[1]}\`
};
`;

fs.writeFileSync(path.join(registryDir, 'accountant.ts'), accRegistryCode);

// now replace usage in accountant.ts
const accRoutePath = path.join(routesDir, 'accountant.ts');
let accRouteContent = fs.readFileSync(accRoutePath, 'utf8');
accRouteContent = accRouteContent.replace(/import \{ ACCOUNTANT_SYSTEM_PROMPT \} from '\.\/prompts';\n/, '');
accRouteContent = accRouteContent.replace(/ACCOUNTANT_SYSTEM_PROMPT/g, 'accountantSystemPrompt.template');
const accImportStatement = `import { accountantSystemPrompt } from '../prompts';\n`;
accRouteContent = accRouteContent.replace(/(import .*;\n)+/, (m) => m + accImportStatement);
fs.writeFileSync(accRoutePath, accRouteContent);

// also replace in accountant/index.ts
const accIndexPath = path.join(routesDir, 'accountant/index.ts');
let accIndexContent = fs.readFileSync(accIndexPath, 'utf8');
accIndexContent = accIndexContent.replace(/export \{ ACCOUNTANT_SYSTEM_PROMPT, TAXPLAN_SYSTEM_PROMPT \} from '\.\/prompts';\n/, '');
fs.writeFileSync(accIndexPath, accIndexContent);

// delete accountant/prompts.ts
fs.unlinkSync(accPromptsPath);

// Generate index.ts
let indexCode = `export * from './types';\n`;
const agents = ['zora', 'scout', 'lex', 'guardian', 'finance', 'interior', 'estimator', 'bim', 'regulation', 'accountant'];
for (const agent of agents) {
  indexCode += `export * from './registry/${agent}';\n`;
}
fs.writeFileSync(path.join('./src/prompts/index.ts'), indexCode);
console.log('Done!');
