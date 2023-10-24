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
                        id    Int      @id @default(autoincrement())
                        prop  Int?
                        prop2 String   @default("default value") @db.VarChar
                        prop3 String   @default("default value") @db.VarChar
                        prop4 Int      @default(123)
                        args  Json     @default("{}") @db.Json
                    }
                `,
                expect: `
                    model model_name_0 {
                        field_0 Int @id @default(autoincrement())
                        field_1 Int?
                        field_2 String @default("DEFAULT") @db.VarChar
                        field_3 String @default("DEFAULT") @db.VarChar
                        field_4 Int @default(0)
                        field_5 Json @default("[]") @db.Json
                    }
                `,
            },
            {
                it: 'obfuscates nested models',
                input: `
                    model stuff_model {
                        id          Int          @id @default(autoincrement())
                        prop        Int?
                        prop2       String       @default("default value") @db.VarChar
                        prop3       String       @default("default value") @db.VarChar
                        prop4       Int          @default(123)
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
                        id            Int        @id @default(autoincrement())
                        more_model_id Int
                        nested        more_model @relation(fields: [more_model_id], references: [prop2])
                    }
                    
                    model more_model {
                        id    Int    @id @default(autoincrement())
                        prop  Int
                        prop2 String @default("hello there")
                    }
                `,
                expect: `
                    model model_name_0 {
                        field_0 Int @id @default(autoincrement())
                        field_1 Int
                        field_2 model_name_1 @relation(fields: [field_1], references: [field_2])
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
                        id          Int @id @default(autoincrement())
                        some_field  Int
                        
                        @@index([some_field], map: "index_stuff_model_some_field")
                    }
                `,
                expect: `
                    model model_name_0 {
                        field_0 Int @id @default(autoincrement())
                        field_1 Int
                        @@index([field_1], map: "model_name_0_index_0")
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
            {
                it: 'handles optional relation field',
                input: `
                    model stuff_model {
                        id            Int         @id @default(autoincrement())
                        more_model_id Int
                        nested        more_model? @relation(fields: [more_model_id], references: [prop2])
                    }
                    
                    model more_model {
                        id    Int @id @default(autoincrement())
                        prop2 String @default("hello there")
                    }
                `,
                expect: `
                    model model_name_0 {
                        field_0 Int @id @default(autoincrement())
                        field_1 Int
                        field_2 model_name_1? @relation(fields: [field_1], references: [field_1])
                    }
                    
                    model model_name_1 {
                        field_0 Int @id @default(autoincrement())
                        field_1 String @default("DEFAULT")
                    }
                `,
            },
            {
                it: 'handles relation names',
                input: `
                    model stuff_model {
                        id            Int         @id @default(autoincrement())
                        more_model_id Int
                        nested        more_model? @relation("my-relation-name", fields: [more_model_id], references: [id])
                    }
                    
                    model more_model {
                        id    Int    @id @default(autoincrement())
                        prop2 String @default("hello there")
                        
                        stuff stuff_model @relation("my-relation-name")
                    }
                `,
                expect: `
                    model model_name_0 {
                        field_0 Int @id @default(autoincrement())
                        field_1 Int
                        field_2 model_name_1? @relation("model_name_0_relation_0", fields: [field_1], references: [field_0])
                    }
                    
                    model model_name_1 {
                        field_0 Int @id @default(autoincrement())
                        field_1 String @default("DEFAULT")
                        field_2 model_name_0 @relation("model_name_0_relation_0")
                    }
                `,
            },
            {
                it: 'handles a composite key definition',
                input: `
                    model stuff_model {
                        id            Int @id @default(autoincrement())
                        more_model_id Int
                        
                        @@id([id, more_model_id])
                    }
                `,
                expect: `
                    model model_name_0 {
                        field_0 Int @id @default(autoincrement())
                        field_1 Int
                        @@id([field_0, field_1])
                    }
                `,
            },
            {
                it: 'strips comments',
                input: `
                    // comment here
                    model stuff_model {
                        id            Int @id @default(autoincrement()) // comment here
                        // comment here
                        more_model_id Int
                    }
                    // comment here
                `,
                expect: `
                    
                    
                    model model_name_0 {
                        field_0 Int @id @default(autoincrement()) // 
                    
                        field_1 Int
                    }
                    
                    
                `,
            },
            {
                it: 'handles @@unique',
                input: `
                    model stuff_model {
                        id            Int @id @default(autoincrement())
                        more_model_id Int
                        
                        @@unique([id, more_model_id], name: "my_unique_field_name", map: "my_unique_field_name")
                    }
                `,
                expect: `
                    model model_name_0 {
                        field_0 Int @id @default(autoincrement())
                        field_1 Int
                        @@unique([field_0, field_1], name: "field_2", map: "field_2")
                    }
                `,
            },
            {
                it: 'handles @unique',
                input: `
                    model stuff_model {
                        id            Int    @id @default(autoincrement())
                        more_model_id Int    @unique
                        another_field String @unique(map: "stuff_model.another_field_unique") @db.VarChar
                    }
                `,
                expect: `
                    model model_name_0 {
                        field_0 Int @id @default(autoincrement())
                        field_1 Int @unique
                        field_2 String @unique(map: "model_name_0.field_2_unique") @db.VarChar
                    }
                `,
            },
            {
                it: 'handles @relation with map',
                input: `
                    model stuff_model {
                        id            Int        @id @default(autoincrement())
                        more_model_id Int
                        nested        more_model @relation(fields: [more_model_id], references: [prop2], map: "my_relation_map")
                    }
                    
                    model more_model {
                        id    Int    @id @default(autoincrement())
                        prop  Int
                        prop2 String @default("hello there")
                    }
                `,
                expect: `
                    model model_name_0 {
                        field_0 Int @id @default(autoincrement())
                        field_1 Int
                        field_2 model_name_1 @relation(fields: [field_1], references: [field_2], map: "field_2_mapped")
                    }
                    
                    model model_name_1 {
                        field_0 Int @id @default(autoincrement())
                        field_1 Int
                        field_2 String @default("DEFAULT")
                    }
                `,
            },
            {
                it: 'replaces dbgenerated date',
                input: `
                    model stuff_model {
                        id     Int      @id @default(autoincrement())
                        entry  DateTime @default(dbgenerated("stuff"))
                        entry2 DateTime @default(now())
                    }
                `,
                expect: `
                    model model_name_0 {
                        field_0 Int @id @default(autoincrement())
                        field_1 DateTime @default(now())
                        field_2 DateTime @default(now())
                    }
                `,
            },
        ],
    );
});
