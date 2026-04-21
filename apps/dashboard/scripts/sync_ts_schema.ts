import { compileFromFile } from 'json-schema-to-typescript';
import * as fs from 'fs';
import * as path from 'path';

async function generate() {
  const schemaPath = path.join(__dirname, 'investment_brain_schema.json');
  const outputPath = path.join(__dirname, '..', 'src', 'types', 'investment-brain.ts');
  
  try {
    const ts = await compileFromFile(schemaPath, {
      bannerComment: `/* eslint-disable */
/**
 * This file was automatically generated.
 * DO NOT MODIFY IT BY HAND.
 * Instead, modify the source Python Pydantic models in state.py and run 'pnpm run sync:schema'.
 */`,
      style: {
        singleQuote: true,
        tabWidth: 2,
      },
    });

    // Extract the types we care about, which are the properties of StateModels
    // For a cleaner output, we might want to manually extract them or just let the generated file contain StateModels.
    
    // Create directory if it doesn't exist
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, ts);
    console.log(`Successfully generated TypeScript types at ${outputPath}`);
  } catch (error) {
    console.error('Error generating TypeScript schema:', error);
    process.exit(1);
  }
}

generate();
