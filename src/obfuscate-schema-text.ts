import {isEnumValue, typedSplit} from '@augment-vir/common';
import {
    PrismaType,
    SchemaArgument,
    formatAst,
    parsePrismaSchema,
    visitAst,
} from '@loancrate/prisma-schema-parser';
import {ObfuscationError, WithLocation} from './obfuscation.error';

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

const defaultDefaultValues: Partial<Record<string, string | number | boolean>> = {
    [BuiltInPrismaType.String]: 'DEFAULT',
    [BuiltInPrismaType.Int]: 0,
    [BuiltInPrismaType.Boolean]: false,
    [BuiltInPrismaType.Json]: '[]',
};

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

    const mappedRelationNames: {[newModelName: string]: {[originalRelationName: string]: string}} =
        {};

    debugger;

    /**
     * # ==========
     *
     * First pass
     *
     * # ==========
     */
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
        comment: {
            leave(node) {
                node.text = '';
            },
        },
        docComment: {
            leave(node) {
                node.text = '';
            },
        },
        commentBlock: {
            leave(node) {
                node.comments = [];
            },
        },
        model: {
            leave(node) {
                const originalModelName = node.name.value;
                if (originalModelName in mappedModelNames) {
                    throw new ObfuscationError(`Duplicate model: ${originalModelName}`, node);
                }

                const newModelName = `model_name_${modelCount++}`;
                mappedFieldNames[newModelName] = {};
                mappedModelNames[originalModelName] = newModelName;
                node.name.value = newModelName;

                let fieldCount = 0;
                let relationCount = 0;
                node.members.forEach((member) => {
                    if (member.kind === 'field') {
                        const originalFieldName: string = member.name.value;
                        if (mappedFieldNames[newModelName]![originalFieldName]) {
                            throw new ObfuscationError(
                                `Duplicate field '${originalFieldName}' in model '${originalModelName}'`,
                                member,
                            );
                        }

                        const newFieldName = `field_${fieldCount++}`;
                        mappedFieldNames[newModelName]![originalFieldName] = newFieldName;
                        member.name.value = newFieldName;

                        member.attributes?.forEach((attribute) => {
                            /** Named @relation definition */
                            if (attribute.path.value[0] === 'relation') {
                                if (
                                    attribute.args &&
                                    attribute.args.length > 2 &&
                                    attribute.args[0]?.kind === 'literal'
                                ) {
                                    const originalRelationName = String(attribute.args[0].value);
                                    const newRelationName = `${newModelName}_relation_${relationCount++}`;
                                    if (!mappedRelationNames[newModelName]) {
                                        mappedRelationNames[newModelName] = {};
                                    }
                                    mappedRelationNames[newModelName]![originalRelationName] =
                                        newRelationName;

                                    attribute.args[0].value = newRelationName;
                                }
                            }
                            /** @unique */
                            if (attribute.path.value[0] === 'unique') {
                                attribute.args?.forEach((arg) => {
                                    if (arg.kind !== 'namedArgument') {
                                        throw new ObfuscationError(
                                            `unexpected arg kind in @unique: '${arg.kind}'`,
                                            attribute,
                                        );
                                    }

                                    if (arg.name.value === 'map') {
                                        if (arg.expression.kind !== 'literal') {
                                            throw new ObfuscationError(
                                                `Unexpected expression kind for map in @unique: '${arg.expression.kind}'`,
                                                arg.name,
                                            );
                                        }
                                        const split = typedSplit(String(arg.expression.value), '.');
                                        if (split.length > 1) {
                                            arg.expression.value = `${newModelName}.${newFieldName}_unique`;
                                        } else {
                                            arg.expression.value = `${newModelName}_${newFieldName}_unique`;
                                        }
                                    }
                                });
                            }
                        });
                    } else if (
                        member.kind === 'blockAttribute' &&
                        member.path.value[0] === 'unique'
                    ) {
                        member.args?.forEach((arg) => {
                            if (arg.kind === 'namedArgument') {
                                if (
                                    ![
                                        'name',
                                        'map',
                                    ].includes(arg.name.value)
                                ) {
                                    throw new ObfuscationError(
                                        `Unexpected namedArgument type for @@unique: '${arg.name.value}'`,
                                        arg.name,
                                    );
                                }
                                if (arg.expression.kind !== 'literal') {
                                    throw new ObfuscationError(
                                        `Unexpected expression type '${arg.expression.kind}' for arg '${arg.name}' in @@unique`,
                                        arg.name,
                                    );
                                }
                                const originalFieldName = String(arg.expression.value);
                                if (!(originalFieldName in mappedFieldNames[newModelName]!)) {
                                    const newFieldName = `field_${fieldCount++}`;
                                    mappedFieldNames[newModelName]![originalFieldName] =
                                        newFieldName;
                                }

                                const replacementFieldName = getNewFieldName(
                                    {newModelName, originalFieldName},
                                    arg.name,
                                );

                                arg.expression.value = replacementFieldName;
                            }
                        });
                    }
                });
            },
        },
        enum: {
            leave(node) {
                const originalEnumName = node.name.value;
                const newEnumName = `ENUM_${enumCount++}`;
                if (mappedEnumNames[originalEnumName]) {
                    throw new ObfuscationError(`Duplicate enum: ${originalEnumName}`, node);
                }
                mappedEnumNames[originalEnumName] = newEnumName;
                mappedEnumValues[newEnumName] = {};
                node.name.value = newEnumName;

                node.members.forEach((enumMember) => {
                    if (enumMember.kind === 'enumValue') {
                        const originalEnumValueName = enumMember.name.value;
                        const newEnumValueName = `VALUE_${enumValueCount++}`;

                        if (mappedEnumValues[newEnumName]![originalEnumValueName]) {
                            throw new ObfuscationError(
                                `Duplicate enum value '${originalEnumValueName}' in enum '${originalEnumName}'`,
                                enumMember,
                            );
                        }
                        mappedEnumValues[newEnumName]![originalEnumValueName] = newEnumValueName;
                        enumMember.name.value = newEnumValueName;
                    }
                });
            },
        },
    });

    function getNewEnumOrModelName(
        originalName: string,
        withLocation: WithLocation | undefined,
    ): string {
        const replacedModelName = mappedModelNames[originalName];
        const replacedEnumName = mappedEnumNames[originalName];

        const newName = replacedModelName || replacedEnumName;

        if (!newName) {
            throw new ObfuscationError(
                `Failed to find replacement name for model or enum name '${originalName}'`,
                withLocation,
            );
        }

        return newName;
    }

    function getNewFieldName(
        {
            newModelName,
            originalFieldName,
        }: {
            newModelName: string;
            originalFieldName: string;
        },
        withLocation: WithLocation | undefined,
    ): string {
        const newFieldName = mappedFieldNames[newModelName]?.[originalFieldName];

        if (!newFieldName) {
            throw new ObfuscationError(
                `Failed to find replacement name for field '${originalFieldName}' in model '${newModelName}'`,
                withLocation,
            );
        }

        return newFieldName;
    }

    function getNewRelationName(
        {
            newModelName,
            originalRelationName,
        }: {
            newModelName: string;
            originalRelationName: string;
        },
        withLocation: WithLocation | undefined,
    ): string {
        const newRelationName = mappedRelationNames[newModelName]?.[originalRelationName];

        if (!newRelationName) {
            throw new ObfuscationError(
                `Failed to find replacement relation name for relation '${originalRelationName}' in model '${newModelName}'`,
                withLocation,
            );
        }

        return newRelationName;
    }

    function getNewEnumValue(
        {
            newEnumName,
            originalValueName,
        }: {
            newEnumName: string;
            originalValueName: string;
        },
        withLocation: WithLocation | undefined,
    ) {
        const newEnumValue = mappedEnumValues[newEnumName]?.[originalValueName];

        if (!newEnumValue) {
            throw new ObfuscationError(
                `Failed to find replacement value '${originalValueName}' in enum '${newEnumName}'`,
                withLocation,
            );
        }

        return newEnumValue;
    }

    function extractTypeId(node: PrismaType): string | undefined {
        if (node.kind === 'unsupported') {
            return undefined;
        } else if (node.kind === 'typeId') {
            return node.name.value;
        } else {
            return extractTypeId(node.type);
        }
    }

    /**
     * # ==========
     *
     * Second pass
     *
     * # ==========
     */
    try {
        visitAst(ast, {
            typeId: {
                leave(node) {
                    /** Field types that are another model or enum */
                    const originalTypeName = node.name.value;

                    if (isEnumValue(originalTypeName, BuiltInPrismaType)) {
                        return;
                    }

                    node.name.value = getNewEnumOrModelName(originalTypeName, undefined);
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
                                throw new ObfuscationError(
                                    `Found no args for @@index in model '${modelName}'`,
                                    nodeMember,
                                );
                            }
                            const fieldsArg = args[0];

                            if (fieldsArg?.kind !== 'array') {
                                throw new ObfuscationError(
                                    `Unexpected non-array fields arg kind '${fieldsArg?.kind}' in @@index for model '${modelName}'`,
                                    nodeMember,
                                );
                            }
                            fieldsArg.items.forEach((item) => {
                                if (item.kind !== 'path') {
                                    throw new ObfuscationError(
                                        `Unexpected non-path item kind '${item.kind}' in fields arg for @@index in model '${modelName}'`,
                                        nodeMember,
                                    );
                                }

                                if (!item.value[0] || item.value.length !== 1) {
                                    throw new ObfuscationError(
                                        `Unexpected item value array length for field name in arg to @@index in model '${modelName}'`,
                                        item,
                                    );
                                }

                                item.value[0] = getNewFieldName(
                                    {
                                        newModelName: modelName,
                                        originalFieldName: item.value[0],
                                    },
                                    item,
                                );
                            });

                            const mapArg = args[1];

                            if (mapArg?.kind !== 'namedArgument') {
                                throw new ObfuscationError(
                                    `Unexpected non-namedArgument kind '${mapArg?.kind}' for second argument to @@index in model '${modelName}'`,
                                    nodeMember,
                                );
                            }

                            if (mapArg.name.value !== 'map') {
                                throw new ObfuscationError(
                                    `Unexpected non-map second argument ${mapArg.name.value} to @@index in model '${modelName}'`,
                                    nodeMember,
                                );
                            }

                            if (mapArg.expression.kind !== 'literal') {
                                throw new ObfuscationError(
                                    `Unexpected non-literal expression kind for map argument in @@index for model '${modelName}'`,
                                    nodeMember,
                                );
                            }

                            mapArg.expression.value = `${modelName}_index_${indexCounter++}`;
                        } else if (
                            nodeMember.kind === 'blockAttribute' &&
                            nodeMember.path.value[0] === 'id'
                        ) {
                            if (nodeMember.args?.[0]?.kind !== 'array') {
                                throw new ObfuscationError(
                                    `@@id arg is unexpectedly not an array`,
                                    nodeMember,
                                );
                            }
                            nodeMember.args[0].items.forEach((item) => {
                                if (item.kind !== 'path') {
                                    throw new ObfuscationError(
                                        `Unexpected non-path item in argument to @@id`,
                                        nodeMember,
                                    );
                                }
                                if (item.value.length !== 1) {
                                    throw new ObfuscationError(
                                        `Unexpected item value length for entry in arg to @@id: ${JSON.stringify(
                                            item.value,
                                        )}`,
                                        item,
                                    );
                                }

                                const originalFieldName = String(item.value[0]);
                                const newFieldName = getNewFieldName(
                                    {newModelName: modelName, originalFieldName},
                                    item,
                                );
                                item.value[0] = newFieldName;
                            });
                        } else if (
                            nodeMember.kind === 'blockAttribute' &&
                            nodeMember.path.value[0] === 'unique'
                        ) {
                            nodeMember.args?.forEach((arg) => {
                                if (arg.kind === 'array') {
                                    arg.items.forEach((item) => {
                                        if (item.kind !== 'path') {
                                            throw new ObfuscationError(
                                                `Unexpected item kind '${item.kind}' in array arg to @@unique`,
                                                nodeMember,
                                            );
                                        }

                                        item.value[0] = getNewFieldName(
                                            {
                                                newModelName: modelName,
                                                originalFieldName: String(item.value[0]),
                                            },
                                            item,
                                        );
                                    });
                                }
                            });
                        } else if (nodeMember.kind === 'field') {
                            const fieldName = nodeMember.name.value;
                            const fieldType = extractTypeId(nodeMember.type);

                            (nodeMember.attributes ?? []).forEach((nodeAttribute) => {
                                if (nodeAttribute.path.value[0] === 'default') {
                                    const obfuscatedDefaultValue = fieldType
                                        ? defaultDefaultValues[fieldType]
                                        : undefined;

                                    if (nodeAttribute.args?.[0]?.kind === 'literal') {
                                        if (obfuscatedDefaultValue == undefined) {
                                            throw new ObfuscationError(
                                                `Found default value for new field '${fieldName}' but generated no replacement value for this field of type '${fieldType}'`,
                                                nodeAttribute,
                                            );
                                        }
                                        nodeAttribute.args[0].value = obfuscatedDefaultValue;
                                    } else if (nodeAttribute.args?.[0]?.kind === 'path') {
                                        if (nodeAttribute.args[0].value.length !== 1) {
                                            throw new ObfuscationError(
                                                `Unexpected args length '${nodeAttribute.args[0].value.length}' in @default for new field '${fieldName}'`,
                                                nodeAttribute,
                                            );
                                        }

                                        if (!fieldType || !(fieldType in mappedEnumValues)) {
                                            throw new ObfuscationError(
                                                `Unexpected field type '${fieldType}' for new field '${fieldName}'.`,
                                                nodeAttribute,
                                            );
                                        }

                                        const originalValueName = nodeAttribute.args[0].value[0];

                                        if (!originalValueName) {
                                            throw new ObfuscationError(
                                                `Failed to find original @default value for new field '${fieldName}' with type '${fieldType}'`,
                                                nodeAttribute.args[0],
                                            );
                                        }

                                        nodeAttribute.args[0].value[0] = getNewEnumValue(
                                            {
                                                newEnumName: fieldType,
                                                originalValueName,
                                            },
                                            nodeAttribute.args[0],
                                        );
                                    } else if (nodeAttribute.args?.[0]?.kind === 'functionCall') {
                                        if (nodeAttribute.args[0].path.value[0] === 'dbgenerated') {
                                            if (fieldType === BuiltInPrismaType.DateTime) {
                                                nodeAttribute.args[0].path.value[0] = 'now';
                                                nodeAttribute.args[0].args = [];
                                            }
                                        }
                                        /** Ignore these. This is something like `autoincrement()`. */
                                    } else {
                                        throw new ObfuscationError(
                                            `Unexpected nodeAttribute arg kind '${nodeAttribute.args?.[0]?.kind}' for @default in field '${fieldName}'`,
                                            nodeAttribute,
                                        );
                                    }
                                }

                                /** @relation */
                                if (nodeAttribute.path.value[0] === 'relation') {
                                    if (!nodeAttribute.args) {
                                        throw new ObfuscationError(
                                            `No args in relation field attribute.`,
                                            nodeAttribute,
                                        );
                                    }
                                    const relationNameArg = nodeAttribute.args.find(
                                        (
                                            arg,
                                        ): arg is Extract<SchemaArgument, {kind: 'literal'}> => {
                                            return arg.kind === 'literal';
                                        },
                                    );
                                    const mapArg = nodeAttribute.args.find(
                                        (
                                            arg,
                                        ): arg is Extract<
                                            SchemaArgument,
                                            {kind: 'namedArgument'}
                                        > => {
                                            return (
                                                arg.kind === 'namedArgument' &&
                                                arg.name.value === 'map'
                                            );
                                        },
                                    );
                                    if (mapArg) {
                                        if (mapArg.expression.kind !== 'literal') {
                                            throw new ObfuscationError(
                                                `Unexpected non-literal for map arg expression`,
                                                mapArg.name,
                                            );
                                        }
                                        mapArg.expression.value = `${fieldName}_mapped`;
                                    }

                                    const fieldsArg = nodeAttribute.args.find(
                                        (
                                            arg,
                                        ): arg is Extract<
                                            SchemaArgument,
                                            {kind: 'namedArgument'}
                                        > => {
                                            return (
                                                arg.kind === 'namedArgument' &&
                                                arg.name.value === 'fields'
                                            );
                                        },
                                    );
                                    const referencesArg = nodeAttribute.args.find(
                                        (
                                            arg,
                                        ): arg is Extract<
                                            SchemaArgument,
                                            {kind: 'namedArgument'}
                                        > => {
                                            return (
                                                arg.kind === 'namedArgument' &&
                                                arg.name.value === 'references'
                                            );
                                        },
                                    );

                                    if (relationNameArg && !referencesArg && !fieldsArg) {
                                        const newRelationName = getNewRelationName(
                                            {
                                                newModelName: fieldType || '',
                                                originalRelationName: String(relationNameArg.value),
                                            },
                                            nodeAttribute,
                                        );

                                        relationNameArg.value = newRelationName;
                                    } else {
                                        if (!referencesArg) {
                                            throw new ObfuscationError(
                                                `Failed to find references arg in relation field attribute on renamed field '${fieldName}'`,
                                                nodeAttribute,
                                            );
                                        }
                                        if (!fieldsArg) {
                                            throw new ObfuscationError(
                                                `Failed to find fields arg in relation field attribute on renamed field '${fieldName}'`,
                                                nodeAttribute,
                                            );
                                        }
                                        if (fieldsArg.expression.kind !== 'array') {
                                            throw new ObfuscationError(
                                                `Unexpected array expression kind in fields arg in relation field attribute on renamed field '${fieldName}'`,
                                                nodeAttribute,
                                            );
                                        }
                                        if (referencesArg.expression.kind !== 'array') {
                                            throw new ObfuscationError(
                                                `Unexpected array expression kind in references arg in relation field attribute on renamed field '${fieldName}'`,
                                                nodeAttribute,
                                            );
                                        }
                                        if (!fieldType) {
                                            throw new ObfuscationError(
                                                `No field type found for renamed field '${fieldName}', needed for relation field attribute`,
                                                nodeAttribute,
                                            );
                                        }

                                        referencesArg.expression.items.forEach((item) => {
                                            if (item.kind !== 'path') {
                                                throw new ObfuscationError(
                                                    `Unexpected non-path expression item in references arg in relation field attribute on renamed field '${fieldName}'`,
                                                    nodeAttribute,
                                                );
                                            }

                                            if (item.value.length !== 1) {
                                                throw new ObfuscationError(
                                                    `Unexpected path length in expression in references arg in relation field attribute on renamed field '${fieldName}'`,
                                                    nodeAttribute,
                                                );
                                            }

                                            item.value[0] = getNewFieldName(
                                                {
                                                    originalFieldName: item.value[0]!,
                                                    newModelName: fieldType,
                                                },
                                                nodeAttribute,
                                            );
                                        });

                                        fieldsArg.expression.items.forEach((item) => {
                                            if (item.kind !== 'path') {
                                                throw new ObfuscationError(
                                                    `Unexpected non-path expression item in references arg in relation field attribute on renamed field '${fieldName}'`,
                                                    nodeAttribute,
                                                );
                                            }

                                            if (item.value.length !== 1) {
                                                throw new ObfuscationError(
                                                    `Unexpected path length in expression in references arg in relation field attribute on renamed field '${fieldName}'`,
                                                    nodeAttribute,
                                                );
                                            }
                                            const oldFieldName = item.value[0]!;

                                            item.value[0] = getNewFieldName(
                                                {
                                                    newModelName: modelName,
                                                    originalFieldName: oldFieldName,
                                                },
                                                item,
                                            );
                                        });
                                    }
                                }
                            });
                        }
                    });
                },
            },
        });
    } catch (error) {
        console.info(
            JSON.stringify(
                {
                    mappedModelNames,
                    mappedFieldNames,
                    mappedEnumNames,
                    mappedEnumValues,
                    mappedRelationNames,
                },
                null,
                4,
            ),
        );
        throw error;
    }

    debugger;

    return formatAst(ast);
}
