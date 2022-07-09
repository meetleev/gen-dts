export interface IOptions {
    rootDir: string;
    outDir: string;
    rootModuleName: string;
    nonExportedThirdLibs?: string[];
}
export declare function generate(options: IOptions): Promise<boolean | void>;
