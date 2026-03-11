export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/test') {
      return new Response('Worker is alive!', {
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response('Hello from Worker', {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
};
