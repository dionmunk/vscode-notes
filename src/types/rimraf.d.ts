declare module 'rimraf' {
    function rimraf(path: string, callback: (error: Error | null) => void): void;
    export = rimraf;
}
