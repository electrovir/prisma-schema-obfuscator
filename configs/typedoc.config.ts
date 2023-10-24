import {join, resolve} from 'path';
import type {TypeDocOptions} from 'typedoc';
import {baseTypedocConfig} from 'virmator/dist/compiled-base-configs/base-typedoc';

const repoRoot = resolve(__dirname, '..');
const apiFile = join(repoRoot, 'src', 'api.ts');

export const typeDocConfig: Partial<TypeDocOptions> = {
    ...baseTypedocConfig,
    out: join(repoRoot, 'dist-docs'),
    entryPoints: [
        apiFile,
    ],
    intentionallyNotExported: ['WithLocation'],
};
