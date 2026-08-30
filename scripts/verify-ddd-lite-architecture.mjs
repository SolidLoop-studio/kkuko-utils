import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const LEGACY_IDENTIFIERS = new Set([
    'SCM',
    'SSM',
    'SupabaseClientManager',
    'ISupabaseClientManager',
]);

const LEGACY_MANAGER_PATHS = [
    'src/app/lib/supabase/SupabaseClientManager.ts',
    'src/app/lib/supabase/ISupabaseClientManager.ts',
];

const GENERATED_DATABASE_TYPES_PATH = 'src/app/types/database.types.ts';
const TRANSITIONAL_ALIAS_PATH = 'src/app/lib/supabaseClient';

function toPosixPath(filePath) {
    return filePath.split(sep).join('/');
}

function normalizeFilePath(filePath) {
    return toPosixPath(filePath).replace(/^\.\//, '');
}

function getLine(sourceFile, node) {
    return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function isProductionSource(filePath) {
    return (
        /^src\/.+\.(?:ts|tsx)$/.test(filePath) &&
        !filePath.includes('/__tests__/') &&
        !/\.(?:test|spec)\.(?:ts|tsx)$/.test(filePath) &&
        filePath !== GENERATED_DATABASE_TYPES_PATH
    );
}

function getModulePath(filePath, specifier) {
    if (specifier.startsWith('.')) {
        return normalizeFilePath(join(dirname(filePath), specifier));
    }

    if (specifier.startsWith('@/')) {
        if (specifier.startsWith('@/src/')) {
            return normalizeFilePath(specifier.slice(2));
        }

        return normalizeFilePath(join('src', specifier.slice(2)));
    }

    return specifier;
}

function isSupabaseImport(specifier) {
    return specifier === '@supabase' || specifier.startsWith('@supabase/');
}

function isReactImport(specifier) {
    return specifier === 'react' || specifier.startsWith('react/');
}

function isNextImport(specifier) {
    return specifier === 'next' || specifier.startsWith('next/');
}

function isGeneratedDatabaseTypesImport(modulePath) {
    return modulePath === GENERATED_DATABASE_TYPES_PATH.replace(/\.ts$/, '');
}

function isInfrastructureImport(modulePath) {
    return (
        /(^|\/)infrastructure(\/|$)/.test(modulePath) ||
        modulePath.startsWith('src/shared/infrastructure/')
    );
}

function isSharedSupabaseInfrastructureImport(modulePath) {
    return modulePath.startsWith('src/shared/infrastructure/supabase/');
}

function isLegacyAliasImport(modulePath) {
    return (
        modulePath === TRANSITIONAL_ALIAS_PATH ||
        modulePath === `${TRANSITIONAL_ALIAS_PATH}.ts` ||
        modulePath.includes('/supabase/SupabaseClientManager') ||
        modulePath.includes('/supabase/ISupabaseClientManager')
    );
}

function isModuleDomainOrApplication(filePath) {
    return /^src\/modules\/[^/]+\/(?:domain|application)(?:\/|$)/.test(filePath);
}

function isPresentation(filePath) {
    return (
        /^src\/modules\/[^/]+\/presentation(?:\/|$)/.test(filePath) ||
        (filePath.startsWith('src/app/') &&
            !filePath.startsWith('src/app/lib/') &&
            !filePath.startsWith('src/app/types/'))
    );
}

function isAuthRoute(filePath) {
    return /^src\/app\/api\/auth\/.+\/route\.ts$/.test(filePath);
}

function isRouteHandler(filePath) {
    return filePath.endsWith('/route.ts');
}

function hasUseClientDirective(sourceFile) {
    for (const statement of sourceFile.statements) {
        if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) {
            return false;
        }

        if (statement.expression.text === 'use client') {
            return true;
        }
    }

    return false;
}

function createDiagnostic(filePath, sourceFile, node, rule, message) {
    return {
        filePath,
        line: getLine(sourceFile, node),
        rule,
        message,
    };
}

function isForbiddenDomainApplicationImport(specifier, modulePath) {
    return (
        isReactImport(specifier) ||
        isNextImport(specifier) ||
        isSupabaseImport(specifier) ||
        isGeneratedDatabaseTypesImport(modulePath) ||
        isInfrastructureImport(modulePath) ||
        isLegacyAliasImport(modulePath)
    );
}

function isForbiddenPresentationImport(specifier, modulePath) {
    return (
        isSupabaseImport(specifier) ||
        isGeneratedDatabaseTypesImport(modulePath) ||
        isSharedSupabaseInfrastructureImport(modulePath)
    );
}

/**
 * TypeScript AST로 production source fixture를 검사한다.
 *
 * @param {Record<string, string>} sources relative production path와 source text
 * @returns {{ filePath: string, line: number, rule: string, message: string }[]}
 */
export function analyzeSources(sources) {
    const diagnostics = [];

    for (const [rawFilePath, sourceText] of Object.entries(sources)) {
        const filePath = normalizeFilePath(rawFilePath);
        if (!isProductionSource(filePath)) {
            continue;
        }

        const sourceFile = ts.createSourceFile(
            filePath,
            sourceText,
            ts.ScriptTarget.Latest,
            true,
            filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        );
        const isClientComponent = hasUseClientDirective(sourceFile);

        const visit = (node) => {
            if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
                const specifier = node.moduleSpecifier.text;
                const modulePath = getModulePath(filePath, specifier);

                if (modulePath === TRANSITIONAL_ALIAS_PATH && filePath !== `${TRANSITIONAL_ALIAS_PATH}.ts`) {
                    diagnostics.push(
                        createDiagnostic(
                            filePath,
                            sourceFile,
                            node.moduleSpecifier,
                            'no-transitional-supabase-alias',
                            'Production code must not import the transitional supabaseClient alias.',
                        ),
                    );
                }

                if (isModuleDomainOrApplication(filePath) && isForbiddenDomainApplicationImport(specifier, modulePath)) {
                    diagnostics.push(
                        createDiagnostic(
                            filePath,
                            sourceFile,
                            node.moduleSpecifier,
                            'domain-application-import',
                            'Domain and Application layers may not import framework or Infrastructure dependencies.',
                        ),
                    );
                }

                const isRoute = isRouteHandler(filePath);
                const isDirectRouteFrameworkImport =
                    isSupabaseImport(specifier) || isGeneratedDatabaseTypesImport(modulePath);
                if (
                    isPresentation(filePath) &&
                    isForbiddenPresentationImport(specifier, modulePath) &&
                    !(
                        isRoute &&
                        isAuthRoute(filePath) &&
                        isDirectRouteFrameworkImport
                    )
                ) {
                    diagnostics.push(
                        createDiagnostic(
                            filePath,
                            sourceFile,
                            node.moduleSpecifier,
                            'presentation-import',
                            'Presentation code must not import Supabase clients, generated database types, or Infrastructure modules.',
                        ),
                    );
                }
            }

            if (ts.isIdentifier(node) && LEGACY_IDENTIFIERS.has(node.text)) {
                diagnostics.push(
                    createDiagnostic(
                        filePath,
                        sourceFile,
                        node,
                        'no-legacy-manager',
                        `Legacy manager identifier "${node.text}" is not allowed in production code.`,
                    ),
                );
            }

            if (
                isClientComponent &&
                ts.isCallExpression(node) &&
                ts.isPropertyAccessExpression(node.expression) &&
                !(ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'Array') &&
                (node.expression.name.text === 'from' || node.expression.name.text === 'rpc')
            ) {
                diagnostics.push(
                    createDiagnostic(
                        filePath,
                        sourceFile,
                        node.expression.name,
                        'no-client-direct-query',
                        `Client Components must not call .${node.expression.name.text}(...) directly.`,
                    ),
                );
            }

            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
    }

    return diagnostics.sort((left, right) =>
        left.filePath.localeCompare(right.filePath) ||
        left.line - right.line ||
        left.rule.localeCompare(right.rule) ||
        left.message.localeCompare(right.message),
    );
}

function readProductionSources(rootDirectory) {
    const sources = {};
    const sourceDirectory = join(rootDirectory, 'src');

    const visitDirectory = (directory) => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const fullPath = join(directory, entry.name);
            if (entry.isDirectory()) {
                visitDirectory(fullPath);
                continue;
            }

            const filePath = normalizeFilePath(relative(rootDirectory, fullPath));
            if (isProductionSource(filePath)) {
                sources[filePath] = readFileSync(fullPath, 'utf8');
            }
        }
    };

    visitDirectory(sourceDirectory);
    return sources;
}

