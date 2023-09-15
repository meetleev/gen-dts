export interface OutputOptions {
    outDir: string;
    rootModuleName: string;
    nonExportedSymbolDistribution?: Array<{
        /**
         * Regex to match the module name, where the symbol is originally declared.
         */
        sourceModule: RegExp;
        /**
         * Target module, should be in `entries`.
         */
        targetModule: string;
    }>;
    nonExportedExternalLibs?: string[];
    usePathForRootModuleName?: boolean;
    needCopyExternalTypes?: boolean;
}
export interface InputOptions {
    rootDir: string;
    output: OutputOptions | OutputOptions[];
}
export declare function generate(options: InputOptions): Promise<void>;
