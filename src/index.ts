import 'dotenv/config';
import amqp from 'amqplib';
import { Subscriber } from 'zeromq';

const RABBIT_ENDPOINT = `amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASSWORD}@${process.env.RABBITMQ_ENDPOINT}`;

type DestinationType = 'queue' | 'exchange';

interface DestinationConfig {
  ndovTopic: string;
  type: DestinationType;
  name: string;
  durable: boolean;
  persistentMessages: boolean;
  exchangeType?: string;
  routingKey?: string;
}

const destinations: DestinationConfig[] = [
  {
    ndovTopic: '/RIG/NStreinpositiesInterface5',
    type: 'exchange',
    name: 'treinposities',
    durable: false,
    persistentMessages: false,
    exchangeType: 'fanout',
    routingKey: '',
  },
];

async function run() {
  const conn = await amqp.connect(RABBIT_ENDPOINT);

  for (const dest of destinations) {
    const channel = await conn.createChannel();

    if (dest.type === 'queue') {
      await channel.assertQueue(dest.name, { durable: dest.durable });
    } else {
      const exchangeType = dest.exchangeType ?? 'fanout';
      await channel.assertExchange(dest.name, exchangeType, { durable: dest.durable });
    }

    const sock = new Subscriber();
    sock.connect(process.env.NDOV_ENDPOINT!);
    sock.subscribe(dest.ndovTopic);
    console.log(`Subscribed to ${dest.ndovTopic}, sending to ${dest.type} ${dest.name}`);

    for await (const [_topic, message] of sock) {
      try {
        if (dest.type === 'queue') {
          channel.sendToQueue(dest.name, message, { persistent: dest.persistentMessages });
        } else {
          const routingKey = dest.routingKey ?? '';
          channel.publish(dest.name, routingKey, message, { persistent: dest.persistentMessages });
        }
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
