import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from './parse.js';

type InputCase = { id: string; markdown: string };

const inputDir = process.env.MAKEFUN_INPUT_DIR || '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const source = readFileSync(resolve(inputDir, 'cases.json'), 'utf8');
const inputs: InputCase[] = JSON.parse(source);
const rendered = new Array<string>(inputs.length);

for (let index = 0; index < inputs.length; index += 1) {
  rendered[index] = parse(inputs[index].markdown);
}

writeFileSync(resolve(outputDir, 'html.json'), JSON.stringify(rendered), 'utf8');
