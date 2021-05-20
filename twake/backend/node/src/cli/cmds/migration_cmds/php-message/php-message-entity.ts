import { Type } from "class-transformer";
import { merge } from "lodash";
import {
  Column,
  Entity,
} from "../../../../core/platform/services/database/services/orm/decorators";

export const TYPE = "message";
@Entity(TYPE, {
  primaryKey: [["channel_id"], "parent_message_id", "id"],
  type: TYPE,
})
export class PhpMessage {
  @Type(() => String)
  @Column("id", "timeuuid", { generator: "timeuuid" })
  id: string;

  @Type(() => String)
  @Column("channel_id", "timeuuid")
  channel_id: string;

  @Type(() => String)
  @Column("parent_message_id", "encoded_string")
  parent_message_id: string;
}

export type PhpMessagePrimaryKey = Pick<PhpMessage, "parent_message_id" | "channel_id" | "id">;

export function getInstance(message: PhpMessage): PhpMessage {
  return merge(new PhpMessage(), message);
}
