#!/usr/bin/env node

import {log} from '@augment-vir/node-js';
import {existsSync} from 'fs';
import {basename} from 'path';
import {obfuscateSchema, writeObfuscatedSchema} from './api';

const thisFileName = basename(__filename);
const binName = 'prisma-obf';

function removeIrrelevantInitialArgs(rawArgs: ReadonlyArray<string>): string[] {
    const thisFileIndex = rawArgs.findIndex((arg) => {
        const baseArgName = basename(arg);
        return baseArgName === thisFileName || baseArgName === binName;
    });
    if (thisFileIndex === -1) {
        return [...rawArgs];
    } else {
        return rawArgs.slice(thisFileIndex + 1);
    }
}

function extractArgs(rawArgs: ReadonlyArray<string>): {
    inFile: string;
    outFile: string | undefined;
} {
    const relevantArgs = removeIrrelevantInitialArgs(rawArgs);

    const [
        inFile,
        outFile,
    ] = relevantArgs;

    if (!inFile) {
        throw new Error(`No input file found.`);
    }
    if (!existsSync(inFile)) {
        throw new Error(`input file '${inFile}' does not exist`);
    }

    return {
        inFile,
        outFile,
    };
}

export async function runCli(rawArgs: ReadonlyArray<string>): Promise<void> {
    const args = extractArgs(rawArgs);

    if (args.outFile) {
        log.faint(`Reading '${args.inFile}'`);
        await writeObfuscatedSchema({
            inputSchemaPath: args.inFile,
            obfuscatedOutputPath: args.outFile,
        });
        log.info(`Wrote to '${args.outFile}'`);
    } else {
        process.stdout.write(await obfuscateSchema(args.inFile));
    }
}

if (require.main === module) {
    runCli(process.argv);
}
