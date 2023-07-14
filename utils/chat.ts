import { Datastore, MessageFrom, PromptType } from '@prisma/client';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { OpenAI } from 'langchain/llms/openai';
import { AIChatMessage, HumanChatMessage } from 'langchain/schema';

import { ChatResponse } from '@app/types';

import { DatastoreManager } from './datastores';
import { CUSTOMER_SUPPORT } from './prompt-templates';

const getCustomerSupportPrompt = ({
  prompt,
  query,
  context,
}: {
  prompt?: string;
  query: string;
  context: string;
}) => {
  return `${prompt || CUSTOMER_SUPPORT}
START_CONTEXT:
${context}
END_CONTEXT

START_USER_DATA:
${query}
END_USER_DATA

Answer :`;
};

const chat = async ({
  datastore,
  query,
  topK,
  prompt,
  promptType,
  stream,
  temperature,
  history,
}: {
  datastore: Datastore;
  query: string;
  prompt?: string;
  promptType?: PromptType;
  topK?: number;
  stream?: any;
  temperature?: number;
  history?: { from: MessageFrom; message: string }[];
}) => {
  let results = [] as {
    text: string;
    source: string;
    score: number;
  }[];

  if (datastore) {
    const store = new DatastoreManager(datastore);
    results = await store.search({
      query: query,
      topK: topK || 3,
      tags: [],
    });
  }

  const context = results
    ?.map((each) => `CHUNK: ${each.text}\nSOURCE: ${each.source}`)
    ?.join('\n\n');

  // const finalPrompt = `As a customer support agent, channel the spirit of William Shakespeare, the renowned playwright and poet known for his eloquent and poetic language, use of iambic pentameter, and frequent use of metaphors and wordplay. Respond to the user's question or issue in the style of the Bard himself.
  // const finalPrompt = `As a customer support agent, channel the spirit of Arnold Schwarzenegger, the iconic actor and former governor known for his distinctive Austrian accent, catchphrases, and action-hero persona. Respond to the user's question or issue in the style of Arnold himself.
  // As a customer support agent, please provide a helpful and professional response to the user's question or issue.

  // const instruct = `You are an AI assistant providing helpful advice, given the following extracted parts of a long document and a question.
  // If you don't know the answer, just say that you don't know. Don't try to make up an answer.`;

  let finalPrompt = prompt || '';

  switch (promptType) {
    case PromptType.customer_support:
      finalPrompt = getCustomerSupportPrompt({
        prompt: finalPrompt,
        query,
        context,
      });
      break;
    case PromptType.raw:
      finalPrompt = finalPrompt
        ?.replace('{query}', query)
        ?.replace('{context}', context);
      break;
    default:
      break;
  }
  const model = new ChatOpenAI({
    modelName: 'gpt-4',
    temperature: temperature || 0,
    streaming: Boolean(stream),
    callbacks: [
      {
        handleLLMNewToken: stream,
      },
    ],
  });

  // Disable conversation history for now as it conflict with wrapped prompt
   const messages = (history || [])?.map((each) => {
     if (each.from === MessageFrom.human) {
       return new HumanChatMessage(each.message);
     }
     return new AIChatMessage(each.message);
   });
  console.log(finalPrompt);
  console.log("history:"+messages)
  const output = await model.call([
     ...messages,
    // new HumanChatMessage(query),
    new HumanChatMessage(finalPrompt),
  ]);

  // const regex = /SOURCE:\s*(.+)/;
  // const match = output?.trim()?.match(regex);
  // const source = match?.[1]?.replace('N/A', '')?.replace('None', '')?.trim();

  // let answer = output?.trim()?.replace(regex, '')?.trim();
  // answer = source ? `${answer}\n\n${source}` : answer;

  return {
    answer: output?.text?.trim?.(),
  } as ChatResponse;
};

export default chat;
