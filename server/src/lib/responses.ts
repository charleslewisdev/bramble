import { FastifyReply } from "fastify";

export function sendError(reply: FastifyReply, status: number, message: string) {
  return reply.status(status).send({ error: message });
}

export function sendSuccess<T>(reply: FastifyReply, data: T, status = 200) {
  return reply.status(status).send(data);
}
