const {baseConfig} = require('virmator/base-configs/base-cspell.js');

module.exports = {
    ...baseConfig,
    ignorePaths: [
        ...baseConfig.ignorePaths,
        '**/.not-committed/',
    ],
    words: [
        ...baseConfig.words,
        'autoincrement',
        'dbgenerated',
        'loancrate',
    ],
};
