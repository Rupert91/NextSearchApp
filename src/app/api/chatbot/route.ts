import { Chat } from '~/app/server/agent'
export const runtime = 'edge';

export async function POST(req: Request) {
  const json = await req.json()
  return Chat(json)
}