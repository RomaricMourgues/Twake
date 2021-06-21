import { Readable } from "stream";
import { createWriteStream, createReadStream, existsSync, mkdirSync } from "fs";
import { StorageConnectorAPI } from "../../provider";
import p from "path";

export type LocalConfiguration = {
  path: string;
};

export default class LocalConnectorService implements StorageConnectorAPI {
  configuration: LocalConfiguration;

  constructor(localConfiguration: LocalConfiguration) {
    this.configuration = localConfiguration;
  }

  write(relativePath: string, stream: Readable): void {
    const path = this.getFullPath(relativePath);

    const directory = p.dirname(path);
    if (!existsSync(directory)) {
      mkdirSync(directory, {
        recursive: true,
      });
    }

    console.log(directory, stream);

    createWriteStream(path).write(stream);
  }

  async read(path: string): Promise<Readable> {
    return createReadStream(this.getFullPath(path));
  }

  private getFullPath(path: string): string {
    return `${this.configuration.path}/${path}`.replace(/\/{2,}/g, "/");
  }
}
