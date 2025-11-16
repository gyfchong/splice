/**
 * User Settings Management
 * Uses localStorage to persist user preferences
 */

export interface UserSettings {
	autoCheckExpenses: boolean;
}

const SETTINGS_KEY = "splice_user_settings";

const DEFAULT_SETTINGS: UserSettings = {
	autoCheckExpenses: false,
};

/**
 * Get user settings from localStorage
 */
export function getUserSettings(): UserSettings {
	if (typeof window === "undefined") {
		return DEFAULT_SETTINGS;
	}

	try {
		const stored = localStorage.getItem(SETTINGS_KEY);
		if (!stored) {
			return DEFAULT_SETTINGS;
		}

		const parsed = JSON.parse(stored) as Partial<UserSettings>;
		return {
			...DEFAULT_SETTINGS,
			...parsed,
		};
	} catch (error) {
		console.error("Failed to load user settings:", error);
		return DEFAULT_SETTINGS;
	}
}

/**
 * Save user settings to localStorage
 */
export function saveUserSettings(settings: Partial<UserSettings>): void {
	if (typeof window === "undefined") {
		return;
	}

	try {
		const current = getUserSettings();
		const updated = {
			...current,
			...settings,
		};
		localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
	} catch (error) {
		console.error("Failed to save user settings:", error);
	}
}

/**
 * Get the autoCheckExpenses setting
 */
export function getAutoCheckSetting(): boolean {
	return getUserSettings().autoCheckExpenses;
}

/**
 * Set the autoCheckExpenses setting
 */
export function setAutoCheckSetting(value: boolean): void {
	saveUserSettings({ autoCheckExpenses: value });
}
