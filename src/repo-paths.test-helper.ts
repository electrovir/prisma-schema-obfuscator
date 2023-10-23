import {join} from 'path';

const testFilesDir = 'test-files';

export const testFiles = {
    singleModel: join(testFilesDir, 'example-schemas', 'single-model.prisma'),
    singleEnum: join(testFilesDir, 'example-schemas', 'single-enum.prisma'),
};
