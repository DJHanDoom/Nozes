import JSZip from 'jszip';
import { Project, Language } from '../types';
import { generateStandaloneHTML } from './htmlGenerator';

interface ImageMap {
    originalUrl: string;
    localPath: string;
    blob: Blob;
}

const getExtensionFromUrl = (url: string): string => {
    try {
        const parts = url.split('.');
        const ext = parts[parts.length - 1].split(/[?#]/)[0].toLowerCase();
        if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) {
            return ext;
        }
    } catch (e) {
        // ignore
    }
    return 'jpg'; // fallback
};

const getExtensionFromMime = (mime: string): string => {
    switch (mime) {
        case 'image/jpeg': return 'jpg';
        case 'image/png': return 'png';
        case 'image/webp': return 'webp';
        case 'image/gif': return 'gif';
        case 'image/svg+xml': return 'svg';
        default: return 'jpg';
    }
};

export const generateOfflineZip = async (project: Project, lang: Language): Promise<Blob> => {
    const zip = new JSZip();
    const imagesFolder = zip.folder("images");

    if (!imagesFolder) {
        throw new Error("Failed to create images folder in zip");
    }

    // 1. Collect all unique image URLs
    const uniqueUrls = new Set<string>();

    project.entities.forEach(e => {
        if (e.imageUrl) uniqueUrls.add(e.imageUrl);
    });

    project.features.forEach(f => {
        if (f.imageUrl) uniqueUrls.add(f.imageUrl);
        f.states.forEach(s => {
            if (s.imageUrl) uniqueUrls.add(s.imageUrl);
        });
    });

    // 2. Download images
    const urlMap = new Map<string, string>(); // originalUrl -> localPath (relative to html)
    const urls = Array.from(uniqueUrls);

    // Process in batches to avoid overwhelming browser/network
    const BATCH_SIZE = 5;

    const log: string[] = [];
    log.push(`Export started at ${new Date().toISOString()}`);
    log.push(`Found ${urls.length} unique image URLs`);

    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        const batch = urls.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (url, idx) => {
            try {
                // Skip base64 images
                if (url.startsWith('data:')) {
                    log.push(`Skipped base64 image: ${url.substring(0, 30)}...`);
                    return;
                }

                let blob: Blob;

                try {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`Status ${response.status}`);
                    blob = await response.blob();
                    log.push(`Direct download OK: ${url}`);
                } catch (directError) {
                    // Fallback to CORS proxy
                    try {
                        log.push(`Direct failed for ${url}, trying proxy...`);
                        const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
                        const proxyResponse = await fetch(proxyUrl);
                        if (!proxyResponse.ok) throw new Error(`Proxy Status ${proxyResponse.status}`);
                        blob = await proxyResponse.blob();
                        log.push(`Proxy download OK: ${url}`);
                    } catch (proxyError) {
                        throw new Error(`Failed direct and proxy download: ${(directError as Error).message} / ${(proxyError as Error).message}`);
                    }
                }

                const mimeType = blob.type;
                const ext = getExtensionFromMime(mimeType) || getExtensionFromUrl(url);

                const filename = `img_${i + idx}.${ext}`;
                const localPath = `images/${filename}`;

                imagesFolder.file(filename, blob);
                urlMap.set(url, localPath);
            } catch (error) {
                console.warn(`Failed to download image: ${url}`, error);
                log.push(`FAILED: ${url} - ${(error as Error).message}`);
            }
        }));
    }

    zip.file("debug_export_log.txt", log.join('\n'));

    // 3. Create a deep copy of the project with replaced URLs
    const offlineProject: Project = JSON.parse(JSON.stringify(project));

    // Helper to replace URL
    const replaceUrl = (url?: string): string | undefined => {
        if (!url) return url;
        if (urlMap.has(url)) return urlMap.get(url);
        return url;
    };

    offlineProject.entities.forEach(e => {
        e.imageUrl = replaceUrl(e.imageUrl);
    });

    offlineProject.features.forEach(f => {
        f.imageUrl = replaceUrl(f.imageUrl);
        f.states.forEach(s => {
            s.imageUrl = replaceUrl(s.imageUrl);
        });
    });

    // 4. Generate HTML
    const htmlContent = generateStandaloneHTML(offlineProject, lang);
    zip.file("index.html", htmlContent);

    // 5. Generate ZIP blob
    return await zip.generateAsync({ type: "blob" });
};
