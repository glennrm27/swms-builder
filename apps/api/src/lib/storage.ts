import { createObjectStorage, type ObjectStorage } from "@swms/document-gen";
import { env } from "../env.js";

let storageSingleton: ObjectStorage | undefined;

export function getStorage(): ObjectStorage {
  if (!storageSingleton) {
    storageSingleton = createObjectStorage(env);
  }
  return storageSingleton;
}
