import {isEnumValue} from '@augment-vir/common';
import {
    SchemaArgument,
    formatAst,
    parsePrismaSchema,
    visitAst,
} from '@loancrate/prisma-schema-parser';

enum BuiltInPrismaType {
    String = 'String',
    Boolean = 'Boolean',
    Int = 'Int',
    BigInt = 'BigInt',
    Float = 'Float',
    Decimal = 'Decimal',
    DateTime = 'DateTime',
    Json = 'Json',
    Bytes = 'Bytes',
    Unsupported = 'Unsupported',
}

/** Take in the given Prisma schema as a string and return the obfuscated output string. */
export function obfuscateSchemaText(
    /** The Prisma schema contents as a string. */
    schemaText: string,
): string {
    const ast = parsePrismaSchema(schemaText);

    let envVarCount = 0;
    let modelCount = 0;
    let enumCount = 0;
    let enumValueCount = 0;

    const mappedModelNames: {[originalModelName: string]: string} = {};
    const mappedFieldNames: {[newModelName: string]: {[originalFieldName: string]: string}} = {};

    const mappedEnumNames: {[originalEnumName: string]: string} = {};
    const mappedEnumValues: {[newEnumName: string]: {[originalValueName: string]: string}} = {};

    visitAst(ast, {
        functionCall: {
            leave(node) {
                if (
                    node.path.value[node.path.value.length - 1] === 'env' &&
                    node.args &&
                    node.args[0]?.kind === 'literal'
                ) {
                    node.args[0].value = `ENV_${envVarCount++}`;
                }
            },
        },
        model: {
            leave(node) {
                const originalModelName = node.name.value;
                if (originalModelName in mappedModelNames) {
                    throw new Error(`Duplicate model: ${originalModelName}`);
                }

                const newModelName = `model_name_${modelCount++}`;
                mappedFieldNames[newModelName] = {};
                mappedModelNames[originalModelName] = newModelName;
                node.name.value = newModelName;

                let fieldCount = 0;
                node.members.forEach((member) => {
                    if (member.kind === 'field') {
                        const originalFieldName: string = member.name.value;
                        if (mappedFieldNames[newModelName]![originalFieldName]) {
                            throw new Error(
                                `Duplicate field '${originalFieldName}' in model '${originalModelName}'`,
                            );
                        }

                        const newFieldName = `field_${fieldCount++}`;
                        mappedFieldNames[newModelName]![originalFieldName] = newFieldName;
                        member.name.value = newFieldName;
                    }
                });
            },
        },
        enum: {
            leave(node) {
                const originalEnumName = node.name.value;
                const newEnumName = `ENUM_${enumCount++}`;
                if (mappedEnumNames[originalEnumName]) {
                    throw new Error(`Duplicate enum: ${originalEnumName}`);
                }
                mappedEnumNames[originalEnumName] = newEnumName;
                mappedEnumValues[newEnumName] = {};
                node.name.value = newEnumName;

                node.members.forEach((enumMember) => {
                    if (enumMember.kind === 'enumValue') {
                        const originalEnumValueName = enumMember.name.value;
                        const newEnumValueName = `VALUE_${enumValueCount++}`;

                        if (mappedEnumValues[newEnumName]![originalEnumValueName]) {
                            throw new Error(
                                `Duplicate enum value '${originalEnumValueName}' in enum '${originalEnumName}'`,
                            );
                        }
                        mappedEnumValues[newEnumName]![originalEnumValueName] = newEnumValueName;
                        enumMember.name.value = newEnumValueName;
                    }
                });
            },
        },
    });

    function getNewEnumOrModelName(originalName: string): string {
        const replacedModelName = mappedModelNames[originalName];
        const replacedEnumName = mappedEnumNames[originalName];

        const newName = replacedModelName || replacedEnumName;

        if (!newName) {
            throw new Error(
                `Failed to find replacement name for model or enum name '${originalName}'`,
            );
        }

        return newName;
    }

    function getNewFieldName({
        newModelName,
        originalFieldName,
    }: {
        newModelName: string;
        originalFieldName: string;
    }): string {
        const newFieldName = mappedFieldNames[newModelName]?.[originalFieldName];

        if (!newFieldName) {
            throw new Error(
                `Failed to find replacement name for field '${originalFieldName}' in model '${newModelName}'`,
            );
        }

        return newFieldName;
    }

    function getNewEnumValue({
        newEnumName,
        originalValueName,
    }: {
        newEnumName: string;
        originalValueName: string;
    }) {
        const newEnumValue = mappedEnumValues[newEnumName]?.[originalValueName];

        if (!newEnumValue) {
            throw new Error(
                `Failed to find replacement value '${originalValueName}' in enum '${newEnumName}'`,
            );
        }

        return newEnumValue;
    }

    visitAst(ast, {
        typeId: {
            leave(node) {
                /** Field types that are another model or enum */
                const originalTypeName = node.name.value;

                if (isEnumValue(originalTypeName, BuiltInPrismaType)) {
                    return;
                }

                node.name.value = getNewEnumOrModelName(originalTypeName);
            },
        },
        field: {
            leave(node) {
                const fieldName = node.name.value;
                const fieldType = node.type.kind === 'typeId' ? node.type.name.value : undefined;

                (node.attributes ?? []).forEach((nodeAttribute) => {
                    if (nodeAttribute.path.value[0] === 'default') {
                        const obfuscatedDefaultValue =
                            fieldType?.toLowerCase() === 'string'
                                ? 'DEFAULT'
                                : fieldType?.toLowerCase() === 'int'
                                ? 0
                                : undefined;

                        if (nodeAttribute.args?.[0]?.kind === 'literal') {
                            if (obfuscatedDefaultValue == undefined) {
                                throw new Error(
                                    `Found default value for new field '${fieldName}' but generated no replacement value for this field of type '${fieldType}'`,
                                );
                            }
                            nodeAttribute.args[0].value = obfuscatedDefaultValue;
                        } else if (nodeAttribute.args?.[0]?.kind === 'path') {
                            if (nodeAttribute.args[0].value.length !== 1) {
                                throw new Error(
                                    `Unexpected args length '${nodeAttribute.args[0].value.length}' in @default for new field '${fieldName}'`,
                                );
                            }

                            if (!fieldType || !(fieldType in mappedEnumValues)) {
                                throw new Error(
                                    `Unexpected field type '${fieldType}' for new field '${fieldName}'.`,
                                );
                            }

                            const originalValueName = nodeAttribute.args[0].value[0];

                            if (!originalValueName) {
                                throw new Error(
                                    `Failed to find original @default value for new field '${fieldName}' with type '${fieldType}'`,
                                );
                            }

                            nodeAttribute.args[0].value[0] = getNewEnumValue({
                                newEnumName: fieldType,
                                originalValueName,
                            });
                        } else if (nodeAttribute.args?.[0]?.kind === 'functionCall') {
                            /** Ignore these. This is something like `autoincrement()`. */
                        } else {
                            throw new Error(
                                `Unexpected nodeAttribute arg kind '${nodeAttribute.args?.[0]?.kind}' for @default in field '${fieldName}'`,
                            );
                        }
                    }

                    /** @relation */
                    if (nodeAttribute.path.value[0] === 'relation') {
                        if (!nodeAttribute.args) {
                            throw new Error(`No args in relation field attribute.`);
                        }
                        const fieldsArg = nodeAttribute.args.find(
                            (arg): arg is Extract<SchemaArgument, {kind: 'namedArgument'}> => {
                                return arg.kind === 'namedArgument' && arg.name.value === 'fields';
                            },
                        );
                        const referencesArg = nodeAttribute.args.find(
                            (arg): arg is Extract<SchemaArgument, {kind: 'namedArgument'}> => {
                                return (
                                    arg.kind === 'namedArgument' && arg.name.value === 'references'
                                );
                            },
                        );

                        if (!referencesArg) {
                            throw new Error(
                                `Failed to find references arg in relation field attribute on renamed field '${fieldName}'`,
                            );
                        }
                        if (!fieldsArg) {
                            throw new Error(
                                `Failed to find fields arg in relation field attribute on renamed field '${fieldName}'`,
                            );
                        }
                        if (fieldsArg.expression.kind !== 'array') {
                            throw new Error(
                                `Unexpected array expression kind in fields arg in relation field attribute on renamed field '${fieldName}'`,
                            );
                        }
                        if (referencesArg.expression.kind !== 'array') {
                            throw new Error(
                                `Unexpected array expression kind in references arg in relation field attribute on renamed field '${fieldName}'`,
                            );
                        }
                        if (!fieldType) {
                            throw new Error(
                                `No field type found for renamed field '${fieldName}', needed for relation field attribute.`,
                            );
                        }

                        referencesArg.expression.items.forEach((item) => {
                            if (item.kind !== 'path') {
                                throw new Error(
                                    `Unexpected non-path expression item in references arg in relation field attribute on renamed field '${fieldName}'`,
                                );
                            }

                            if (item.value.length !== 1) {
                                throw new Error(
                                    `Unexpected path length in expression in references arg in relation field attribute on renamed field '${fieldName}'`,
                                );
                            }

                            item.value[0] = getNewFieldName({
                                originalFieldName: item.value[0]!,
                                newModelName: fieldType,
                            });
                        });

                        fieldsArg.expression.items.forEach((item) => {
                            if (item.kind !== 'path') {
                                throw new Error(
                                    `Unexpected non-path expression item in references arg in relation field attribute on renamed field '${fieldName}'`,
                                );
                            }

                            if (item.value.length !== 1) {
                                throw new Error(
                                    `Unexpected path length in expression in references arg in relation field attribute on renamed field '${fieldName}'`,
                                );
                            }
                            const oldModelName = item.value[0]!;

                            item.value[0] = getNewEnumOrModelName(oldModelName);
                        });
                        fieldsArg;
                    }
                });
            },
        },
        model: {
            leave(node) {
                const modelName = node.name.value;
                let indexCounter = 0;

                node.members.forEach((nodeMember) => {
                    /** @@index */
                    if (
                        nodeMember.kind === 'blockAttribute' &&
                        nodeMember.path.value[0] === 'index'
                    ) {
                        const args = nodeMember.args;

                        if (!args?.length) {
                            throw new Error(`Found no args for @@index in model '${modelName}'`);
                        }
                        const fieldsArg = args[0];

                        if (fieldsArg?.kind !== 'array') {
                            throw new Error(
                                `Unexpected non-array fields arg kind '${fieldsArg?.kind}' in @@index for model '${modelName}'`,
                            );
                        }
                        fieldsArg.items.forEach((item) => {
                            if (item.kind !== 'path') {
                                throw new Error(
                                    `Unexpected non-path item kind '${item.kind}' in fields arg for @@index in model '${modelName}'`,
                                );
                            }

                            if (!item.value[0] || item.value.length !== 1) {
                                throw new Error(
                                    `Unexpected item value array length for field name in arg to @@index in model '${modelName}'`,
                                );
                            }

                            item.value[0] = getNewFieldName({
                                newModelName: modelName,
                                originalFieldName: item.value[0],
                            });
                        });

                        const mapArg = args[1];

                        if (mapArg?.kind !== 'namedArgument') {
                            throw new Error(
                                `Unexpected non-namedArgument kind '${mapArg?.kind}' for second argument to @@index in model '${modelName}'`,
                            );
                        }

                        if (mapArg.name.value !== 'map') {
                            throw new Error(
                                `Unexpected non-map second argument ${mapArg.name.value} to @@index in model '${modelName}'`,
                            );
                        }

                        if (mapArg.expression.kind !== 'literal') {
                            throw new Error(
                                `Unexpected non-literal expression kind for map argument in @@index for model '${modelName}'`,
                            );
                        }

                        mapArg.expression.value = `index_${indexCounter++}`;
                    }
                });
            },
        },
    });

    debugger;

    return formatAst(ast);
}
