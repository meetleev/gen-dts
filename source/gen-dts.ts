import {readdir, ensureDirSync, copyFileSync, unlinkSync, existsSync, writeFile, outputFile, unlink} from 'fs-extra';
import ts from 'typescript';
import {bundle} from 'tfig';
import {basename, dirname, extname, isAbsolute, join} from 'path';

export interface IOptions {
    rootDir: string;
    outDir: string;
    rootModuleName: string;
    nonExportedThirdLibs?: string[];
}

async function getSourceEntries(engine: string) {
    const result: Record<string, string> = {};
    const entryRootDir = join(engine, 'exports');
    const entryFileNames = await readdir(entryRootDir);
    for (const entryFileName of entryFileNames) {
        const entryExtName = extname(entryFileName);
        if (!entryExtName.toLowerCase().endsWith('.ts')) {
            continue;
        }
        const entryBaseNameNoExt = basename(entryFileName, entryExtName);
        const entryName = `ccx.${entryBaseNameNoExt}`;
        result[entryName] = `exports/${entryBaseNameNoExt}`;
    }
    return result;
}

export async function generate(options: IOptions) {
    console.log(`Typescript version: ${ts.version}`);

    const {rootDir, outDir, rootModuleName, nonExportedThirdLibs} = options;
    ensureDirSync(outDir);

    const tsConfigPath = join(rootDir, 'tsconfig.json');

    const unbundledOutFile = join(outDir, `before-rollup.js`);
    const parsedCommandLine = ts.getParsedCommandLineOfConfigFile(
        tsConfigPath, {
            declaration: true,
            noEmit: false,
            emitDeclarationOnly: true,
            outFile: unbundledOutFile,
            outDir: undefined,
        }, {
            onUnRecoverableConfigFileDiagnostic: () => {
            },
            useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
            readDirectory: ts.sys.readDirectory,
            getCurrentDirectory: ts.sys.getCurrentDirectory,
            fileExists: ts.sys.fileExists,
            readFile: ts.sys.readFile,
        }
    );

    // console.log('parsedCommandLine', parsedCommandLine);
    const outputJSPath = join(dirname(tsConfigPath), unbundledOutFile);
    // console.log('outputJSPath', outputJSPath);

    const extName = extname(outputJSPath);
    if (extName !== '.js') {
        console.error(`Unexpected output extension ${extName}, please check it.`);
        return undefined;
    }
    const dirName = dirname(outputJSPath);
    const baseName = basename(outputJSPath, extName);
    const destExtensions = [
        '.d.ts',
        '.d.ts.map',
    ];
    for (const destExtension of destExtensions) {
        const destFile = join(dirName, baseName + destExtension);
        if (existsSync(destFile)) {
            console.log(`Delete old ${destFile}.`);
            unlinkSync(destFile);
        }
    }

    console.log(`Generating...`);

    if (undefined == parsedCommandLine) return console.log('parsedCommandLine null');
    const program = ts.createProgram(parsedCommandLine.fileNames, parsedCommandLine.options);
    const emitResult = program.emit(
        undefined, // targetSourceFile
        undefined, // writeFile
        undefined, // cancellationToken,
        true, // emitOnlyDtsFiles
        undefined, // customTransformers
    );

    let allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
    for (const diagnostic of allDiagnostics) {
        let printer;
        switch (diagnostic.category) {
            case ts.DiagnosticCategory.Error:
                printer = console.error;
                break;
            case ts.DiagnosticCategory.Warning:
                printer = console.warn;
                break;
            case ts.DiagnosticCategory.Message:
            case ts.DiagnosticCategory.Suggestion:
            default:
                printer = console.log;
                break;
        }
        if (!printer) {
            continue;
        }
        if (diagnostic.file) {
            let {line, character} = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start as number);
            let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '');
            printer(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
        } else {
            printer(`${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`);
        }
    }

    const tscOutputDtsFile = join(dirName, baseName + '.d.ts');
    // console.log('tscOutputDtsFile', tscOutputDtsFile)
    if (!existsSync(tscOutputDtsFile)) {
        console.error(`Failed to compile.`);
        return false;
    }

    const types = (parsedCommandLine.options?.types ?? []).map((typeFile) => `${typeFile}.d.ts`);
    console.log('types', types);
    types?.forEach((file) => {
        const destPath = join(outDir, isAbsolute(file) ? basename(file) : file);
        ensureDirSync(dirname(destPath));
        copyFileSync(file, destPath);
    });

    const entryMap = await getSourceEntries(rootDir);
    console.log('entryMap', entryMap);
    const entries = Object.keys(entryMap);

    const dtsFile = join(dirName, 'virtual-dts.d.ts');
    await (async () => {
        const ccModules = entries.slice().map((extern) => entryMap[extern]);
        const code = `declare module 'ccx' {\n${ccModules.map((moduleId) => `    export * from "${moduleId}";`).join('\n')}\n}`;
        await writeFile(dtsFile, code, {encoding: 'utf8'});
    })();

    console.log(`Bundling...`);
    let cleanupFiles = [tscOutputDtsFile, dtsFile];
    try {
        const giftInputPath = tscOutputDtsFile;
        const giftOutputPath = join(dirName, `${rootModuleName}.d.ts`);
        const giftResult = bundle({
            input: [giftInputPath, dtsFile],
            /*name: 'cc',
            rootModule: 'index',*/
            entries: {
                'ccx': 'ccx',
            },
            groups: [
                {test: /^ccx.*$/, path: giftOutputPath},
            ],
            nonExportedThirdLibs: nonExportedThirdLibs,
        });
        await Promise.all(giftResult.groups.map(async (group) => {
            let code = group.code.replace(/(module\s+)\"(.*)\"(\s+\{)/g, `$1${rootModuleName}$3`);
            await outputFile(group.path, code, {encoding: 'utf8'});
        }));
    } catch (error) {
        console.error(error);
        return false;
    } finally {
        await Promise.all((cleanupFiles.map(async (file) => unlink(file))));
    }
    return true;
}