#!/usr/bin/env node

import {log} from '@augment-vir/node-js';
import {extractRelevantArgs} from 'cli-args-vir';
import {existsSync} from 'fs';
import {obfuscateSchema, writeObfuscatedSchema} from './api';

const binName = 'prisma-obf';

function extractArgs(rawArgs: ReadonlyArray<string>): {
    inFile: string;
    outFile: string | undefined;
} {
    const relevantArgs = extractRelevantArgs({
        rawArgs,
        binName,
        fileName: __filename,
        errorIfNotFound: true,
    });

    const [
        inFile,
        outFile,
    ] = relevantArgs;

    if (!inFile) {
        throw new Error(`No input file found.`);
    }
    if (!existsSync(inFile)) {
        throw new Error(`Given input file does not exist: '${inFile}'`);
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
