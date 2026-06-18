export function getIsPathExcluded(path: string): boolean {
    const pathWithoutQueryString = path.split(/[?#]/)[0]
    const lowercasedPath = pathWithoutQueryString.toLowerCase()

    const excludedPrefixes = [
        "/_next/",
        "/_nuxt/",
        "/_astro/",
        "/_app/",
        "/__nextjs",
        "/__vite_ping",
        "/__webpack_hmr",
        "/@vite/",
        "/@fs/",
        "/@id/",
        "/@react-refresh",
        "/node_modules/",
        "/_vercel/",
        "/sockjs-node/",
        "/webpack-dev-server/",
    ]

    const excludedSuffixes = [
        ".ico",
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".webp",
        ".svg",
        ".bmp",
        ".tiff",
        ".avif",
        ".heic",
        ".heif",
        ".css",
        ".js",
        ".mjs",
        ".ts",
        ".jsx",
        ".tsx",
        ".map",
        ".wasm",
        ".woff",
        ".woff2",
        ".ttf",
        ".otf",
        ".eot",
        ".mp3",
        ".mp4",
        ".webm",
        ".wav",
        ".ogg",
        ".aac",
        ".m4a",
        ".flac",
        ".mov",
        ".avi",
        ".flv",
        ".m4v",
        ".webmanifest",
        ".pdf",
        ".zip",
        ".gz",
    ]

    return excludedPrefixes.some((excludedPrefix) => {
        return lowercasedPath.startsWith(excludedPrefix.toLowerCase())
    }) || excludedSuffixes.some((excludedSuffix) => {
        return lowercasedPath.endsWith(excludedSuffix.toLowerCase())
    })
}
