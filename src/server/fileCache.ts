
import fs from 'fs'
import path from 'path'
import http from 'http'
import https from 'https'
import { PassThrough } from 'stream'

// Define the two possible cache roots
export const CACHE_ROOTS = {
    DATA: 'data', // inside global.lx.dataPath (synced)
    ROOT: 'root'  // relative to process.cwd() (not synced)
}

let currentCacheLocation = CACHE_ROOTS.ROOT

// Helper to get actual directory path
const getCacheDir = (username?: string) => {
    let baseDir = ''
    if (currentCacheLocation === CACHE_ROOTS.DATA) {
        baseDir = path.join(global.lx.dataPath, 'cache')
    } else {
        baseDir = path.join(process.cwd(), 'cache')
    }

    // [New] Segment cache by username
    const userDirName = (username && username !== '_open') ? username : '_open'
    return path.join(baseDir, userDirName)
}

// Ensure directory exists
const ensureDir = (username?: string) => {
    const dir = getCacheDir(username)
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
    return dir
}

// Generate consistent filename: Name-Singer-Source-SongId.ext
// Note: We need to sanitize the filename
const getFileName = (songInfo: any, quality?: string) => {
    // Determine extension from metadata or default to mp3
    // Since we don't always know, we might need to guess or save without ext and content-type detection
    // For simplicity, let's assume mp3 or try to extract from URL if possible, otherwise .mp3
    // or we can store metadata in a separate json

    // Sanitize function
    const sanitize = (str: any) => String(str || '').replace(/[\\/:*?"<>|]/g, '_')

    // If we have an extension/type hint, use it. But often we don't until we download.
    // Let's assume .mp3 for playability or detect from content-type.
    // Actually, saving with correct extension is better for players.
    // We will append extension AFTER download if we detect it, or default to .mp3

    const id = songInfo.songmid || songInfo.songId || songInfo.id || 'unknown_id'
    const q = quality || songInfo.quality || 'unknown'
    let name = `${sanitize(songInfo.name || 'Unknown')}-${sanitize(songInfo.singer || 'Unknown')}-${sanitize(songInfo.source || 'unknown')}-${sanitize(id)}-${sanitize(q)}`

    // Debug Log
    // console.log(`[FileCache] Generated filename base: ${name} (ID: ${id})`)

    // Truncate if too long (filesystem limits)
    if (name.length > 200) name = name.substring(0, 200)

    return name
}

// --- Public APIs ---

export const setCacheLocation = (location: string) => {
    if (location === CACHE_ROOTS.DATA || location === CACHE_ROOTS.ROOT) {
        currentCacheLocation = location
        console.log(`[FileCache] Base cache location set to: ${location}`)
    }
}

export const checkCache = (songInfo: any, username?: string) => {
    // songInfo comes from query params, should contain 'quality'
    const dir = getCacheDir(username)
    const baseName = getFileName(songInfo, songInfo.quality)

    // Check for common audio extensions
    const extensions = ['.mp3', '.flac', '.m4a', '.ogg', '.wav']

    for (const ext of extensions) {
        const filePath = path.join(dir, baseName + ext)
        // console.log(`[FileCache] Checking: ${filePath}`)
        if (fs.existsSync(filePath)) {
            // console.log(`[FileCache] Hit: ${filePath}`)
            return {
                exists: true,
                path: filePath,
                filename: baseName + ext,
                url: `/api/music/cache/file/${encodeURIComponent(baseName + ext)}`
            }
        }
    }

    console.log(`[FileCache] Miss: ${baseName} .* (Dir: ${dir})`)
    return { exists: false }
}

export const downloadAndCache = async (songInfo: any, url: string, quality?: string, username?: string) => {
    const dir = ensureDir(username)
    const baseName = getFileName(songInfo, quality)
    const tempPath = path.join(dir, baseName + '.tmp')

    // console.log(`[FileCache] Starting download for: ${baseName} from ${url}`)
    console.log(`[FileCache] Starting download for: ${baseName}`)

    return new Promise<void>((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http

        const req = protocol.get(url, (res) => {
            if (res.statusCode !== 200) {
                fs.unlink(tempPath, () => { })
                reject(new Error(`Failed to download, status: ${res.statusCode}`))
                return
            }

            // Determine extension from Content-Type if possible
            const contentType = res.headers['content-type']
            let ext = '.mp3' // default
            if (contentType) {
                if (contentType.includes('flac')) ext = '.flac'
                else if (contentType.includes('mp4') || contentType.includes('m4a')) ext = '.m4a'
                else if (contentType.includes('ogg')) ext = '.ogg'
                else if (contentType.includes('wav')) ext = '.wav'
            }

            const finalPath = path.join(dir, baseName + ext)
            const fileStream = fs.createWriteStream(tempPath)

            res.pipe(fileStream)

            fileStream.on('finish', () => {
                fileStream.close()
                // Rename temp to final
                fs.rename(tempPath, finalPath, (err) => {
                    if (err) {
                        fs.unlink(tempPath, () => { })
                        reject(err)
                    } else {
                        console.log(`[FileCache] Cached saved to: ${finalPath}`)
                        resolve()
                    }
                })
            })

            fileStream.on('error', (err) => {
                fs.unlink(tempPath, () => { })
                reject(err)
            })
        })

        req.on('error', (err) => {
            fs.unlink(tempPath, () => { })
            reject(err)
        })
    })
}

export const serveCacheFile = (req: http.IncomingMessage, res: http.ServerResponse, filename: string, username?: string) => {
    const dir = getCacheDir(username)
    // Prevent directory traversal
    const safeFilename = path.basename(filename)
    const filePath = path.join(dir, safeFilename)

    if (!fs.existsSync(filePath)) {
        res.writeHead(404)
        res.end('Not Found')
        return
    }

    const stat = fs.statSync(filePath)
    const ext = path.extname(filePath).toLowerCase()

    // Simple MIME map
    const mimeTypes: Record<string, string> = {
        '.mp3': 'audio/mpeg',
        '.flac': 'audio/flac',
        '.m4a': 'audio/mp4',
        '.ogg': 'audio/ogg',
        '.wav': 'audio/wav'
    }

    const contentType = mimeTypes[ext] || 'application/octet-stream'

    // Support Range requests (Critical for audio seeking)
    const range = req.headers.range

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-")
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1
        const chunksize = (end - start) + 1
        const file = fs.createReadStream(filePath, { start, end })

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': contentType,
        })
        file.pipe(res)
    } else {
        res.writeHead(200, {
            'Content-Length': stat.size,
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes' // Advertise support
        })
        fs.createReadStream(filePath).pipe(res)
    }
}

