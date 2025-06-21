import { z } from 'zod';
import { tool, ToolSet } from 'ai';
import { sheets_v4 } from 'googleapis';

// Export all tools as a collection
export const sheetsTools = (sheets: sheets_v4.Sheets) => {
	const createSpreadsheet = tool({
		description: 'Create a new Google spreadsheet - use this ONLY when the user wants to create a brand new spreadsheet from scratch',
		parameters: z.object({
			title: z.string().min(1).describe('Title of the spreadsheet'),
			sheets: z
				.array(
					z.object({
						title: z.string().min(1).describe('Title of the sheet'),
						rows: z.number().int().positive().optional().default(1000),
						columns: z.number().int().positive().optional().default(26),
					}),
				)
				.optional()
				.describe('Initial sheets to create'),
		}),
		execute: async ({ title, sheets }) => {
			// TODO: Implement Google Sheets API call to create spreadsheet
			console.log('TOOL CALLED: createSpreadsheet');
			console.log('Creating spreadsheet:', { title, sheets });
			return {
				spreadsheetId: 'mock-id',
				spreadsheetUrl: `https://docs.google.com/spreadsheets/d/mock-id`,
				sheets: sheets || [{ title: 'Sheet1', rows: 1000, columns: 26 }],
			};
		},
	});

	const getValues = tool({
		description:
			'Get/read/view values from a Google spreadsheet - use this ONLY when the user wants to see, read, or retrieve existing data',
		parameters: z.object({
			spreadsheetId: z.string().describe('ID of the spreadsheet to retrieve values from'),
			range: z.string().describe('A1 notation range, e.g. "Sheet1!A1:D5"'),
			valueRenderOption: z
				.enum(['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'])
				.optional()
				.default('FORMATTED_VALUE')
				.describe('How to render the values'),
		}),
		execute: async ({ spreadsheetId, range, valueRenderOption }) => {
			// TODO: Implement Google Sheets API call to get values
			console.log('TOOL CALLED: getValues');
			console.log('Getting values:', { spreadsheetId, range, valueRenderOption });
			return {
				range,
				majorDimension: 'ROWS',
				values: [['Mock', 'Data']],
			};
		},
	});

	const addSheet = tool({
		description:
			'Add a new sheet/tab to an existing spreadsheet - use this ONLY when the user wants to add a new worksheet/tab to an existing spreadsheet',
		parameters: z.object({
			spreadsheetId: z.string().describe('ID of the spreadsheet to update'),
			title: z.string().min(1).describe('Title of the new sheet'),
			rows: z.number().int().positive().optional().default(1000).describe('Number of rows'),
			columns: z.number().int().positive().optional().default(26).describe('Number of columns'),
		}),
		execute: async ({ spreadsheetId, title, rows, columns }) => {
			// TODO: Implement Google Sheets API call to add sheet
			console.log('TOOL CALLED: addSheet');
			console.log('Adding sheet:', { spreadsheetId, title, rows, columns });
			return {
				sheetId: 123456,
				title,
				index: 1,
				sheetType: 'GRID',
				gridProperties: { rowCount: rows, columnCount: columns },
			};
		},
	});

	const listSpreadsheets = tool({
		description: 'List/show all Google spreadsheets - use this ONLY when the user wants to see a list of their spreadsheets',
		parameters: z.object({
			maxResults: z.number().int().positive().optional().default(10).describe('Maximum number of spreadsheets to return'),
			query: z.string().optional().describe('Search query to filter spreadsheets'),
			nextPageToken: z.string().optional().describe('Token for pagination'),
		}),
		execute: async ({ maxResults, query, nextPageToken }) => {
			// TODO: Implement Google Drive API call to list spreadsheets
			console.log('TOOL CALLED: listSpreadsheets');
			console.log('Listing spreadsheets:', { maxResults, query, nextPageToken });
			return {
				files: [],
				nextPageToken: null,
			};
		},
	});

	const getSpreadsheet = tool({
		description:
			'Get metadata/information about a Google spreadsheet - use this ONLY when the user wants spreadsheet properties, not cell values',
		parameters: z.object({
			spreadsheetId: z.string().describe('ID of the spreadsheet to retrieve'),
		}),
		execute: async ({ spreadsheetId }) => {
			// TODO: Implement Google Sheets API call to get spreadsheet metadata
			console.log('TOOL CALLED: getSpreadsheet');
			console.log('Getting spreadsheet metadata:', { spreadsheetId });
			return {
				spreadsheetId,
				properties: {
					title: 'Mock Spreadsheet',
					locale: 'en_US',
					timeZone: 'America/New_York',
				},
				sheets: [],
				spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
			};
		},
	});

	const deleteSpreadsheet = tool({
		description: 'Delete an entire Google spreadsheet - use this ONLY when the user wants to permanently delete a whole spreadsheet',
		parameters: z.object({
			spreadsheetId: z.string().describe('ID of the spreadsheet to delete'),
		}),
		execute: async ({ spreadsheetId }) => {
			// TODO: Implement Google Drive API call to delete spreadsheet
			console.log('TOOL CALLED: deleteSpreadsheet');
			console.log('Deleting spreadsheet:', { spreadsheetId });
			return {
				success: true,
				spreadsheetId,
			};
		},
	});

	const updateValues = tool({
		description:
			'Update/write/change values in a Google spreadsheet - use this ONLY when the user wants to write, modify, or change cell values',
		parameters: z.object({
			spreadsheetId: z.string().describe('ID of the spreadsheet to update'),
			range: z.string().describe('A1 notation range, e.g. "Sheet1!A1:D5"'),
			values: z.array(z.array(z.any())).describe('Array of arrays with values to update'),
			valueInputOption: z.enum(['RAW', 'USER_ENTERED']).optional().default('USER_ENTERED').describe('How to interpret the values'),
		}),
		execute: async ({ spreadsheetId, range, values, valueInputOption }) => {
			// TODO: Implement Google Sheets API call to update values
			console.log('TOOL CALLED: updateValues');
			console.log('Updating values:', { spreadsheetId, range, values, valueInputOption });
			return {
				spreadsheetId,
				updatedRange: range,
				updatedRows: values.length,
				updatedColumns: values[0]?.length || 0,
				updatedCells: values.length * (values[0]?.length || 0),
			};
		},
	});

	const deleteSheet = tool({
		description:
			'Delete a sheet/tab from a spreadsheet - use this ONLY when the user wants to remove a specific worksheet/tab, not the entire spreadsheet',
		parameters: z.object({
			spreadsheetId: z.string().describe('ID of the spreadsheet'),
			sheetId: z.number().int().describe('The ID of the sheet to delete (not the name)'),
		}),
		execute: async ({ spreadsheetId, sheetId }) => {
			// TODO: Implement Google Sheets API call to delete sheet
			console.log('TOOL CALLED: deleteSheet');
			console.log('Deleting sheet:', { spreadsheetId, sheetId });
			return {
				success: true,
				spreadsheetId,
				deletedSheetId: sheetId,
			};
		},
	});

	const shareSpreadsheet = tool({
		description: 'Share a Google spreadsheet with others - use this ONLY when the user wants to grant access or permissions to other users',
		parameters: z
			.object({
				spreadsheetId: z.string().describe('ID of the spreadsheet to share'),
				emailAddress: z.string().email().optional().describe('Email address of the user to share with'),
				domain: z.string().optional().describe('Domain to share with (instead of specific email)'),
				role: z.enum(['owner', 'organizer', 'fileOrganizer', 'writer', 'commenter', 'reader']).describe('Role to grant to the user'),
				sendNotification: z.boolean().optional().default(true).describe('Whether to send a notification email'),
			})
			.refine((data) => data.emailAddress || data.domain, {
				message: 'Either emailAddress or domain must be provided',
			}),
		execute: async ({ spreadsheetId, emailAddress, domain, role, sendNotification }) => {
			// TODO: Implement Google Drive API call to share spreadsheet
			console.log('TOOL CALLED: shareSpreadsheet');
			console.log('Sharing spreadsheet:', { spreadsheetId, emailAddress, domain, role, sendNotification });
			return {
				id: 'permission-id',
				type: emailAddress ? 'user' : 'domain',
				emailAddress: emailAddress || undefined,
				domain: domain || undefined,
				role,
			};
		},
	});

	const colorSchema = z.union([
		z.string().regex(/^#[0-9A-Fa-f]{6}$/), // Hex color
		z.enum(['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown', 'grey', 'black', 'white']), // Named colors
		z.object({
			red: z.number().min(0).max(1),
			green: z.number().min(0).max(1),
			blue: z.number().min(0).max(1),
			alpha: z.number().min(0).max(1).optional().default(1),
		}), // RGB object
	]);

	const formatCells = tool({
		description:
			'Format/highlight/color cells in a Google spreadsheet - use this ONLY when the user wants to change cell appearance, colors, fonts, borders, or alignment',
		parameters: z.object({
			spreadsheetId: z.string().describe('ID of the spreadsheet to format'),
			range: z.string().describe('A1 notation range to format, e.g. "Sheet1!A1:B2"'),
			backgroundColor: colorSchema.optional().describe('Background color'),
			textColor: colorSchema.optional().describe('Text color'),
			bold: z.boolean().optional().describe('Whether text should be bold'),
			italic: z.boolean().optional().describe('Whether text should be italic'),
			underline: z.boolean().optional().describe('Whether text should be underlined'),
			strikethrough: z.boolean().optional().describe('Whether text should have strikethrough'),
			fontSize: z.number().int().positive().optional().describe('Font size in points'),
			fontFamily: z.string().optional().describe('Font family name (e.g., Arial, Times New Roman)'),
			horizontalAlignment: z.enum(['LEFT', 'CENTER', 'RIGHT']).optional().describe('Horizontal alignment'),
			verticalAlignment: z.enum(['TOP', 'MIDDLE', 'BOTTOM']).optional().describe('Vertical alignment'),
			wrapStrategy: z.enum(['OVERFLOW_CELL', 'LEGACY_WRAP', 'CLIP', 'WRAP']).optional().describe('Text wrapping strategy'),
			numberFormat: z
				.object({
					type: z.enum(['NUMBER', 'PERCENT', 'CURRENCY', 'DATE', 'TIME', 'DATE_TIME', 'SCIENTIFIC']),
					pattern: z.string().optional(),
				})
				.optional()
				.describe('Number format settings'),
			borders: z
				.object({
					top: z
						.object({
							style: z.enum(['NONE', 'SOLID', 'DASHED', 'DOTTED', 'DOUBLE']),
							width: z.number().int().positive().optional(),
							color: colorSchema.optional(),
						})
						.optional(),
					bottom: z
						.object({
							style: z.enum(['NONE', 'SOLID', 'DASHED', 'DOTTED', 'DOUBLE']),
							width: z.number().int().positive().optional(),
							color: colorSchema.optional(),
						})
						.optional(),
					left: z
						.object({
							style: z.enum(['NONE', 'SOLID', 'DASHED', 'DOTTED', 'DOUBLE']),
							width: z.number().int().positive().optional(),
							color: colorSchema.optional(),
						})
						.optional(),
					right: z
						.object({
							style: z.enum(['NONE', 'SOLID', 'DASHED', 'DOTTED', 'DOUBLE']),
							width: z.number().int().positive().optional(),
							color: colorSchema.optional(),
						})
						.optional(),
				})
				.optional()
				.describe('Border settings'),
		}),
		execute: async (params) => {
			// TODO: Implement Google Sheets API call to format cells
			console.log('TOOL CALLED: formatCells');
			console.log('Formatting cells:', params);
			return {
				spreadsheetId: params.spreadsheetId,
				formattedRange: params.range,
				appliedFormats: Object.keys(params).filter(
					(key) => !['spreadsheetId', 'range'].includes(key) && params[key as keyof typeof params] !== undefined,
				),
			};
		},
	});

	// Helper function to convert color formats to Google Sheets RGB format
	function convertColorToRGB(color: string | { red: number; green: number; blue: number; alpha?: number }) {
		if (typeof color === 'object') {
			return color;
		}

		// Handle hex colors
		if (color.startsWith('#')) {
			const hex = color.substring(1);
			return {
				red: parseInt(hex.substring(0, 2), 16) / 255,
				green: parseInt(hex.substring(2, 4), 16) / 255,
				blue: parseInt(hex.substring(4, 6), 16) / 255,
				alpha: 1,
			};
		}

		// Handle named colors
		const namedColors: Record<string, { red: number; green: number; blue: number }> = {
			red: { red: 1, green: 0, blue: 0 },
			blue: { red: 0, green: 0, blue: 1 },
			green: { red: 0, green: 1, blue: 0 },
			yellow: { red: 1, green: 1, blue: 0 },
			orange: { red: 1, green: 0.65, blue: 0 },
			purple: { red: 0.5, green: 0, blue: 0.5 },
			pink: { red: 1, green: 0.75, blue: 0.8 },
			brown: { red: 0.65, green: 0.16, blue: 0.16 },
			grey: { red: 0.5, green: 0.5, blue: 0.5 },
			black: { red: 0, green: 0, blue: 0 },
			white: { red: 1, green: 1, blue: 1 },
		};

		return { ...(namedColors[color.toLowerCase()] || namedColors.black), alpha: 1 };
	}
	return {
		getValues,
		addSheet,
		listSpreadsheets,
		getSpreadsheet,
		updateValues,
		formatCells,
		deleteSheet,
	};
};
