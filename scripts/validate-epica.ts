import Ajv from 'ajv';
import * as yaml from 'js-yaml';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ajv = new Ajv({ allErrors: true });
const schema = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../.claude/schemas/epica.schema.json'),
    'utf8',
  ),
);
const validate = ajv.compile(schema);

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Uso: tsx scripts/validate-epica.ts <ruta-al-yaml>');
  process.exit(1);
}

const input = yaml.load(fs.readFileSync(inputPath, 'utf8'));
const valid = validate(input);

if (!valid) {
  console.error('Epica invalida — errores encontrados:');
  validate.errors?.forEach((err) => {
    console.error(`  - ${err.instancePath || 'raiz'}: ${err.message}`);
  });
  process.exit(1);
}

console.log('Epica valida — lista para el Agent Team');
