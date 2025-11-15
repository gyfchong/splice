import { PDFParse } from "pdf-parse";

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

	// DD/MM/YY or DD/MM/YYYY (Australian format - NAB statements)
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

	return null;
}

/**
 * Extract expenses from PDF text content
 * Supports multiple formats including NAB bank statements
 */
function extractExpenses(text: string): ParsedExpense[] {
	const expenses: ParsedExpense[] = [];
	const lines = text.split("\n");

	// NAB format: ProcessedDate \t TransactionDate \t CardNo \t Description \t Amount
	// Example: 25/08/25 	23/08/25 	V0513 	APPLE.COM/BILL SYDNEY 	4.49
	const nabPattern =
		/^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(V\d{4})\s+(.+?)\s+(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(CR)?$/;

	// Generic pattern for other statements
	const amountPattern = /\$?\s*-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/;
	const datePattern = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/;

	console.log(`[Extract] Processing ${lines.length} lines`);

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;

		// Try NAB format first
		const nabMatch = line.match(nabPattern);
		if (nabMatch) {
			const [, , transactionDate, , description, amountStr, isCredit] =
				nabMatch;

			// Skip credits (payments)
			if (isCredit) {
				console.log(`[Extract] Skipping credit: ${description}`);
				continue;
			}

			const amount = Number.parseFloat(amountStr.replace(/,/g, ""));
			if (Number.isNaN(amount) || amount === 0) continue;

			const parsedDate = parseDate(transactionDate);
			if (!parsedDate) {
				console.log(`[Extract] Failed to parse date: ${transactionDate}`);
				continue;
			}

			const [year, month] = parsedDate.split("-");
			const expenseId = generateExpenseId(
				description,
				amount,
				parsedDate,
			);

			expenses.push({
				expenseId,
				name: description,
				amount,
				date: parsedDate,
				year: Number.parseInt(year, 10),
				month,
			});
			continue;
		}

		// Fall back to generic pattern
		const dateMatch = line.match(datePattern);
		const amountMatch = line.match(amountPattern);

		if (dateMatch && amountMatch) {
			const dateStr = dateMatch[0];
			const amountStr = amountMatch[0].replace(/[$,\s]/g, "");
			const amount = Math.abs(Number.parseFloat(amountStr));

			// Extract the description (everything between date and amount)
			const dateIndex = line.indexOf(dateStr);
			const amountIndex = line.indexOf(amountMatch[0]);
			let description = line
				.substring(dateIndex + dateStr.length, amountIndex)
				.trim();

			// If description is empty, try to get it from the surrounding text
			if (!description) {
				description = line
					.replace(dateStr, "")
					.replace(amountMatch[0], "")
					.trim();
			}

			// Skip if we couldn't extract a meaningful description or amount
			if (!description || Number.isNaN(amount) || amount === 0) continue;

			const parsedDate = parseDate(dateStr);
			if (!parsedDate) continue;

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
	}

	console.log(`[Extract] Found ${expenses.length} expenses`);
	return expenses;
}

/**
 * Parse a PDF file buffer and extract expenses
 */
export async function parsePDF(buffer: Buffer): Promise<ParseResult> {
	try {
		console.log("[PDF Parser] Starting PDF parsing...");
		const parser = new PDFParse({ data: buffer });
		const result = await parser.getText();
		console.log(
			`[PDF Parser] Extracted ${result.text.length} characters from PDF`,
		);

		// Log first 500 chars for debugging
		console.log(
			"[PDF Parser] First 500 chars:",
			result.text.substring(0, 500),
		);

		const expenses = extractExpenses(result.text);

		if (expenses.length === 0) {
			console.error("[PDF Parser] No expenses found in PDF");
			return {
				expenses: [],
				status: "error",
				errorMessage:
					"No expenses found in PDF. Please ensure the PDF is a valid bank or credit card statement with a format like: Date Description Amount (e.g., 01/15/2024 Coffee Shop $5.99)",
			};
		}

		console.log(`[PDF Parser] Successfully parsed ${expenses.length} expenses`);
		return {
			expenses,
			status: "success",
		};
	} catch (error) {
		console.error("[PDF Parser] Error:", error);
		return {
			expenses: [],
			status: "error",
			errorMessage:
				error instanceof Error ? error.message : "Failed to parse PDF",
		};
	}
}
