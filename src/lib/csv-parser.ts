import Papa from "papaparse";

export interface ParsedExpense {
	expenseId: string;
	name: string;
	amount: number;
	date: string; // YYYY-MM-DD
	year: number;
	month: string; // 2-digit format
}

export interface ParseResult {
	expenses: ParsedExpense[];
	status: "success" | "error";
	errorMessage?: string;
}

/**
 * Simple hash function for generating unique IDs
 */
function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return Math.abs(hash).toString(36);
}

/**
 * Generate a unique ID for an expense based on its attributes
 */
function generateExpenseId(name: string, amount: number, date: string): string {
	const data = `${name}-${amount}-${date}`;
	return simpleHash(data);
}

/**
 * Parse a date string in various formats to YYYY-MM-DD
 */
function parseDate(dateStr: string): string | null {
	const monthMap: Record<string, string> = {
		jan: "01",
		feb: "02",
		mar: "03",
		apr: "04",
		may: "05",
		jun: "06",
		jul: "07",
		aug: "08",
		sep: "09",
		oct: "10",
		nov: "11",
		dec: "12",
	};

	// DD/MM/YY or DD/MM/YYYY (Australian format - Google Sheets export)
	let match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
	if (match) {
		let [, day, month, year] = match;
		// Convert 2-digit year to 4-digit (assume 2000s)
		if (year.length === 2) {
			year = `20${year}`;
		}
		return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
	}

	// MM/DD/YYYY (US format)
	match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (match) {
		const [, month, day, year] = match;
		return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
	}

	// DD-MMM-YYYY (e.g., 15-Jan-2024)
	match = dateStr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
	if (match) {
		const [, day, monthName, year] = match;
		const month = monthMap[monthName.toLowerCase()] || "01";
		return `${year}-${month}-${day.padStart(2, "0")}`;
	}

	// YYYY-MM-DD
	match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
	if (match) {
		const [, year, month, day] = match;
		return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
	}

	// MMM DD, YYYY (e.g., Jan 15, 2024)
	match = dateStr.match(/^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})$/);
	if (match) {
		const [, monthName, day, year] = match;
		const month = monthMap[monthName.toLowerCase()] || "01";
		return `${year}-${month}-${day.padStart(2, "0")}`;
	}

	// ISO 8601 datetime (e.g., 2024-01-15T00:00:00)
	match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T/);
	if (match) {
		const [, year, month, day] = match;
		return `${year}-${month}-${day}`;
	}

	return null;
}

/**
 * Detect column indices from header row
 */
function detectColumns(
	headers: string[],
): { date: number; description: number; amount: number } | null {
	const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());

	// Look for date column
	const dateIndex = normalizedHeaders.findIndex((h) =>
		["date", "transaction date", "posted date", "date posted"].includes(h),
	);

	// Look for description column
	const descriptionIndex = normalizedHeaders.findIndex((h) =>
		[
			"description",
			"merchant",
			"name",
			"transaction",
			"details",
			"memo",
		].includes(h),
	);

	// Look for amount column
	const amountIndex = normalizedHeaders.findIndex((h) =>
		["amount", "debit", "withdrawal", "charge", "total"].includes(h),
	);

	// Require all three columns
	if (dateIndex === -1 || descriptionIndex === -1 || amountIndex === -1) {
		return null;
	}

	return {
		date: dateIndex,
		description: descriptionIndex,
		amount: amountIndex,
	};
}

/**
 * Parse CSV file and extract expenses
 */
export async function parseCSV(
	fileContent: string,
): Promise<ParseResult> {
	try {
		console.log("[CSV Parser] Starting CSV parsing...");

		// Parse CSV
		const parseResult = Papa.parse(fileContent, {
			header: false,
			skipEmptyLines: true,
			dynamicTyping: false, // Keep everything as strings for better control
		});

		if (parseResult.errors.length > 0) {
			console.error("[CSV Parser] Parse errors:", parseResult.errors);
			return {
				expenses: [],
				status: "error",
				errorMessage: `CSV parsing error: ${parseResult.errors[0]?.message || "Unknown error"}`,
			};
		}

		const rows = parseResult.data as string[][];
		if (rows.length === 0) {
			return {
				expenses: [],
				status: "error",
				errorMessage: "CSV file is empty",
			};
		}

		console.log(`[CSV Parser] Parsed ${rows.length} rows`);

		// Try to detect column structure from first row (headers)
		const columns = detectColumns(rows[0]);
		if (!columns) {
			return {
				expenses: [],
				status: "error",
				errorMessage:
					"Could not detect required columns. Please ensure your CSV has headers for: Date, Description/Name, and Amount",
			};
		}

		console.log("[CSV Parser] Detected columns:", columns);

		const expenses: ParsedExpense[] = [];

		// Process data rows (skip header row)
		for (let i = 1; i < rows.length; i++) {
			const row = rows[i];
			if (!row || row.length === 0) continue;

			const dateStr = row[columns.date]?.trim();
			const description = row[columns.description]?.trim();
			const amountStr = row[columns.amount]?.trim();

			// Skip if any required field is missing
			if (!dateStr || !description || !amountStr) {
				console.log(`[CSV Parser] Skipping row ${i + 1}: missing data`);
				continue;
			}

			// Parse date
			const parsedDate = parseDate(dateStr);
			if (!parsedDate) {
				console.log(
					`[CSV Parser] Skipping row ${i + 1}: invalid date "${dateStr}"`,
				);
				continue;
			}

			// Parse amount (remove currency symbols, commas, and whitespace)
			const cleanAmount = amountStr.replace(/[$,\s]/g, "");
			let amount = Number.parseFloat(cleanAmount);

			// Skip if amount is invalid
			if (Number.isNaN(amount) || amount === 0) {
				console.log(
					`[CSV Parser] Skipping row ${i + 1}: invalid amount "${amountStr}"`,
				);
				continue;
			}

			// Convert negative amounts to positive (expenses should be positive)
			amount = Math.abs(amount);

			const [year, month] = parsedDate.split("-");
			const expenseId = generateExpenseId(description, amount, parsedDate);

			expenses.push({
				expenseId,
				name: description,
				amount,
				date: parsedDate,
				year: Number.parseInt(year, 10),
				month,
			});
		}

		console.log(`[CSV Parser] Found ${expenses.length} expenses`);

		if (expenses.length === 0) {
			return {
				expenses: [],
				status: "error",
				errorMessage:
					"No valid expenses found in CSV. Please ensure your CSV has columns for Date, Description/Name, and Amount with valid data.",
			};
		}

		return {
			expenses,
			status: "success",
		};
	} catch (error) {
		console.error("[CSV Parser] Error:", error);
		return {
			expenses: [],
			status: "error",
			errorMessage:
				error instanceof Error ? error.message : "Failed to parse CSV",
		};
	}
}
