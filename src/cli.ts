#!/usr/bin/env node

import {log} from '@augment-vir/node-js';
import {existsSync} from 'fs';
import parseArgs from 'minimist';
import {obfuscateSchema, writeObfuscatedSchema} from './api';

function extractArgs(allArgs: string[]): {inFile: string; outFile: string | undefined} {
    const args = parseArgs(allArgs);

    const [
        inFile,
        outFile,
    ] = args._;

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

async function main() {
    const args = extractArgs(process.argv);

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

main();
