import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Storage is abstracted behind this interface so the same document-gen
 * code path runs unchanged in local dev (disk) and in Azure (Blob
 * Storage) — only the wiring in apps/api picks which implementation to
 * construct, based on STORAGE_DRIVER.
 */
export interface ObjectStorage {
  /** Persists a buffer under `key` and returns the storage path/key used to retrieve it later. */
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  get(key: string): Promise<Buffer>;
}

export class LocalDiskStorage implements ObjectStorage {
  constructor(private readonly rootDir: string) {}

  async put(key: string, data: Buffer): Promise<string> {
    const fullPath = join(this.rootDir, key);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, data);
    return key;
  }

  async get(key: string): Promise<Buffer> {
    const fullPath = join(this.rootDir, key);
    await stat(fullPath); // surfaces a clear ENOENT if the file is missing
    return readFile(fullPath);
  }
}

/**
 * Azure Blob Storage implementation. Depends on @azure/storage-blob, which
 * is intentionally NOT a hard dependency of this package (it's dynamically
 * imported) so local development and tests never need it installed.
 */
export class AzureBlobStorage implements ObjectStorage {
  constructor(
    private readonly connectionString: string,
    private readonly containerName: string,
  ) {}

  private async getContainerClient() {
    // Imported via a non-literal specifier (rather than a static import)
    // so TypeScript treats this as `any` instead of requiring
    // @azure/storage-blob's types to be resolvable — it's an optional
    // dependency (see package.json) only needed when STORAGE_DRIVER=azure.
    const azureStorageBlobModuleName = "@azure/storage-blob";
    const { BlobServiceClient } = await import(azureStorageBlobModuleName);
    const serviceClient = BlobServiceClient.fromConnectionString(this.connectionString);
    const containerClient = serviceClient.getContainerClient(this.containerName);
    await containerClient.createIfNotExists();
    return containerClient;
  }

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    const containerClient = await this.getContainerClient();
    const blockBlobClient = containerClient.getBlockBlobClient(key);
    await blockBlobClient.uploadData(data, {
      blobHTTPHeaders: { blobContentType: contentType },
    });
    return key;
  }

  async get(key: string): Promise<Buffer> {
    const containerClient = await this.getContainerClient();
    const blockBlobClient = containerClient.getBlockBlobClient(key);
    const downloaded = await blockBlobClient.downloadToBuffer();
    return downloaded;
  }
}

export function createObjectStorage(env: {
  STORAGE_DRIVER?: string;
  LOCAL_STORAGE_DIR?: string;
  AZURE_STORAGE_CONNECTION_STRING?: string;
  AZURE_STORAGE_CONTAINER?: string;
}): ObjectStorage {
  if (env.STORAGE_DRIVER === "azure") {
    if (!env.AZURE_STORAGE_CONNECTION_STRING || !env.AZURE_STORAGE_CONTAINER) {
      throw new Error("AZURE_STORAGE_CONNECTION_STRING and AZURE_STORAGE_CONTAINER are required when STORAGE_DRIVER=azure");
    }
    return new AzureBlobStorage(env.AZURE_STORAGE_CONNECTION_STRING, env.AZURE_STORAGE_CONTAINER);
  }
  return new LocalDiskStorage(env.LOCAL_STORAGE_DIR ?? "./storage");
}
