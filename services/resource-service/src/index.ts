import Fastify from 'fastify';

// Fastify instance එක සාදමු
const app = Fastify({
  logger: true,  // production logging enable කරනවා
});

// Health check endpoint - K8s liveness/readiness probes සඳහා අත්‍යවශ්‍යයි
// K8s මෙම endpoint එකට HTTP GET request යවලා pod එක alive ද check කරනවා
app.get('/health', async () => {
  return {
    status: 'healthy',
    service: 'resource-service',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
  };
});

// Root endpoint
app.get('/', async () => {
  return {
    message: 'Resource Service is running',
    service: 'resource-service',
  };
});

// Server start කරමු
const start = async () => {
  try {
    // K8s pod එකක් ඇතුළේ run වෙන නිසා 0.0.0.0 bind කරන්න ඕනේ
    // localhost (127.0.0.1) bind කළොත් container එකෙන් පිට access කරන්න බෑ
    await app.listen({
      port: Number(process.env.PORT) || 3003,
      host: '0.0.0.0',
    });
    console.log(`🚀 Resource Service running on port ${process.env.PORT || 3003}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
