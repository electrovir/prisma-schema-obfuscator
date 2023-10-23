import {assert} from 'chai';
import {existsSync} from 'fs';
import {readFile, unlink} from 'fs/promises';
import {runPackageCli} from 'test-as-package';
import {expectationCases} from 'test-established-expectations';
import {runCli} from './cli';
import {testFiles} from './repo-paths.test-helper';

async function runCliTester(prismaSchemaPath: string) {
    const printedCommandResult = await runPackageCli({commandArgs: [prismaSchemaPath]});
    if (!printedCommandResult.error) {
        const outputPath = `${prismaSchemaPath}.out`;
        try {
            assert.isFalse(
                existsSync(outputPath),
                `output file should not have been written yet: '${outputPath}'`,
            );
            await runPackageCli({
                commandArgs: [
                    prismaSchemaPath,
                    outputPath,
                ],
                rejectOnError: true,
            });
            const writtenContents = (await readFile(outputPath)).toString();

            assert.strictEqual(printedCommandResult.stdout, writtenContents);
        } finally {
            await unlink(outputPath);
        }
    }

    return printedCommandResult;
}

describe(runCli.name, () => {
    expectationCases(
        runCliTester,
        {
            testKey: runCli.name,
        },
        [
            {
                it: 'obfuscates a single model',
                input: testFiles.singleModel,
            },
            {
                it: 'obfuscates a single enum',
                input: testFiles.singleEnum,
            },
        ],
    );
});
