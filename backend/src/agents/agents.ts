import { Agent, AgentContext, getAgentByName } from 'agents';
import { generateText, experimental_transcribe as transcribe } from 'ai';
import { createOpenAI, openai } from '@ai-sdk/openai';
import { google } from 'googleapis';
import { sheetsTools } from '../tools/sheets';

export class AudioTranscriptionAgent extends Agent<CloudflareBindings> {
	openai = createOpenAI({
		apiKey: this.env.OPENAI_API_KEY,
		baseURL: `https://gateway.ai.cloudflare.com/v1/tushar-personal/${this.env.CF_AI_GATEWAY_ID}/workers-ai/openai`,
		headers: {
			'cf-aig-authorization': `Bearer ${this.env.CF_TOKEN}`,
		},
	});
	async onRequest(request: Request): Promise<Response> {
		const formData = await request.formData();
		const audioFile = formData.get('audio') as File;
		const blob = await audioFile.arrayBuffer();

		console.log('Making call to transcribe text');
		const transcription = await transcribe({
			model: openai.transcription('whisper-1'),
			audio: blob,
		});
		// @ts-expect-error Take text from transcription
		const text = transcription.responses?.[0]?.body?.text || '';
		console.log('Text transcribed successfully with text:', text);

		console.log('Running sheets agent.');
		const agent = await getAgentByName(this.env['google-sheets-agent'], 'default');

		agent
			.processSheetRequest({ text })
			.then(() => {
				console.log('Sheets agent ran successfully.');
			})
			.catch((e) => {
				console.error('error calling the sheets agent', e);
			});

		return Response.json({ success: true });
	}
}

export class GoogleSheetsAgent extends Agent<CloudflareBindings> {
	openai = createOpenAI({
		apiKey: this.env.OPENAI_API_KEY,
		baseURL: `https://gateway.ai.cloudflare.com/v1/tushar-personal/${this.env.CF_AI_GATEWAY_ID}/workers-ai/openai`,
		headers: {
			'cf-aig-authorization': `Bearer ${this.env.CF_TOKEN}`,
		},
	});

	constructor(ctx: AgentContext, env: CloudflareBindings) {
		super(ctx, env);

		// Validate required Google credentials
		const requiredVars = ['GOOGLE_PROJECT_ID', 'GOOGLE_PRIVATE_KEY_ID', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_CLIENT_EMAIL', 'GOOGLE_CLIENT_ID'];

		// @ts-expect-error all good
		const missingVars = requiredVars.filter((varName) => !this.env[varName]);
		if (missingVars.length > 0) {
			console.error('Missing required Google credentials:', missingVars);
			console.error(
				'Available env vars:',
				Object.keys(this.env).filter((key) => key.startsWith('GOOGLE_')),
			);
		}

		// Log credential status for debugging
		console.log('Google Auth Debug:', {
			hasProjectId: !!this.env.GOOGLE_PROJECT_ID,
			hasPrivateKeyId: !!this.env.GOOGLE_PRIVATE_KEY_ID,
			hasPrivateKey: !!this.env.GOOGLE_PRIVATE_KEY,
			hasClientEmail: !!this.env.GOOGLE_CLIENT_EMAIL,
			hasClientId: !!this.env.GOOGLE_CLIENT_ID,
			clientEmailValue: this.env.GOOGLE_CLIENT_EMAIL ? `${this.env.GOOGLE_CLIENT_EMAIL.substring(0, 5)}...` : 'undefined',
		});
	}

	auth = new google.auth.GoogleAuth({
		credentials: {
			type: 'service_account',
			project_id: this.env.GOOGLE_PROJECT_ID,
			private_key_id: this.env.GOOGLE_PRIVATE_KEY_ID,
			private_key: this.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
			client_email: this.env.GOOGLE_CLIENT_EMAIL,
			client_id: this.env.GOOGLE_CLIENT_ID,
		},
		scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
	});
	sheets = google.sheets({ version: 'v4', auth: this.auth });
	drive = google.drive({ version: 'v3', auth: this.auth });
	async processSheetRequest({ text }: { text: string }) {
		console.log('Processing sheet request with text:', text);

		// Check if authentication is properly configured
		if (!this.env.GOOGLE_CLIENT_EMAIL) {
			throw new Error('Google authentication not properly configured: GOOGLE_CLIENT_EMAIL is missing');
		}

		// Validate that all required credentials are present
		const credentials = {
			type: 'service_account',
			project_id: this.env.GOOGLE_PROJECT_ID,
			private_key_id: this.env.GOOGLE_PRIVATE_KEY_ID,
			private_key: this.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
			client_email: this.env.GOOGLE_CLIENT_EMAIL,
			client_id: this.env.GOOGLE_CLIENT_ID,
		};

		// Check for any missing required fields
		const missingFields = Object.entries(credentials)
			.filter(([key, value]) => key !== 'type' && !value)
			.map(([key]) => key);

		if (missingFields.length > 0) {
			throw new Error(`Google authentication missing required fields: ${missingFields.join(', ')}`);
		}
		const respText = await generateText({
			model: openai.chat('gpt-4.1'),
			messages: [
				{
					role: 'system',
					content: `You are a Google Sheets assistant that helps users manage their spreadsheets.

IMPORTANT: Carefully analyze the user's request to determine the correct action:

- If they want to CREATE a new spreadsheet, use createSpreadsheet
- If they want to GET/READ/VIEW data, use getValues
- If they want to LIST their spreadsheets, use listSpreadsheets
- If they want to ADD a new sheet/tab, use addSheet
- If they want to UPDATE/WRITE/CHANGE values, use updateValues
- If they want to FORMAT/HIGHLIGHT/COLOR cells, use formatCells
- If they want to DELETE a sheet/tab, use deleteSheet
- If they want to GET INFO about a spreadsheet, use getSpreadsheet

Chart Operations:
- If they want to CREATE a COLUMN/BAR CHART, use createColumnChart
- If they want to CREATE a PIE CHART, use createPieChart
- If they want to CREATE a LINE CHART, use createLineChart
- If they want to DELETE/REMOVE a chart, use deleteChart
- If they want to MOVE/RESIZE a chart, use moveChart
- If they want to LIST/VIEW existing charts, use getCharts

Examples:
- "Create a new budget spreadsheet" → createSpreadsheet
- "Show me the data in A1 to B5" → getValues
- "Add a new sheet called Expenses" → addSheet
- "Update cell A1 with the value 100" → updateValues
- "Highlight row 1 in yellow" → formatCells
- "List all my spreadsheets" → listSpreadsheets
- "Add a new sheet called B to the spreadsheet A" → first list spreadsheets, find the spreadsheet ID, then addSheet
- "Create a column chart of sales data" → createColumnChart
- "Make a pie chart showing expenses" → createPieChart
- "Create a line chart of monthly trends" → createLineChart
- "Delete chart with ID 123" → deleteChart
- "Move the chart to cell D5" → moveChart
- "Show me all charts in the spreadsheet" → getCharts

Always choose the most appropriate tool based on the user's intent.`,
				},
				{
					role: 'user',
					content: text,
				},
			],
			tools: sheetsTools(this.sheets, this.drive),
			maxSteps: 5,
		});
		console.log('Sheet request processed successfully.', respText);

		return respText.text;
	}

	// Keep the old method for backward compatibility but redirect to the new one
	async updateSheet({ text }: { text: string }) {
		return this.processSheetRequest({ text });
	}
}