// Get cache statistics
export const getCacheStats = (username?: string) => {
    const dir = getCacheDir(username)

    if (!fs.existsSync(dir)) {
        return { totalSize: 0, fileCount: 0 }
    }

    const files = fs.readdirSync(dir)
    let totalSize = 0
    let fileCount = 0

    const extensions = ['.mp3', '.flac', '.m4a', '.ogg', '.wav']

    for (const file of files) {
        const ext = path.extname(file).toLowerCase()
        if (extensions.includes(ext)) {
            const filePath = path.join(dir, file)
            try {
                const stats = fs.statSync(filePath)
                totalSize += stats.size
                fileCount++
            } catch (e) {
                // Skip files that can't be stat'd
            }
        }
    }

    return { totalSize, fileCount }
}

// Clear all cache files
export const clearAllCache = (username?: string) => {
    const dir = getCacheDir(username)

    if (!fs.existsSync(dir)) {
        return { deletedCount: 0, freedSize: 0 }
    }

    const files = fs.readdirSync(dir)
    let deletedCount = 0
    let freedSize = 0

    const extensions = ['.mp3', '.flac', '.m4a', '.ogg', '.wav', '.tmp']

    for (const file of files) {
        const ext = path.extname(file).toLowerCase()
        if (extensions.includes(ext)) {
            const filePath = path.join(dir, file)
            try {
                const stats = fs.statSync(filePath)
                const size = stats.size
                fs.unlinkSync(filePath)
                deletedCount++
                freedSize += size
                console.log(`[FileCache] Deleted: ${file} (${size} bytes)`)
            } catch (e: any) {
                console.error(`[FileCache] Failed to delete ${file}:`, e.message)
            }
        }
    }

    console.log(`[FileCache] Cache cleared: ${deletedCount} files, ${freedSize} bytes freed`)
    return { deletedCount, freedSize }
}
