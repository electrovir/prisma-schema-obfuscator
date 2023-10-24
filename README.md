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

# Repo dev

## Running CLI

To test obfuscation on a file, add the file to `.not-committed/schema.prisma` and then run the `cli.ts` file directly:

```sh
npx ts-node src/cli.ts ./.not-committed/schema.prisma ./.not-committed/schema-obfuscated.prisma
```

## Running tests

-   `npm test`: run tests
-   `npm run debug`: run tests with debugger attached (launch in Chrome)
