// import { Queue } from 'bullmq';
import Redis from 'ioredis';

import { TaskQueue } from '@app/types';
import { TaskLoadDatasourceRequestSchema } from '@app/types/dtos';
import { QueuePro } from '@app/utils/bullmq-pro';
import loadData from "@app/workers/datasource-loader";

const connection = new Redis({
  port: parseInt(process.env.REDIS_PORT || '6379'), // Redis port
  host: process.env.REDIS_URL, // Redis host
  username: process.env.REDIS_USERNAME, // needs Redis >= 6
  password: process.env.REDIS_PASSWORD,
  db: 0, // Defaults to 0
  tls: {}
});

const datasourceLoadQueue = new QueuePro(TaskQueue.load_datasource, {
  connection: connection as any,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

const triggerTaskLoadDatasource = async (
  data: {
    userId: string;
    datasourceId: string;
    isUpdateText?: boolean;
    priority?: number;
  }[]
) => {

    data.map((each) =>
        (loadData(
            {
      name: TaskQueue.load_datasource,
      data: each as TaskLoadDatasourceRequestSchema,
      opts: {
        group: {
          id: each.userId,
        },
        ...(each.priority ? { priority: each.priority } : {}),
      },
    })))
};

export default triggerTaskLoadDatasource;
