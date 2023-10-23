# prisma-schema-obfuscator

Obfuscates a prisma schema so it can be shared without leaking information.

## Installation

```sh
npm i prisma-schema-obfuscator
```

# API

See the API docs: https://electrovir.github.io/prisma-schema-obfuscator

# CLI

-   `prisma-obf <input-file-path> <output-file-path>`: read the Prisma schema from `<input-file-path>` and write its obfuscated text to `<output-file-path>`.
-   `prisma-obf <input-file-path>`: read the Prisma schema from `<input-file-path>` and write its obfuscated text directly to the console.
