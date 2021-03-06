import { Connector } from ".";
import { ConnectionOptions, DatabaseType } from "../..";
import { FindOptions } from "../repository/repository";
import { ColumnDefinition, EntityDefinition } from "../types";
import { ListResult } from "../../crud-service";

export abstract class AbstractConnector<
  T extends ConnectionOptions,
  DatabaseClient
> implements Connector {
  constructor(protected type: DatabaseType, protected options: T) {}

  abstract connect(): Promise<this>;

  abstract drop(): Promise<this>;

  abstract getClient(): DatabaseClient;

  abstract createTable(
    entity: EntityDefinition,
    columns: { [name: string]: ColumnDefinition }
  ): Promise<boolean>;

  abstract upsert(entities: any[]): Promise<boolean[]>;

  abstract remove(entities: any[]): Promise<boolean[]>;

  abstract find<EntityType>(
    entityType: any,
    filters: any,
    options: FindOptions
  ): Promise<ListResult<EntityType>>;

  getOptions(): T {
    return this.options;
  }

  getType(): DatabaseType {
    return this.type;
  }
}
