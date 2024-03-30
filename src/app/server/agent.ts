import { StreamingTextResponse } from "ai";
import { HttpResponseOutputParser } from "langchain/output_parsers";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { ChatOpenAI } from "@langchain/openai";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { GoogleCustomSearch } from "@langchain/community/tools/google_custom_search";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { BaseChatMessageHistory } from "langchain/schema";

const convertMessageToLangChainMessage = (message: any) => {
  if (message.role === "user") {
    return new HumanMessage(message.content);
  } else if (message.role === "assistant") {
    return new AIMessage(message.content);
  } 
};

export async function Chat(body: any) {
    const messages = (body.messages ?? []).filter(
      (message: any) =>
        message.role === "user" || message.role === "assistant",
    ).map(convertMessageToLangChainMessage);
    console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY);
console.log('LLM_BASE_URL:', process.env.LLM_BASE_URL);
    const model = new ChatOpenAI({
        temperature: 0.7,
        modelName: process.env.LLM_MODEL || 'gpt-3.5-turbo',
        openAIApiKey: process.env.OPENAI_API_KEY,
        configuration: { baseURL: process.env.LLM_BASE_URL || 'https://api.openai.com/v1' },
        maxTokens: 500,
        streaming: true,
        verbose: true
      });
    if(!body.messages.slice(-1)[0].function_call){
      const outputParser = new HttpResponseOutputParser()
      const stream = await model.pipe(outputParser).stream(messages);
      return new StreamingTextResponse(stream);
    }
    console.log(body)
    const previousMessages = messages
      .slice(0, -1)
    const currentMessageContent = messages[messages.length - 1].content;
    console.log(previousMessages,currentMessageContent)

    var tools: any[] = [];
    if (process.env.TAVILY_API_KEY) {
      tools.push(new TavilySearchResults({maxResults: 5}));
    }
    if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID) {
      tools.push(new GoogleCustomSearch());
    }

    const AGENT_SYSTEM_PROMPT = "You are a helpful assistant can play any role and reply as the role user calls by '@' symbol . Here's one of the roles:"
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", AGENT_SYSTEM_PROMPT],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
      new MessagesPlaceholder("agent_scratchpad"),
    ]);

    const agent = await createOpenAIFunctionsAgent({
      llm:model,
      tools,
      prompt,
    });
    
    const agentExecutor = new AgentExecutor({
      agent,
      tools,
    });

    const chatHistory = previousMessages.length > 0 ? previousMessages : [];


      const logStream = await agentExecutor.streamLog({
        input: currentMessageContent,
        chat_history: chatHistory,
      });

      const encoder = new TextEncoder()
      const searchResults: string[] = [];

  
      const transformStream = new ReadableStream({
        async start(controller) {
          for await (const chunk of logStream) {
            if (chunk.ops?.length > 0 && chunk.ops[0].op === "add") {
              const addOp = chunk.ops[0];
              if (addOp.path.startsWith("/logs/ChatOpenAI") && addOp.path.includes("stream") &&
                typeof addOp.value === "string" &&
                addOp.value.length
              ) {
                // 直接发送ChatOpenAI的日志
                controller.enqueue(encoder.encode(addOp.value + '\n\n'));
              }
              if (addOp.path.startsWith('/logs/GoogleCustomSearch/final_output') || addOp.path.startsWith('/logs/TavilySearchResults/final_output')) {
                // 处理搜索结果,提取标题、链接和摘要
                const rawResult = addOp.value.output;
                const lines = rawResult.split('\n\n');
                const parsedResult = lines.map((line: string) => {
                  const parts = line.split(']');
                  if (parts.length >= 2) {
                    const content = parts[1].trim();
                    const titleMatch = content.match(/Title: (.*)/);
                    const linkMatch = content.match(/Link: (.*)/);
                    const abstractMatch = content.match(/Abstract: (.*)/);
                    return {
                      title: titleMatch ? titleMatch[1] : '',
                      link: linkMatch ? linkMatch[1] : '',
                      abstract: abstractMatch ? abstractMatch[1] : '',
                    };
                  }
                  return null;
                }).filter((result: any) => result !== null);
                searchResults.push(...parsedResult);
              }
            }
          }
          
          // 将搜索结果转换为JSON并发送
          if (searchResults.length > 0) {
            const finalResponse = JSON.stringify(searchResults);
            controller.enqueue(encoder.encode(`---\n${finalResponse}\n---\n`));
          }
          controller.close();
        },
      });

      console.log('Search Results:', searchResults);
      console.log('Transform Stream:', transformStream);
      
      return new StreamingTextResponse(transformStream);
    }