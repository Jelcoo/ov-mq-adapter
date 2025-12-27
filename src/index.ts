import "dotenv/config";
import amqp from 'amqplib';
import { Subscriber } from 'zeromq';

const RABBIT_ENDPOINT = `amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASSWORD}@${process.env.RABBITMQ_ENDPOINT}`;

interface QueueConfig {
  ndovTopic: string;
  rabbitQueue: string;
  durable: boolean;
  persistentMessages: boolean;
}

const queues: QueueConfig[] = [
  {
    ndovTopic: '/RIG/NStreinpositiesInterface5',
    rabbitQueue: 'treinposities',
    durable: false,
    persistentMessages: false,
  },
];

async function run() {
  const conn = await amqp.connect(RABBIT_ENDPOINT);

  for (const queue of queues) {
    const channel = await conn.createChannel();
    await channel.assertQueue(queue.rabbitQueue, { durable: queue.durable });

    const sock = new Subscriber();
    sock.connect(process.env.NDOV_ENDPOINT!);
    sock.subscribe(queue.ndovTopic);
    console.log(`Subscribed to ${queue.ndovTopic}, sending to ${queue.rabbitQueue}`)

    for await (const [_topic, message] of sock) {
      try {
        channel.sendToQueue(queue.rabbitQueue, message, { persistent: queue.persistentMessages });
      } catch (err) {
        console.error('Failed to publish to RabbitMQ:', err);
      }
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
