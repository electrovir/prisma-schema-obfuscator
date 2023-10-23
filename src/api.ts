import {readFile, writeFile} from 'fs/promises';
import {obfuscateSchemaText} from './obfuscate-schema-text';
export {obfuscateSchemaText} from './obfuscate-schema-text';

/** Read a Prisma schema, obfuscate it and return the resulting string. */
export async function obfuscateSchema(
    /** Path to the Prisma schema file that should be read. */ filePath: string,
): Promise<string> {
    const schemaContents: string = (await readFile(filePath)).toString();
    return obfuscateSchemaText(schemaContents);
}

/** Read the given input Prisma schema and write its obfuscated output to the given output file. */
export async function writeObfuscatedSchema({
    inputSchemaPath,
    obfuscatedOutputPath,
}: {
    /** Path to the original Prisma schema file that is to be obfuscated. */
    inputSchemaPath: string;
    /** Path to write the obfuscated schema to. */
    obfuscatedOutputPath: string;
}) {
    const obfuscated = await obfuscateSchema(inputSchemaPath);
    await writeFile(obfuscatedOutputPath, obfuscated);
}
