import { DatabaseServiceAPI } from "../../../core/platform/services/database/api";
import yargs from "yargs";
import twake from "../../../twake";
import { PhpMessagesService } from "./php-message/php-message-service";
import UserServiceAPI from "../../../services/user/api";
import ChannelServiceAPI from "../../../services/channels/provider";
import { convertUuidV4ToV1 } from "./php-message/utils";
import Company from "../../../services/user/entities/company";
import { Pagination } from "../../../core/platform/framework/api/crud-service";
import { PhpMessage } from "./php-message/php-message-entity";
import Table from "cli-table";
import ora from "ora";
import { TwakePlatform } from "../../../core/platform/platform";
import { Channel } from "../../../services/channels/entities";
import { DirectChannel } from "../../../services/channels/entities/direct-channel";
import { MessageServiceAPI } from "../../../services/messages/api";
import { Message } from "../../../services/messages/entities/messages";
import { Thread } from "../../../services/messages/entities/threads";

/**
 * Merge command parameters. Check the builder definition below for more details.
 */
type CLIArgs = {
  //id: string;
};

class MessageMigrator {
  private database: DatabaseServiceAPI;
  private userService: UserServiceAPI;
  private channelService: ChannelServiceAPI;
  private phpMessageService: PhpMessagesService;
  private nodeMessageService: MessageServiceAPI;

  constructor(readonly platform: TwakePlatform) {
    this.database = this.platform.getProvider<DatabaseServiceAPI>("database");
    this.userService = this.platform.getProvider<UserServiceAPI>("user");
    this.channelService = this.platform.getProvider<ChannelServiceAPI>("channels");
    this.phpMessageService = new PhpMessagesService(this.database);
    this.nodeMessageService = this.platform.getProvider<MessageServiceAPI>("messages");
  }

  public async run() {
    await this.phpMessageService.init();

    // Get all companies
    let page: Pagination = { limitStr: "100" };
    // For each companies find workspaces
    do {
      const companyListResult = await this.userService.companies.getCompanies(page);
      page = companyListResult.nextPage as Pagination;

      for (const company of companyListResult.getEntities()) {
        await this.migrateCompanyDirectMessages(company);

        await this.migrateCompanyChannelsMessages(company);
        console.log(`${company.id} - Successfully migrated php messages to node ✅`);
      }
    } while (page.page_token);
  }

  /**
   *  Set all direct messages in company and set them to channelPhpMessages
   */
  private async migrateCompanyDirectMessages(company: Company) {
    let pageDirectChannels: Pagination = { limitStr: "100" };
    // For each directChannels find messages
    do {
      const directChannelsInCompanyResult = await this.channelService.channels.getDirectChannelsInCompany(
        pageDirectChannels,
        company.id,
      );
      pageDirectChannels = directChannelsInCompanyResult.nextPage as Pagination;

      for (const directChannel of directChannelsInCompanyResult.getEntities()) {
        await this.migrateChannelsMessages(company, directChannel);
      }
    } while (pageDirectChannels.page_token);
  }
  /**
   * Set all messages in company and set them to channelPhpMessages
   */
  private async migrateCompanyChannelsMessages(company: Company) {
    // Get all workspaces in company
    const workspacesInCompany = (
      await this.userService.workspaces.getWorkspaces({ limitStr: "" }, { company_id: company.id })
    ).getEntities();

    // For each workspaces find channels
    for (const workspace of workspacesInCompany) {
      // Get all channels in workspace
      let pageChannels: Pagination = { limitStr: "1" };
      do {
        const channelsInWorkspace = await this.channelService.channels.list(
          pageChannels,
          {},
          {
            workspace: {
              workspace_id: workspace.id,
              company_id: workspace.group_id,
            },
            user: { id: null },
            serverRequest: true,
          },
        );
        pageChannels = channelsInWorkspace.nextPage as Pagination;

        // For each channels find messages
        for (const channel of channelsInWorkspace.getEntities()) {
          await this.migrateChannelsMessages(company, channel);
        }
      } while (pageChannels.page_token);
    }
  }

  //Params: company, channel
  private async migrateChannelsMessages(company: Company, channel: Channel | DirectChannel) {
    //This function will migrate all messages in a channel
    const directChannel = channel as DirectChannel;
    const basicChannel = channel as Channel;
    let pagePhpMessages: Pagination = { limitStr: "100" };
    do {
      const messages = await this.phpMessageService.list(
        pagePhpMessages,
        {},
        {
          channel_id: convertUuidV4ToV1(basicChannel.id || directChannel.channel_id),
          user: { id: null },
        },
      );

      for (const message of messages.getEntities()) {
        await this.migrateMessage(company, basicChannel || directChannel, message);
      }

      pagePhpMessages = messages.nextPage as Pagination;
    } while (pagePhpMessages.page_token);
  }

  /**
   *  Migrate php message to node
   * @param company
   * @param channel
   * @param message
   */
  private async migrateMessage(
    company: Company,
    channel: Channel | DirectChannel,
    message: PhpMessage,
  ) {
    // If php message is node message
    if (message.id && message.parent_message_id.length) {
      await this.migratePhpMessageToNodeMessage(message);
    }

    // If php message is node thread
    if (message.id && !message.parent_message_id.length) {
      await this.migratePhpMessageToNodeThread(message);
    }
  }

  private async migratePhpMessageToNodeThread(message: PhpMessage) {
    const thread = new Thread();

    // Set nodeThread values
    thread.id = message.id;
    thread.created_at = new Date().getDate(); // TODO
    thread.last_activity = new Date().getDate(); // TODO
    thread.answers = 0; // TODO
    thread.participants = []; // TODO

    // Create nodeThread
    return await this.nodeMessageService.threads.create(thread, {
      user: { id: null },
      serverRequest: true,
    });
  }

  private async migratePhpMessageToNodeMessage(message: PhpMessage) {
    const nodeMessage = new Message();
    nodeMessage.id = message.id;
    nodeMessage.thread_id = message.parent_message_id;
    nodeMessage.type = "message";
    nodeMessage.subtype = null; // TODO
    nodeMessage.created_at = new Date().getDate(); // TODO
    nodeMessage.user_id = ""; // TODO
    nodeMessage.edited = { edited_at: new Date().getDate() }; // TODO
    nodeMessage.application_id = ""; // TODO
    nodeMessage.text = ""; // TODO
    nodeMessage.blocks = []; // TODO
    nodeMessage.context = ""; // TODO

    // Create nodeMessage
    return await this.nodeMessageService.messages.create(nodeMessage, {
      user: { id: null },
      serverRequest: true,
    });
  }
}

const services = [
  "user",
  "channels",
  "notifications",
  "database",
  "webserver",
  "pubsub",
  "messages",
];

const command: yargs.CommandModule<unknown, CLIArgs> = {
  command: "message",
  describe: "command that allow you to migrate php messages to node",
  handler: async argv => {
    const spinner = ora({ text: "Migrating php messages - " }).start();
    const platform = await twake.run(services);
    const migrator = new MessageMigrator(platform);
    await migrator.run();

    return spinner.stop();
  },
};

export default command;
