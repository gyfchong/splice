/**
 * Normalizes a transaction description to extract the core merchant name
 * Examples:
 * - "WOOLWORTHS TOWN HALL 123" → "WOOLWORTHS"
 * - "BP NORTHSIDE" → "BP"
 * - "NETFLIX.COM" → "NETFLIX"
 */
export function normalizeMerchant(description: string): string {
	// Convert to uppercase and trim
	let normalized = description.toUpperCase().trim()

	// Remove common suffixes and transaction IDs
	normalized = normalized
		// Remove URLs and domains
		.replace(/\.COM\.AU|\.COM|\.NET|\.ORG/g, "")
		// Remove numbers at the end (location codes, transaction IDs)
		.replace(/\s+\d+$/g, "")
		// Remove common location indicators
		.replace(/\s+(STORE|BRANCH|LOCATION|OUTLET|PTY LTD|PTY|LTD)$/g, "")

	// Extract first significant word(s)
	// Split by common delimiters
	const parts = normalized.split(/[\s\-_/]+/)

	// Known merchant patterns (can be expanded)
	const knownMerchants = [
		"WOOLWORTHS",
		"COLES",
		"ALDI",
		"IGA",
		"BUNNINGS",
		"KMART",
		"TARGET",
		"BIG W",
		"MYER",
		"DAVID JONES",
		"JB HI-FI",
		"HARVEY NORMAN",
		"OFFICEWORKS",
		"CHEMIST WAREHOUSE",
		"PRICELINE",
		"DAN MURPHY",
		"BWS",
		"LIQUORLAND",
		"CALTEX",
		"BP",
		"SHELL",
		"7-ELEVEN",
		"MOBIL",
		"AMPOL",
		"NETFLIX",
		"SPOTIFY",
		"APPLE",
		"GOOGLE",
		"AMAZON",
		"PAYPAL",
		"UBER",
		"DELIVEROO",
		"MENULOG",
		"DOORDASH",
		"TELSTRA",
		"OPTUS",
		"VODAFONE",
		"COMMONWEALTH BANK",
		"WESTPAC",
		"ANZ",
		"NAB",
		"CINEWORLD",
		"EVENT CINEMAS",
		"HOYTS",
		"VILLAGE CINEMAS",
		"MCDONALD",
		"KFC",
		"HUNGRY JACK",
		"SUBWAY",
		"DOMINO",
		"PIZZA HUT",
		"RED ROOSTER",
		"OPORTO",
	]

	// Check if any known merchant is in the description
	for (const merchant of knownMerchants) {
		if (normalized.includes(merchant)) {
			return merchant
		}
	}

	// For multi-word merchants, try to preserve up to 2 words
	if (parts.length >= 2) {
		// Check if first two words form a known pattern
		const firstTwo = `${parts[0]} ${parts[1]}`
		for (const merchant of knownMerchants) {
			if (merchant === firstTwo) {
				return merchant
			}
		}
	}

	// Fallback: return first word if it's meaningful (>2 chars)
	if (parts[0] && parts[0].length > 2) {
		return parts[0]
	}

	// Last resort: return trimmed normalized string (max 50 chars)
	return normalized.substring(0, 50)
}
