import {join, resolve} from 'path';

export const repoDir = resolve(__dirname, '..');
const testFilesDir = join(repoDir, 'test-files');

export const testFiles = {
    singleModel: join(testFilesDir, 'example-schemas', 'single-model.prisma'),
};
