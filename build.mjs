// eslint-disable-next-line simple-import-sort/imports
import swc from "@swc/core";
import { execSync } from "child_process";
import esbuild from "esbuild";
import { readFile } from "fs/promises";
import { createServer } from "http";
import { argv } from "process";

const isFlag = (s, l) => argv.slice(2).some(c => c === `-${s}` || c === `--${l}`);

const isRelease = isFlag("r", "release");
const shouldServe = isFlag("s", "serve");
const shouldWatch = isFlag("w", "watch");

const commitHash = execSync("git rev-parse --short HEAD").toString().trim();

try {
    const ctx = await esbuild.context({
        entryPoints: ["src/entry.js"],
        bundle: true,
        minify: isRelease,
        format: "iife",
        target: "esnext",
        supported: {
            // Hermes does not actually supports const and let, even though it syntactically
            // accepts it, but it's treated just like 'var' and causes issues
            "const-and-let": false
        },
        outfile: "dist/bunny.js",
        keepNames: true,
        footer: {
            js: "//# sourceURL=bunny"
        },
        loader: { ".png": "dataurl" },
        legalComments: "none",
        alias: {
            "@lib/*": "src/lib/*",
            "@core/*": "src/core/*",
            "@metro/*": "src/lib/metro/*",
            "@ui/*": "src/lib/ui/*",
            "@types": "src/utils/types.ts",
        },
        plugins: [
            {
                name: "runtimeGlobalAlias",
                setup: async build => {
                    const globalMap = {
                        "react": "globalThis.React",
                        "react-native": "globalThis.ReactNative"
                    };

                    Object.keys(globalMap).forEach(key => {
                        const filter = new RegExp(`^${key}$`);
                        build.onResolve({ filter }, args => ({
                            namespace: "glob-" + key, path: args.path
                        }));
                        build.onLoad({ filter, namespace: "glob-" + key }, () => ({
                            contents: `Object.defineProperty(module, 'exports', { get: () => ${globalMap[key]} })`,
                            resolveDir: "src",
                        }));
                    });
                }
            },
            {
                name: "buildLog",
                setup: async build => {
                    build.onStart(() => {
                        console.clear();
                        console.log(`Building with commit hash "${commitHash}", isRelease="${isRelease}"`);
                    });

                    build.onEnd(result => {
                        const { outfile } = build.initialOptions;
                        console.log(`Built with ${result.errors?.length} errors!`);
                    });
                }
            },
            {
                name: "swc",
                setup(build) {
                    let timeString = Number(new Date).toString(36);

                    build.onStart(() => {
                        timeString = Number(new Date).toString(36);
                        console.log(`swc plugin: time-string="${timeString}"`);
                    });

                    build.onLoad({ filter: /\.[jt]sx?$/ }, async args => {
                        const result = await swc.transformFile(args.path, {
                            jsc: {
                                externalHelpers: true,
                                transform: {
                                    constModules: {
                                        globals: {
                                            "bunny-build": {
                                                version: `"${isRelease ? commitHash : timeString}"`
                                            }
                                        }
                                    }
                                },
                            },
                            env: {
                                targets: "defaults",
                                include: [
                                    "transform-classes",
                                    "transform-arrow-functions",
                                    "transform-block-scoping",
                                    "transform-class-properties"
                                ],
                                exclude: [
                                    "transform-parameters"
                                ]
                            },
                        });

                        return { contents: result.code };
                    });
                }
            }
        ],
        external: ["commit-hash"]
    });

    if (shouldWatch) {
        await ctx.watch();
        console.log("Watching...");
    }

    if (shouldServe) {
        await ctx.rebuild();

        const server = createServer(async (req, res) => {
            try {
                if (req.url === "/vendetta.js" || req.url === "/pyoncord.js" || req.url === "/bunny.js") {
                    await ctx.rebuild();
                    res.writeHead(200);
                    res.end(await readFile("./dist/bunny.js"), "utf-8");
                } else {
                    res.writeHead(404);
                    res.end();
                }
            } catch (error) {
                res.writeHead(500);
                res.end();
            }
        }).listen(4040);

        // @ts-ignore
        console.log(`Serving on port ${server.address()?.port}, CTRL+C to stop`);
    }

    if (!shouldServe && !shouldWatch) {
        ctx.rebuild();
        ctx.dispose();
    }
} catch (e) {
    console.error("Build failed...", e);
    process.exit(1);
}
