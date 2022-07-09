"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generate = void 0;
const fs = __importStar(require("fs-extra"));
const typescript_1 = __importDefault(require("typescript"));
const gift = __importStar(require("tfig"));
const ps = __importStar(require("path"));
function getSourceEntries(engine) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = {};
        const entryRootDir = ps.join(engine, 'exports');
        const entryFileNames = yield fs.readdir(entryRootDir);
        for (const entryFileName of entryFileNames) {
            const entryExtName = ps.extname(entryFileName);
            if (!entryExtName.toLowerCase().endsWith('.ts')) {
                continue;
            }
            const entryBaseNameNoExt = ps.basename(entryFileName, entryExtName);
            const entryName = `ccx.${entryBaseNameNoExt}`;
            result[entryName] = `exports/${entryBaseNameNoExt}`;
        }
        return result;
    });
}
function generate(options) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Typescript version: ${typescript_1.default.version}`);
        const { rootDir, outDir, rootModuleName, nonExportedThirdLibs } = options;
        fs.ensureDirSync(outDir);
        const tsConfigPath = ps.join(rootDir, 'tsconfig.json');
        const unbundledOutFile = ps.join(outDir, `before-rollup.js`);
        const parsedCommandLine = typescript_1.default.getParsedCommandLineOfConfigFile(tsConfigPath, {
            declaration: true,
            noEmit: false,
            emitDeclarationOnly: true,
            outFile: unbundledOutFile,
            outDir: undefined,
        }, {
            onUnRecoverableConfigFileDiagnostic: () => {
            },
            useCaseSensitiveFileNames: typescript_1.default.sys.useCaseSensitiveFileNames,
            readDirectory: typescript_1.default.sys.readDirectory,
            getCurrentDirectory: typescript_1.default.sys.getCurrentDirectory,
            fileExists: typescript_1.default.sys.fileExists,
            readFile: typescript_1.default.sys.readFile,
        });
        // console.log('parsedCommandLine', parsedCommandLine);
        const outputJSPath = ps.join(ps.dirname(tsConfigPath), unbundledOutFile);
        // console.log('outputJSPath', outputJSPath);
        const extName = ps.extname(outputJSPath);
        if (extName !== '.js') {
            console.error(`Unexpected output extension ${extName}, please check it.`);
            return undefined;
        }
        const dirName = ps.dirname(outputJSPath);
        const baseName = ps.basename(outputJSPath, extName);
        const destExtensions = [
            '.d.ts',
            '.d.ts.map',
        ];
        for (const destExtension of destExtensions) {
            const destFile = ps.join(dirName, baseName + destExtension);
            if (fs.existsSync(destFile)) {
                console.log(`Delete old ${destFile}.`);
                fs.unlinkSync(destFile);
            }
        }
        console.log(`Generating...`);
        if (undefined == parsedCommandLine)
            return console.log('parsedCommandLine null');
        const program = typescript_1.default.createProgram(parsedCommandLine.fileNames, parsedCommandLine.options);
        const emitResult = program.emit(undefined, // targetSourceFile
        undefined, // writeFile
        undefined, // cancellationToken,
        true, // emitOnlyDtsFiles
        undefined);
        let allDiagnostics = typescript_1.default.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
        for (const diagnostic of allDiagnostics) {
            let printer;
            switch (diagnostic.category) {
                case typescript_1.default.DiagnosticCategory.Error:
                    printer = console.error;
                    break;
                case typescript_1.default.DiagnosticCategory.Warning:
                    printer = console.warn;
                    break;
                case typescript_1.default.DiagnosticCategory.Message:
                case typescript_1.default.DiagnosticCategory.Suggestion:
                default:
                    printer = console.log;
                    break;
            }
            if (!printer) {
                continue;
            }
            if (diagnostic.file) {
                let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                let message = typescript_1.default.flattenDiagnosticMessageText(diagnostic.messageText, '');
                printer(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
            }
            else {
                printer(`${typescript_1.default.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`);
            }
        }
        const tscOutputDtsFile = ps.join(dirName, baseName + '.d.ts');
        // console.log('tscOutputDtsFile', tscOutputDtsFile)
        if (!fs.existsSync(tscOutputDtsFile)) {
            console.error(`Failed to compile.`);
            return false;
        }
        const types = (_b = (_a = parsedCommandLine.options) === null || _a === void 0 ? void 0 : _a.types) === null || _b === void 0 ? void 0 : _b.map((typeFile) => `${typeFile}.d.ts`);
        console.log('types', types);
        types === null || types === void 0 ? void 0 : types.forEach((file) => {
            const destPath = ps.join(outDir, ps.isAbsolute(file) ? ps.basename(file) : file);
            fs.ensureDirSync(ps.dirname(destPath));
            fs.copyFileSync(file, destPath);
        });
        const entryMap = yield getSourceEntries(rootDir);
        console.log('entryMap', entryMap);
        const entries = Object.keys(entryMap);
        const dtsFile = ps.join(dirName, 'virtual-dts.d.ts');
        yield (() => __awaiter(this, void 0, void 0, function* () {
            const ccModules = entries.slice().map((extern) => entryMap[extern]);
            const code = `declare module 'ccx' {\n${ccModules.map((moduleId) => `    export * from "${moduleId}";`).join('\n')}\n}`;
            yield fs.writeFile(dtsFile, code, { encoding: 'utf8' });
        }))();
        console.log(`Bundling...`);
        let cleanupFiles = [tscOutputDtsFile, dtsFile];
        try {
            const giftInputPath = tscOutputDtsFile;
            const giftOutputPath = ps.join(dirName, `${rootModuleName}.d.ts`);
            const giftResult = gift.bundle({
                input: [giftInputPath, dtsFile],
                /*name: 'cc',
                rootModule: 'index',*/
                entries: {
                    'ccx': 'ccx',
                },
                groups: [
                    { test: /^ccx.*$/, path: giftOutputPath },
                ],
                nonExportedThirdLibs: nonExportedThirdLibs,
            });
            yield Promise.all(giftResult.groups.map((group) => __awaiter(this, void 0, void 0, function* () {
                let code = group.code.replace(/(module\s+)\"(.*)\"(\s+\{)/g, `$1${rootModuleName}$3`);
                yield fs.outputFile(group.path, code, { encoding: 'utf8' });
            })));
        }
        catch (error) {
            console.error(error);
            return false;
        }
        finally {
            yield Promise.all((cleanupFiles.map((file) => __awaiter(this, void 0, void 0, function* () { return fs.unlink(file); }))));
        }
        return true;
    });
}
exports.generate = generate;
//# sourceMappingURL=gen-dts.js.map