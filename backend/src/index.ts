import { Hono } from 'hono';
import { agentsMiddleware } from 'hono-agents';
import { AudioTranscriptionAgent, GoogleSheetsAgent, ScreenshotAnalysisAgent } from './agents/agents';

export { AudioTranscriptionAgent, GoogleSheetsAgent, ScreenshotAnalysisAgent };

// Basic setup
const app = new Hono();
app.use('*', agentsMiddleware());

// or with authentication
app.use(
	'*',
	agentsMiddleware({
		options: {
			onBeforeConnect: async (req) => {
				const token = req.headers.get('authorization');
				// validate token
				if (!token) return new Response('Unauthorized', { status: 401 });
			},
		},
	}),
);

// With error handling
app.use('*', agentsMiddleware({ onError: (error) => console.error(error) }));

// With custom routing
app.use(
	'*',
	agentsMiddleware({
		options: {
			prefix: 'agents', // Handles /agents/* routes only
		},
	}),
);

export default app;
