import {itCases} from '@augment-vir/chai';
import {obfuscateSchemaText} from './obfuscate-schema-text';

describe(obfuscateSchemaText.name, () => {
    itCases(
        (input: string) => {
            const formatted = obfuscateSchemaText(input);
            const formattedLines = formatted.split('\n');
            const indentedLines = formattedLines.map(
                (line) => `                    ${line.replace(/^  /, '    ')}`,
            );

            return `\n${indentedLines.join('\n')}\n                `;
        },
        [
            {
                it: 'obfuscates env var names',
                input: `
                    datasource db {
                        provider = "postgresql"
                        url      = env("DB_URL")
                    }
                `,
                expect: `
                    datasource db {
                        provider = "postgresql"
                        url = env("ENV_0")
                    }
                `,
            },
            {
                it: 'obfuscates model and field names',
                input: `
                    model stuff_model {
                        id   Int  @id @default(autoincrement())
                        prop Int?
                    }
                `,
                expect: `
                    model model_name_0 {
                        field_0 Int @id @default(autoincrement())
                        field_1 Int?
                    }
                `,
            },
            {
                it: 'obfuscates enum names',
                input: `
                    enum FRUIT {
                        APPLE
                        ORANGE
                        PEAR
                        BANANA
                        WATERMELON
                    }
                `,
                expect: `
                    enum ENUM_0 {
                        VALUE_0
                        VALUE_1
                        VALUE_2
                        VALUE_3
                        VALUE_4
                    }
                `,
            },
            {
                it: 'obfuscates enums, models, fields, and env vars',
                input: `
                    datasource db {
                        provider = "postgresql"
                        url      = env("DB_URL")
                    }
                    
                    enum FRUIT {
                        APPLE
                        ORANGE
                        PEAR
                        BANANA
                        WATERMELON
                    }
                    
                    model stuff_model {
                        id   Int  @id @default(autoincrement())
                        prop Int?
                    }
                `,
                expect: `
                    datasource db {
                        provider = "postgresql"
                        url = env("ENV_0")
                    }
                    
                    enum ENUM_0 {
                        VALUE_0
                        VALUE_1
                        VALUE_2
                        VALUE_3
                        VALUE_4
                    }
                    
                    model model_name_0 {
                        field_0 Int @id @default(autoincrement())
                        field_1 Int?
                    }
                `,
            },
            {
                it: 'obfuscates default values',
                input: `
                    model stuff_model {
                        id    Int    @id @default(autoincrement())
                        prop  Int?
                        prop2 String @default("default value") @db.VarChar
                        prop3 String @default("default value") @db.VarChar
                        prop4 Int    @default(123)
                    }
                `,
                expect: `
                    model model_name_0 {
                        field_0 Int @id @default(autoincrement())
                        field_1 Int?
                        field_2 String @default("DEFAULT") @db.VarChar
                        field_3 String @default("DEFAULT") @db.VarChar
                        field_4 Int @default(0)
                    }
                `,
            },
            {
                it: 'obfuscates nested models',
                input: `
                    model stuff_model {
                        id          Int    @id @default(autoincrement())
                        prop        Int?
                        prop2       String @default("default value") @db.VarChar
                        prop3       String @default("default value") @db.VarChar
                        prop4       Int    @default(123)
                        nested_list more_model[]
                        nested      more_model
                    }
                    
                    model more_model {
                        id    Int @id @default(autoincrement())
                        prop  Int
                        prop2 String @default("hello there")
                    }
                `,
                expect: `
                    model model_name_0 {
                        field_0 Int @id @default(autoincrement())
                        field_1 Int?
                        field_2 String @default("DEFAULT") @db.VarChar
                        field_3 String @default("DEFAULT") @db.VarChar
                        field_4 Int @default(0)
                        field_5 model_name_1[]
                        field_6 model_name_1
                    }
                    
                    model model_name_1 {
                        field_0 Int @id @default(autoincrement())
                        field_1 Int
                        field_2 String @default("DEFAULT")
                    }
                `,
            },
            {
                it: 'obfuscates relations',
                input: `
                    model stuff_model {
                        id          Int    @id @default(autoincrement())
                        nested_list more_model[]
                        nested      more_model @relation(fields: [more_model], references: [prop2])
                    }
                    
                    model more_model {
                        id    Int @id @default(autoincrement())
                        prop  Int
                        prop2 String @default("hello there")
                    }
                `,
                expect: `
                    model model_name_0 {
                        field_0 Int @id @default(autoincrement())
                        field_1 model_name_1[]
                        field_2 model_name_1 @relation(fields: [model_name_1], references: [field_2])
                    }
                    
                    model model_name_1 {
                        field_0 Int @id @default(autoincrement())
                        field_1 Int
                        field_2 String @default("DEFAULT")
                    }
                `,
            },
            {
                it: 'obfuscates index definitions',
                input: `
                    model stuff_model {
                        id          Int    @id @default(autoincrement())
                        some_field  Int
                        
                        @@index([some_field], map: "index_stuff_model_some_field")
                    }
                `,
                expect: `
                    model model_name_0 {
                        field_0 Int @id @default(autoincrement())
                        field_1 Int
                        @@index([field_1], map: "index_0")
                    }
                `,
            },
            {
                it: 'obfuscates an enum default value',
                input: `
                    enum FRUIT {
                        APPLE
                        ORANGE
                        PEAR
                        BANANA
                        WATERMELON
                    }
                    
                    model model_name_1 {
                        id    Int   @id @default(autoincrement())
                        fruit FRUIT @default(APPLE)
                    }
                `,
                expect: `
                    enum ENUM_0 {
                        VALUE_0
                        VALUE_1
                        VALUE_2
                        VALUE_3
                        VALUE_4
                    }
                    
                    model model_name_0 {
                        field_0 Int @id @default(autoincrement())
                        field_1 ENUM_0 @default(VALUE_0)
                    }
                `,
            },
        ],
    );
});
