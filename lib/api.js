// @ts-check
import fastify from 'fastify'
import ws from '@fastify/websocket'

const f = fastify({logger:true})

const defaultHandler = (conn,_) => {
  conn.pipe(conn)
}
const setup = (handle) => {
  f.register(ws)
  f.register(async (fastify) => {
    fastify.route({
      method:'GET',
      url: '/',
      handler: (_,reply) => {
        reply.code(101)
          .headers({
            'Upgrade': 'websocket',
            'Connection': 'Upgrade'
          })
          .send('ok')
      },
      wsHandler: handle || defaultHandler
    })
  })
}
export const start = async (handle) => {
  setup(handle)
  try{
    await f.listen({port: 3000})
  }catch(e){
    f.log.error(e)
    process.exit(1)
  }
}
