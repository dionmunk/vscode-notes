declare module 'mkdirp' {
    function mkdirp(dir: string): Promise<string>;
    export = mkdirp;
}
