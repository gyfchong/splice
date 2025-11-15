import Papa from "papaparse";

export interface ParsedExpense {
	expenseId: string;
	name: string;
	amount: number;
	date: string; // YYYY-MM-DD
	year: number;
	month: string; // 2-digit format
	checked: boolean;
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

	// DD Mon YY (e.g., 29 Aug 25)
	match = dateStr.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2})$/);
	if (match) {
		let [, day, monthName, year] = match;
		const month = monthMap[monthName.toLowerCase()] || "01";
		// Convert 2-digit year to 4-digit (assume 2000s)
		year = `20${year}`;
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
 * Extract year and month from filename
 * e.g., "Dorinda Expenses 2023 - January.csv" → { year: 2023, month: "01" }
 */
function extractDateFromFilename(filename: string): {
	year: number;
	month: string;
} | null {
	const monthMap: Record<string, string> = {
		january: "01",
		february: "02",
		march: "03",
		april: "04",
		may: "05",
		june: "06",
		july: "07",
		august: "08",
		september: "09",
		october: "10",
		november: "11",
		december: "12",
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

	// Look for year (4 digits)
	const yearMatch = filename.match(/\b(20\d{2})\b/);
	if (!yearMatch) return null;

	const year = Number.parseInt(yearMatch[1], 10);

	// Look for month name
	const lowerFilename = filename.toLowerCase();
	for (const [monthName, monthNum] of Object.entries(monthMap)) {
		if (lowerFilename.includes(monthName)) {
			return { year, month: monthNum };
		}
	}

	return null;
}

/**
 * Detect column indices from header row
 */
function detectColumns(headers: string[]): {
	date: number;
	description: number;
	descriptionFallback: number;
	amount: number;
	hasDateColumn: boolean;
} | null {
	const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());

	// Look for date column (optional now)
	const dateIndex = normalizedHeaders.findIndex((h) =>
		["date", "transaction date", "posted date", "date posted"].includes(h),
	);

	// Look for primary description column (prefer merchant name)
	const descriptionIndex = normalizedHeaders.findIndex((h) =>
		["merchant name"].includes(h),
	);

	// Look for fallback description column (transaction details, description, etc.)
	const descriptionFallbackIndex = normalizedHeaders.findIndex((h) =>
		[
			"transaction details",
			"description",
			"merchant",
			"name",
			"transaction",
			"details",
			"memo",
			"item",
		].includes(h),
	);

	// Look for amount column (including "cost")
	const amountIndex = normalizedHeaders.findIndex((h) =>
		["amount", "debit", "withdrawal", "charge", "total", "cost"].includes(h),
	);

	// Require at least one description column and amount column (date is optional)
	if (
		(descriptionIndex === -1 && descriptionFallbackIndex === -1) ||
		amountIndex === -1
	) {
		return null;
	}

	return {
		date: dateIndex,
		description:
			descriptionIndex !== -1 ? descriptionIndex : descriptionFallbackIndex,
		descriptionFallback: descriptionFallbackIndex,
		amount: amountIndex,
		hasDateColumn: dateIndex !== -1,
	};
}

/**
 * Check if a row should be skipped (summary rows, empty rows, etc.)
 */
function shouldSkipRow(row: string[]): boolean {
	if (!row || row.length === 0) return true;

	const firstCell = row[0]?.toLowerCase().trim() || "";
	const secondCell = row[1]?.toLowerCase().trim() || "";

	// Skip summary rows
	const skipKeywords = [
		"total",
		"subtotal",
		"half share",
		"grand total",
		"sum",
		"balance",
	];

	if (skipKeywords.some((keyword) => firstCell.includes(keyword))) {
		return true;
	}

	if (skipKeywords.some((keyword) => secondCell.includes(keyword))) {
		return true;
	}

	// Skip if all cells are empty
	if (row.every((cell) => !cell || cell.trim() === "")) {
		return true;
	}

	return false;
}

/**
 * Find the header row in the CSV (may not be the first row)
 */
function findHeaderRow(rows: string[][]): number {
	for (let i = 0; i < Math.min(rows.length, 5); i++) {
		const row = rows[i];
		const normalizedRow = row.map((h) => h.toLowerCase().trim());

		// Check if this row looks like a header
		if (
			normalizedRow.some((h) =>
				[
					"item",
					"description",
					"name",
					"merchant",
					"merchant name",
					"transaction details",
					"date",
				].includes(h),
			) &&
			normalizedRow.some((h) =>
				["cost", "amount", "total", "charge"].includes(h),
			)
		) {
			return i;
		}
	}
	return 0; // Default to first row
}

/**
 * Parse CSV file and extract expenses
 */
export async function parseCSV(
	fileContent: string,
	filename?: string,
): Promise<ParseResult> {
	try {
		console.log("[CSV Parser] Starting CSV parsing...");
		console.log("[CSV Parser] Filename:", filename);

		// Parse CSV
		const parseResult = Papa.parse(fileContent, {
			header: false,
			skipEmptyLines: false, // Don't skip, we'll handle it manually
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

		// Find the header row
		const headerRowIndex = findHeaderRow(rows);
		console.log("[CSV Parser] Header row index:", headerRowIndex);

		// Try to detect column structure from header row
		const columns = detectColumns(rows[headerRowIndex]);
		if (!columns) {
			return {
				expenses: [],
				status: "error",
				errorMessage:
					"Could not detect required columns. Please ensure your CSV has headers for Item/Description and Cost/Amount",
			};
		}

		console.log("[CSV Parser] Detected columns:", columns);

		// Try to extract date from filename if no date column
		let filenameDateInfo: { year: number; month: string } | null = null;
		if (!columns.hasDateColumn && filename) {
			filenameDateInfo = extractDateFromFilename(filename);
			console.log("[CSV Parser] Extracted from filename:", filenameDateInfo);
		}

		// If no date column and couldn't extract from filename, error
		if (!columns.hasDateColumn && !filenameDateInfo) {
			return {
				expenses: [],
				status: "error",
				errorMessage:
					"CSV has no Date column. Please include year and month in the filename (e.g., 'Expenses 2023 - January.csv') or add a Date column.",
			};
		}

		const expenses: ParsedExpense[] = [];

		// Process data rows (skip header row and rows before it)
		for (let i = headerRowIndex + 1; i < rows.length; i++) {
			const row = rows[i];

			// Skip summary/empty rows
			if (shouldSkipRow(row)) {
				console.log(`[CSV Parser] Skipping row ${i + 1}: summary/empty row`);
				continue;
			}

			// Get description, with fallback to secondary column if primary is empty
			let description = row[columns.description]?.trim();
			if (
				!description &&
				columns.descriptionFallback !== -1 &&
				columns.descriptionFallback !== columns.description
			) {
				description = row[columns.descriptionFallback]?.trim();
			}

			const amountStr = row[columns.amount]?.trim();

			// Skip if required fields are missing
			if (!description || !amountStr) {
				console.log(`[CSV Parser] Skipping row ${i + 1}: missing data`);
				continue;
			}

			// Determine the date
			let parsedDate: string | null = null;
			if (columns.hasDateColumn) {
				const dateStr = row[columns.date]?.trim();
				if (dateStr) {
					parsedDate = parseDate(dateStr);
				}
			} else if (filenameDateInfo) {
				// Use date from filename (default to 15th of month)
				parsedDate = `${filenameDateInfo.year}-${filenameDateInfo.month}-15`;
			}

			if (!parsedDate) {
				console.log(`[CSV Parser] Skipping row ${i + 1}: no valid date`);
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
				checked: true, // CSV expenses are pre-verified shared expenses
			});
		}

		console.log(`[CSV Parser] Found ${expenses.length} expenses`);

		if (expenses.length === 0) {
			return {
				expenses: [],
				status: "error",
				errorMessage:
					"No valid expenses found in CSV. Check that your data rows have valid items and amounts.",
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