/**
 * 현재 저장소의 production source와 삭제되어야 할 legacy 경로를 검사한다.
 *
 * @param {string} rootDirectory repository root
 * @returns {{ filePath: string, line: number, rule: string, message: string }[]}
 */
export function analyzeRepository(rootDirectory) {
    const normalizedRoot = resolve(rootDirectory);
    const diagnostics = analyzeSources(readProductionSources(normalizedRoot));

    for (const legacyPath of LEGACY_MANAGER_PATHS) {
        if (existsSync(join(normalizedRoot, legacyPath))) {
            diagnostics.push({
                filePath: legacyPath,
                line: 1,
                rule: 'no-legacy-manager',
                message: 'Deleted legacy manager path must not exist.',
            });
        }
    }

    return diagnostics.sort((left, right) =>
        left.filePath.localeCompare(right.filePath) ||
        left.line - right.line ||
        left.rule.localeCompare(right.rule) ||
        left.message.localeCompare(right.message),
    );
}

export function formatDiagnostic(diagnostic) {
    return `${diagnostic.filePath}:${diagnostic.line} [${diagnostic.rule}] ${diagnostic.message}`;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
    const diagnostics = analyzeRepository(process.cwd());
    if (diagnostics.length > 0) {
        console.error(diagnostics.map(formatDiagnostic).join('\n'));
        process.exitCode = 1;
    } else {
        console.log('DDD-lite architecture verification passed.');
    }
}
