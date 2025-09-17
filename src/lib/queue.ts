const downloadQueue: (() => Promise<void>)[] = [];
let currentlyDownloading = 0;
let maxConcurrentDownloads = 4;

export const setMaxConcurrentDownloads = (threads: number) => {
    maxConcurrentDownloads = threads || 4;
}

const processQueue = async () => {
    if (currentlyDownloading >= maxConcurrentDownloads || downloadQueue.length === 0) {
        return;
    }

    while (currentlyDownloading < maxConcurrentDownloads && downloadQueue.length > 0) {
        currentlyDownloading++;
        const task = downloadQueue.shift();
        if (task) {
            try {
                await task();
            } catch (error) {
                console.error("A download task failed:", error);
            } finally {
                currentlyDownloading--;
                processQueue();
            }
        } else {
             currentlyDownloading--;
        }
    }
}

export const addTaskToQueue = (task: () => Promise<void>) => {
    downloadQueue.push(task);
    processQueue();
}
