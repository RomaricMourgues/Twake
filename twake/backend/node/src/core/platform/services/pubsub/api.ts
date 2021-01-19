import { v4 as uuidv4 } from "uuid";
import { Initializable, logger, TwakeServiceProvider } from "../../framework";
import { Processor } from "./processor";

export interface PubsubMessage<T> {
  /**
   * Optional message id, mainly used for logs
   */
  id?: string;

  /**
   * The message payload to process
   */
  data: T;
}

export interface PubsubEventMessage<T> extends PubsubMessage<T> {
  topic: string;
}

export interface IncomingPubsubMessage<T> extends PubsubMessage<T> {
  ack: () => void;
}

export type PubsubListener<T> = (message: IncomingPubsubMessage<T>) => void;

export interface PubsubServiceAPI extends TwakeServiceProvider {
  publish<T>(topic: string, message: PubsubMessage<T>): Promise<void>;
  subscribe<T>(topic: string, listener: PubsubListener<T>): Promise<void>;
  processor: Processor;
}

export type PubsubLayer = Pick<PubsubServiceAPI, "publish" | "subscribe" | "version">;

export interface PubsubEventBus {
  /**
   * Subscribes to events
   */
  subscribe<T>(listener: (message: PubsubEventMessage<T>) => void): this;

  /**
   * Publish message in event bus
   */
  publish<T>(message: PubsubEventMessage<T>): boolean;
}

export abstract class PubsubServiceSubscription {
  protected pubsub: PubsubServiceAPI;

  async subscribe(pubsub: PubsubServiceAPI): Promise<void> {
    if (!pubsub) {
      throw new Error("pubsub service it not defined");
    }
    this.pubsub = pubsub;

    return this.doSubscribe();
  }

  abstract doSubscribe(): Promise<void>;
}

export class PubsubServiceProcessor<In, Out>
  extends PubsubServiceSubscription
  implements Initializable {
  constructor(protected handler: PubsubHandler<In, Out>, protected pubsub: PubsubServiceAPI) {
    super();
  }

  async init(): Promise<this> {
    try {
      await this.subscribe(this.pubsub);
    } catch (err) {
      logger.warn(
        { err },
        `PubsubServiceProcessor.handler.${this.handler.name} -  Not able to start handler`,
      );
    }

    return this;
  }

  async stop(): Promise<this> {
    // TODO
    return this;
  }

  async process(message: IncomingPubsubMessage<In>): Promise<Out> {
    logger.info(
      `PubsubServiceProcessor.handler.${this.handler.name}:${message.id} - Processing message`,
    );
    return this.handler.process(message.data);
  }

  async doSubscribe(): Promise<void> {
    if (this.handler.topics && this.handler.topics.in) {
      logger.info(
        `PubsubServiceProcessor.handler.${this.handler.name} - Subscribing to topic ${this.handler?.topics?.in}`,
      );
      await this.pubsub.subscribe(this.handler.topics.in, this.processMessage.bind(this));
    }
  }

  private async processMessage(message: IncomingPubsubMessage<In>): Promise<void> {
    if (!message.id) {
      message.id = uuidv4();
    }

    if (this.handler.validate) {
      const isValid = this.handler.validate(message.data);

      if (!isValid) {
        logger.error(
          `PubsubServiceProcessor.handler.${this.handler.name}:${message.id} - Message is invalid`,
        );

        return;
      }
    }

    try {
      const result = await this.process(message);

      if (result) {
        await this.sendResult(message, result);
      }
    } catch (error) {
      this.handleError(message, error);
    }
  }

  private async sendResult(message: IncomingPubsubMessage<In>, result: Out): Promise<void> {
    if (!this.handler.topics.out) {
      logger.info(
        `PubsubServiceProcessor.handler.${this.handler.name}:${message.id} - Message processing result is skipped`,
      );
      return;
    }

    logger.info(
      `PubsubServiceProcessor.handler.${this.handler.name}:${message.id} - Sending processing result to ${this.handler.topics.out}`,
    );

    return this.pubsub.publish(this.handler.topics.out, {
      id: uuidv4(),
      data: result,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async handleError(message: IncomingPubsubMessage<In>, err: any) {
    logger.error(
      { err },
      `PubsubServiceProcessor.handler.${this.handler.name}:${message.id} - Error while processing message`,
    );
    if (this.handler.topics.error) {
      this.pubsub.publish(this.handler.topics.error, {
        data: {
          type: "error",
          id: message.id,
          message: err instanceof Error ? (err as Error).message : String(err),
        },
      });
    }
  }
}

/**
 * A pubsub handler is in charge of processing message from a topic and publishing the processing result to another topic
 */
export interface PubsubHandler<InputMessage, OutputMessage> extends Initializable {
  readonly topics: {
    // The topic to subscribe to
    in: string;
    // The topic to push process result to if defined
    out?: string;
    // The topic to push error to. When topic is undefined, do not push the error
    error?: string;
  };

  /**
   * The handler name
   */
  readonly name: string;

  /**
   * Validate the input message
   *
   * @param message message to validate
   */
  validate?(message: InputMessage): boolean;

  /**
   * Process the message and potentially produces result which will be published elsewhere
   * @param message
   */
  process(message: InputMessage): Promise<OutputMessage>;
}