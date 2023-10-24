import {SourceRange} from '@loancrate/prisma-schema-parser';

/** A minimal Prisma AST node type with just location and nothing else. */
export type WithLocation = {location?: SourceRange | undefined} | undefined;

/**
 * An error specifically thrown from the prisma-schema-obfuscation package (as opposed to other
 * standard errors like a file not being found or other run-time errors).
 */
export class ObfuscationError extends Error {
    public override readonly name = 'ObfuscationError';
    constructor(message: string, withLocation: WithLocation) {
        super(
            message +
                (withLocation?.location ? ` at line ${withLocation.location.start.line}` : ''),
        );
    }
}
