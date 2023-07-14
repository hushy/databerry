import { DatasourceStatus } from '@prisma/client';
import Redis from 'ioredis';

import { TaskQueue } from '@app/types';
import { TaskLoadDatasourceRequestSchema } from '@app/types/dtos';
import { WorkerPro } from '@app/utils/bullmq-pro';
import prisma from '@app/utils/prisma-client';
import taskLoadDatasource from '@app/utils/task-load-datasource';

const connection = new Redis({
  port: parseInt(process.env.REDIS_PORT || '6379'), // Redis port
  host: process.env.REDIS_URL, // Redis host
  username: process.env.REDIS_USERNAME, // needs Redis >= 6
  password: process.env.REDIS_PASSWORD,
  db: 0, // Defaults to 0
  tls: {}
});

const loadData = async (job:any) => {
  const data = job?.data as TaskLoadDatasourceRequestSchema;
  try {
    console.log('JOB', data);

    await taskLoadDatasource(data);

    return;
  } catch (err) {
    // TODO: handle error
    console.error(err);

    await prisma.appDatasource.update({
      where: {
        id: data?.datasourceId,
      },
      data: {
        status: DatasourceStatus.error,
      },
    });

    throw new Error(JSON.stringify(err));
  }
}

export default loadData;
