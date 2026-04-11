import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { SyncState } from "../types/types.js";

export class StateStore {
  constructor(private readonly filePath: string) {}

  async read(): Promise<SyncState> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<SyncState>;
      return { lastSyncedAt: parsed.lastSyncedAt };
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? (e as NodeJS.ErrnoException).code : "";
      if (code === "ENOENT") return {};
      throw e;
    }
  }

  async write(state: SyncState): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(state, null, 2), "utf8");
  }

  async touchLastSynced(): Promise<void> {
    await this.write({ lastSyncedAt: new Date().toISOString() });
  }
}
